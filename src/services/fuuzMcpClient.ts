import { DataModel, DataModelField, EnterpriseEndpoints, McpSnapshot, McpTool, ModuleGroup } from '../types';
import { assembleApplication, classifyTool, extractModelNames, parseReferences, parseTronRecords, ErdEdge } from '../util/fuuzParse';

const REQUEST_TIMEOUT_MS = 15000;

export type EndpointState = 'available' | 'unauthorized' | 'forbidden' | 'unavailable' | 'error';

/** Result of probing a single endpoint with a credential. */
export interface EndpointProbe {
  key: 'mcp' | 'flow' | 'webhook';
  label: string;
  url: string;
  state: EndpointState;
  status?: number;
  detail?: string;
  /** MCP server name, when the MCP probe succeeds. */
  serverName?: string;
}

/**
 * Client for communicating with Fuuz REST endpoints (the human-facing resource
 * tree). Uses the runtime's global `fetch` — no third-party HTTP dependency to
 * bundle — with a Bearer token sourced from SecretStorage by the caller.
 */
export class FuuzMcpClient {
  /**
   * Perform a JSON-RPC `initialize` handshake against an MCP endpoint — the same
   * thing VS Code does when it connects the registered server. Handles both
   * `application/json` and `text/event-stream` responses and returns the
   * server's `serverInfo` on success.
   */
  async initializeMcp(
    mcpUrl: string,
    token: string
  ): Promise<{ ok: boolean; message: string; serverInfo?: { name?: string; version?: string } }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'fuuz-vscode', version: '1.0.0' },
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = extractMessage(await res.text().catch(() => ''));
        return { ok: false, message: detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}` };
      }

      const parsed = parseJsonRpc(await res.text());
      if (parsed?.error) {
        return { ok: false, message: parsed.error.message || 'MCP error' };
      }
      const serverInfo = parsed?.result?.serverInfo;
      if (serverInfo?.name) {
        return { ok: true, message: `Connected — ${serverInfo.name}`, serverInfo };
      }
      const ok = parsed?.result !== undefined;
      return { ok, message: ok ? 'Connected' : 'Unexpected response', serverInfo };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Lightweight reachability/auth check used by the config UI Test button. */
  async testMcpConnection(mcpUrl: string, token: string): Promise<{ ok: boolean; message: string }> {
    const { ok, message } = await this.initializeMcp(mcpUrl, token);
    return { ok, message };
  }

  /**
   * Open a session and pull what the MCP server exposes for this connection:
   * environment/context info and the catalog of available tools. Returns null
   * when the server is unreachable/unauthorized so callers can fall back to a
   * manual resource flow. Best-effort: individual steps degrade gracefully.
   */
  async loadMcpSnapshot(mcpUrl: string, token: string): Promise<McpSnapshot | null> {
    const session = await this.openSession(mcpUrl, token);
    if (!session.ok) {
      return null;
    }
    const sessionId = session.sessionId;
    const serverName: string | undefined = session.result?.serverInfo?.name;

    // Best-effort: tell the server we're initialized (notification, no id).
    await this.rpc(mcpUrl, token, sessionId, { method: 'notifications/initialized' }).catch(() => undefined);

    let id = 2;
    const next = () => id++;
    const callText = async (name: string, args: Record<string, any> = {}): Promise<string> => {
      const res = await this.rpc(mcpUrl, token, sessionId, {
        id: next(),
        method: 'tools/call',
        params: { name, arguments: args },
      }).catch(() => null);
      const result = res?.parsed?.result;
      const content = result?.content;
      if (Array.isArray(content)) {
        const t = content.find((c: any) => c?.type === 'text' && typeof c.text === 'string');
        if (t) return t.text as string;
      }
      return typeof result === 'string' ? result : '';
    };

    // Catalog of tools, classified system vs custom data flow.
    const list = await this.rpc(mcpUrl, token, sessionId, { id: next(), method: 'tools/list' }).catch(() => null);
    const rawTools = list?.parsed?.result?.tools;
    const tools: McpTool[] = Array.isArray(rawTools)
      ? rawTools.map((t: any) => classifyTool(String(t.name ?? ''), t.description))
      : [];
    const has = (name: string) => tools.some(t => t.name === name);

    // Environment / context info (clean JSON object).
    let environment: Record<string, any> | undefined;
    if (has('system_get_environment_info')) {
      try {
        environment = JSON.parse(await callText('system_get_environment_info'));
      } catch {
        /* leave undefined */
      }
    }

    // Application metamodel via record queries on the app-component models.
    let application: ModuleGroup[] = [];
    let systemDataModels: DataModel[] = [];
    if (has('system_query_model')) {
      const query = (modelName: string, fields: string[]) =>
        callText('system_query_model', { service: 'application', modelName, fields, where: '{}' })
          .then(parseTronRecords)
          .catch(() => []);
      const [groups, modules, screens, flows, models] = await Promise.all([
        query('ModuleGroup', ['id', 'name']),
        query('Module', ['id', 'name', 'moduleGroupId']),
        query('Screen', ['id', 'name', 'moduleId']),
        query('DataFlow', ['id', 'name', 'moduleId']),
        query('DataModel', ['id', 'name', 'moduleId', 'dataModelTypeId']),
      ]);
      application = assembleApplication(groups, modules, screens, flows, models);
    }

    // System data models: names from the system service catalog.
    if (has('system_list_models')) {
      const sys = await callText('system_list_models', { service: 'system' }).catch(() => '');
      systemDataModels = extractModelNames(sys).map(name => ({ id: name, name, fields: [] }));
    }

    return { serverName, environment, tools, application, systemDataModels };
  }

  /**
   * Fetch a data model's graph (scalar fields + relations with target models)
   * for ERD rendering, via `data_flow_data_model_details`.
   */
  async fetchModelGraph(
    mcpUrl: string,
    token: string,
    modelName: string
  ): Promise<{ name: string; description?: string; fields: { name: string; type: string }[]; relations: { field: string; target: string; many: boolean }[] } | null> {
    const obj = await this.callModelDetails(mcpUrl, token, modelName);
    if (!obj) return null;
    const elements: any[] = Array.isArray(obj.elements) ? obj.elements : [];
    const fields = elements
      .filter(e => !e.relation && !e.complexType)
      .map(e => ({ name: String(e.name ?? ''), type: cleanType(String(e.type ?? '')) }));
    const relations = elements
      .filter(e => e.relation)
      .map(e => ({
        field: String(e.name ?? ''),
        target: cleanType(String(e.type ?? '')),
        many: String(e.type ?? '').trim().startsWith('['),
      }))
      .filter(r => r.target);
    return { name: String(obj.model?.name ?? modelName), description: obj.model?.description, fields, relations };
  }

  /**
   * Open an MCP session, retrying with backoff when the server throttles rapid
   * re-initialization. Bails immediately on auth failures (401/403).
   */
  private async openSession(
    mcpUrl: string,
    token: string
  ): Promise<{ ok: boolean; status: number; sessionId?: string; result?: any }> {
    let status = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await delay(300 + attempt * 500);
      const init = await this.rpc(mcpUrl, token, undefined, {
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fuuz-vscode', version: '1.0.0' } },
      }).catch(() => null);
      if (init?.ok && init.parsed?.result !== undefined) {
        return { ok: true, status: init.status, sessionId: init.sessionId, result: init.parsed.result };
      }
      status = init?.status ?? 0;
      if (status === 401 || status === 403) break; // auth problem — retrying won't help
    }
    return { ok: false, status };
  }

  /** Open a session and call one tool, returning its text content (or ''). */
  private async callToolText(mcpUrl: string, token: string, name: string, args: Record<string, any>): Promise<string> {
    const session = await this.openSession(mcpUrl, token);
    if (!session.ok) return '';
    const sessionId = session.sessionId;
    await this.rpc(mcpUrl, token, sessionId, { method: 'notifications/initialized' }).catch(() => undefined);
    const res = await this.rpc(mcpUrl, token, sessionId, {
      id: 2,
      method: 'tools/call',
      params: { name, arguments: args },
    }).catch(() => null);
    const content = res?.parsed?.result?.content;
    if (Array.isArray(content)) {
      const t = content.find((c: any) => c?.type === 'text' && typeof c.text === 'string');
      if (t) return t.text as string;
    }
    return '';
  }

  /** Shared call to `data_flow_data_model_details`, returning parsed JSON or null. */
  private async callModelDetails(mcpUrl: string, token: string, modelName: string): Promise<any | null> {
    try {
      return JSON.parse(await this.callToolText(mcpUrl, token, 'data_flow_data_model_details', { modelName }));
    } catch {
      return null;
    }
  }

  /** Fetch the tenant's full relationship edge list via `system_list_model_references`. */
  async fetchReferences(mcpUrl: string, token: string): Promise<ErdEdge[]> {
    const text = await this.callToolText(mcpUrl, token, 'system_list_model_references', { service: 'application' });
    return parseReferences(text);
  }

  /** Deploy an app component version (destructive; caller must confirm first). */
  async deployComponent(
    mcpUrl: string,
    token: string,
    componentType: string,
    versionId: string,
    opts: { forceStopPreviousVersions?: boolean } = {}
  ): Promise<string> {
    const args: Record<string, any> = { componentType, versionId };
    if (componentType === 'dataFlow' && opts.forceStopPreviousVersions) args.forceStopPreviousVersions = true;
    return this.callToolText(mcpUrl, token, 'system_deploy_app_component_version', args);
  }

  /** Run a read-only `system_query_model` and return parsed records (+ raw text). */
  async queryModel(
    mcpUrl: string,
    token: string,
    modelName: string,
    fields: string[],
    where: string
  ): Promise<{ records: Record<string, string>[]; raw: string }> {
    const raw = await this.callToolText(mcpUrl, token, 'system_query_model', {
      service: 'application',
      modelName,
      fields,
      where: where && where.trim() ? where.trim() : '{}',
    });
    return { records: parseTronRecords(raw), raw };
  }

  /**
   * Fetch a single data model's fields on demand (for lazy tree expansion) via
   * `data_flow_data_model_details`, which returns clean JSON `elements`.
   */
  async fetchModelElements(mcpUrl: string, token: string, modelName: string): Promise<DataModelField[]> {
    const obj = await this.callModelDetails(mcpUrl, token, modelName);
    const els = Array.isArray(obj?.elements) ? obj.elements : [];
    return els.map((e: any): DataModelField => ({
      id: String(e.id ?? e.name ?? ''),
      name: String(e.name ?? ''),
      type: String(e.type ?? ''),
      required: typeof e.type === 'string' && e.type.endsWith('!'),
    }));
  }

  /**
   * Single JSON-RPC round-trip over streamable HTTP. Carries the session id
   * (captured from `initialize`) on subsequent calls and parses json or SSE.
   */
  private async rpc(
    mcpUrl: string,
    token: string,
    sessionId: string | undefined,
    payload: { id?: number; method: string; params?: any }
  ): Promise<{ ok: boolean; status: number; parsed: any; sessionId?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      };
      if (sessionId) headers['Mcp-Session-Id'] = sessionId;
      const res = await fetch(mcpUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', ...payload }),
        signal: controller.signal,
      });
      const newSession = res.headers.get('mcp-session-id') || sessionId;
      const text = await res.text();
      return { ok: res.ok, status: res.status, parsed: parseJsonRpc(text), sessionId: newSession || undefined };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Probe every endpoint (MCP, flow execution, webhook) with a credential and
   * report which are available, unauthorized, or absent for this environment.
   * Probes are non-destructive: flow/webhook use a sentinel that authentication
   * rejects before any work runs.
   */
  async probeEndpoints(endpoints: EnterpriseEndpoints, token: string): Promise<EndpointProbe[]> {
    const webhookProbe = `${endpoints.webhook.replace(/\/$/, '')}/__fuuz_healthcheck__`;
    const [mcp, flow, webhook] = await Promise.all([
      this.initializeMcp(endpoints.mcp, token).then((r): EndpointProbe => ({
        key: 'mcp',
        label: 'MCP',
        url: endpoints.mcp,
        state: r.ok ? 'available' : stateFromStatus(statusFromMessage(r.message)),
        serverName: r.serverInfo?.name,
        detail: r.ok ? r.serverInfo?.name : r.message,
      })),
      this.probePost('flow', 'Flow execution', endpoints.flowExecution, token, {
        flowId: '__fuuz_healthcheck__',
        payload: {},
      }),
      this.probePost('webhook', 'Webhook', webhookProbe, token, {}),
    ]);
    return [mcp, flow, webhook];
  }

  private async probePost(
    key: EndpointProbe['key'],
    label: string,
    url: string,
    token: string,
    body: unknown
  ): Promise<EndpointProbe> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });
      const text = await res.text();
      const routeMissing = res.status === 404 && /Cannot (POST|GET|PUT|DELETE)/i.test(text);
      const state = routeMissing ? 'unavailable' : stateFromStatus(res.status);
      return { key, label, url, status: res.status, state, detail: extractMessage(text) };
    } catch (error) {
      return { key, label, url, state: 'error', detail: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Strip GraphQL type decorations: `[Workcenter!]!` → `Workcenter`, `String!` → `String`. */
function cleanType(type: string): string {
  return type.replace(/[[\]!]/g, '').trim();
}

function statusFromMessage(message: string): number {
  const m = message.match(/\b(\d{3})\b/);
  return m ? Number(m[1]) : 0;
}

/** Classify an HTTP status into an endpoint availability state. */
function stateFromStatus(status: number): EndpointState {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'unavailable';
  if (status >= 200 && status < 500) return 'available'; // reachable + authorized (4xx validation ok)
  return 'error';
}


/** Pull a human-readable message out of a JSON error body, else a short text. */
function extractMessage(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed.message || parsed.error || undefined;
  } catch {
    return trimmed.slice(0, 120);
  }
}

/** Parse a JSON-RPC response that may be raw JSON or an SSE `data:` frame. */
function parseJsonRpc(text: string): any {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }
  // SSE framing: take the last non-empty `data:` line.
  const dataLines = trimmed
    .split(/\r?\n/)
    .filter(l => l.startsWith('data:'))
    .map(l => l.slice(5).trim())
    .filter(Boolean);
  for (let i = dataLines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(dataLines[i]);
    } catch {
      /* keep looking */
    }
  }
  return undefined;
}
