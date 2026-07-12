/**
 * Deterministic pre-flight guards for Fuuz mutation payloads — a HARD gate that
 * runs on every build regardless of which model composed it. These enforce the
 * type/kind vocabularies the skills declare (so an agent can't save a flow or
 * data model with a bad or inappropriate type). Pure (no VS Code / IO) so it is
 * unit-testable; wired into the mutation tool handlers in copilot/fuuzMcpTools.ts.
 *
 * A guard returns an error STRING (fed back to the model so it fixes and retries)
 * or null when the payload passes. Guards never mutate the payload.
 */

/** Allowed data-flow types (dataFlowTypeId / flow.type) — from the fuuz-data-flow skill. */
export const FLOW_TYPES = ['System', 'Document', 'Integration', 'Screen', 'Edge'] as const;
/** Allowed data-model types (dataModelTypeId) — from the fuuz-data-model skill. */
export const MODEL_TYPES = ['setup', 'master', 'transactional'] as const;
/** Allowed data-model kinds (dataModelKindId) — from the fuuz-data-model skill. */
export const MODEL_KINDS = ['reference', 'embeddable', 'abstract'] as const;

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Breadth-first search for the first value of `key` anywhere in the object tree. */
function findKey(root: unknown, key: string): unknown {
  const queue: unknown[] = [root];
  while (queue.length) {
    const cur = queue.shift();
    if (Array.isArray(cur)) { for (const v of cur) queue.push(v); continue; }
    if (isObj(cur)) {
      if (key in cur) return cur[key];
      for (const v of Object.values(cur)) queue.push(v);
    }
  }
  return undefined;
}

const asStr = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/**
 * Lint JSONata transform strings for the operator mistakes models keep making,
 * confusing JSONata with JavaScript. Only inspects values under keys named
 * `transform` or ending in `Transform` (which the node skill marks `format:
 * jsonata`) — Script-node JavaScript lives under other keys, so `&&`/`||`/`=>`
 * there are left alone. Returns a fix message or null. Pure.
 */
const JSONATA_OPERATOR_FIXES: Array<{ re: RegExp; bad: string; fix: string }> = [
  { re: /=>/, bad: '=>', fix: 'use `>=` for greater-than-or-equal (`=>` is not a JSONata operator)' },
  { re: /=</, bad: '=<', fix: 'use `<=` for less-than-or-equal' },
  { re: /&&/, bad: '&&', fix: 'use `and` for boolean AND (`&` is string concatenation in JSONata, and `&&` is invalid)' },
  { re: /\|\|/, bad: '||', fix: 'use `or` for boolean OR' },
  { re: /(^|[^=!<>])==(?!=)/, bad: '==', fix: 'use `=` (single equals) for equality' },
];
export function lintJsonataTransforms(payload: unknown): string | null {
  const problems: string[] = [];
  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    if (!isObj(node)) return;
    for (const [k, v] of Object.entries(node)) {
      const p = path ? `${path}.${k}` : k;
      if (typeof v === 'string' && (/transform$/i.test(k) || k === 'transform')) {
        for (const { re, bad, fix } of JSONATA_OPERATOR_FIXES) {
          if (re.test(v)) problems.push(`${p}: "${bad}" — ${fix}`);
        }
      } else {
        walk(v, p);
      }
    }
  };
  walk(payload, '');
  if (!problems.length) return null;
  return 'error: invalid JSONata operator(s) in transform(s) — Fuuz uses JSONata 2.1.1, not JavaScript. Fix and resend:\n' + problems.join('\n');
}

/** Case-insensitive membership against an allow-list. */
const inList = (v: string, list: readonly string[]): boolean =>
  list.some(x => x.toLowerCase() === v.toLowerCase());

export interface FlowGuardOptions {
  /** True when the user's goal is a callable MCP tool / API — then System is wrong. */
  callableTool?: boolean;
  /** Valid module ids for the tenant; when provided, moduleId is validated against them. */
  moduleIds?: string[];
}

export interface ModuleRef { id: string; name?: string }

/** Structural container keys whose value must be an OBJECT, never a JSON string. */
const STRUCT_KEYS = ['header', 'version', 'flow', 'diagram', 'modelDefinition', 'data'] as const;

function tryParseJson(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (t[0] !== '{' && t[0] !== '[') return v; // not JSON — leave code/text strings alone
  try { return JSON.parse(t); } catch { return v; }
}

/**
 * Coerce stringified JSON on structural container keys back into objects.
 *
 * Local models frequently double-encode a nested object as a JSON STRING — e.g.
 * `"version": "{\"flow\": …}"` — which the server rejects with
 * `expected object, received string`. This was THE wall to creating a data flow.
 * We only touch structural keys (header/version/flow/diagram/modelDefinition/data)
 * and only when the string looks like JSON, so code strings like `transform` /
 * `query` are never disturbed. Recurses so version→flow→diagram all get fixed.
 * Mutates in place and returns a note listing what was fixed. Pure.
 */
export function coerceContainerJson(payload: Record<string, unknown>): { payload: Record<string, unknown>; note?: string } {
  const fixed: string[] = [];
  const walk = (node: unknown, path: string): void => {
    if (!isObj(node)) return;
    for (const k of STRUCT_KEYS) {
      if (k in node) {
        const before = node[k];
        const parsed = tryParseJson(before);
        if (parsed !== before && (typeof before === 'string')) { node[k] = parsed; fixed.push(path ? `${path}.${k}` : k); }
        if (isObj(node[k])) walk(node[k], path ? `${path}.${k}` : k);
      }
    }
  };
  if (isObj(payload)) walk(payload, '');
  return fixed.length ? { payload, note: `parsed stringified JSON on: ${fixed.join(', ')} (the server needs objects, not strings)` } : { payload };
}

/** Keys a model wrongly wraps the flow container in; the real payload is inside. */
const FLOW_WRAPPER_KEYS = ['content', 'payload', 'data', 'input', 'body', 'container', 'versionContainer', 'dataFlow', 'flowDefinition', 'definition'] as const;
/** A real flow-mutation container has at least one of these at its top level. */
const CONTAINER_MARKERS = ['header', 'version', 'where'] as const;

/**
 * Un-nest a flow-mutation payload the model wrapped in an extra object.
 *
 * The server reads `header`/`where` at the TOP level, but models repeatedly wrap
 * the whole container in `{"content": …}` (or invent top-level `version_id` /
 * `module_id`), so the server reports `Either where.id or where.name (or
 * header.name) must be provided` no matter what — because it never sees the
 * top-level keys. We lift the real container out so the model's wrapper mistake
 * self-corrects. Pure.
 */
export function unwrapFlowContainer(payload: Record<string, unknown>): { payload: Record<string, unknown>; note?: string } {
  let p: Record<string, unknown> = payload;
  let removed: string | undefined;
  for (let depth = 0; depth < 4; depth++) {
    if (CONTAINER_MARKERS.some(k => k in p)) break; // real container reached
    const wrapKey = FLOW_WRAPPER_KEYS.find(k => isObj(p[k]) && CONTAINER_MARKERS.some(m => m in (p[k] as object)));
    if (!wrapKey) break;
    p = p[wrapKey] as Record<string, unknown>;
    removed = wrapKey;
  }
  return removed
    ? { payload: p, note: `auto-fix: unwrapped the flow payload from an extra "${removed}" wrapper — the ONLY top-level keys are header/version (and where for updates), never a wrapper.` }
    : { payload };
}

const normId = (s: unknown): string => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Resolve a header.moduleId the model guessed (e.g. "Production Management" or
 * "productionManagement") to a REAL tenant module id by matching id/name
 * case- and separator-insensitively. Mutates the payload's moduleId in place when
 * it finds a match. The invalid-moduleId reference error was the last hard wall to
 * creating a flow. Returns a note when it corrected something.
 */
export function resolveModuleId(payload: Record<string, unknown>, modules: ModuleRef[] = []): { payload: Record<string, unknown>; note?: string } {
  if (!isObj(payload) || !modules.length) return { payload };
  const header = isObj((payload as any).header) ? (payload as any).header as Record<string, unknown> : payload;
  const raw = asStr(header.moduleId);
  const ids = new Set(modules.map(m => m.id));
  if (raw && ids.has(raw)) return { payload };
  if (raw) {
    const match = modules.find(m => normId(m.id) === normId(raw) || normId(m.name) === normId(raw));
    if (match) { header.moduleId = match.id; return { payload, note: `resolved moduleId "${raw}" → "${match.id}"` }; }
  }
  return { payload };
}

/**
 * Validate a data-flow mutation payload's type before it is sent. Blocks:
 *  - an invalid dataFlowTypeId / flow.type (not in the allowed vocabulary),
 *  - a header type that disagrees with flow.type,
 *  - a callable-tool flow saved as System (must be Integration).
 * Returns an error string (with the exact fix) or null.
 */
export function checkFlowPayload(payload: unknown, opts: FlowGuardOptions = {}): string | null {
  const headerType = asStr(findKey(payload, 'dataFlowTypeId'));
  // flow.type lives at version.flow.type (or flow.type); navigate explicitly so we
  // don't pick up a node's `type`.
  const p = isObj(payload) ? payload : {};
  const version = isObj(p.version) ? p.version : undefined;
  const flow = (version && isObj(version.flow) ? version.flow : undefined) ?? (isObj(p.flow) ? p.flow : undefined);
  const flowType = flow ? asStr(flow.type) : undefined;

  // A flow with no nodes saves "empty" and nothing renders — the exact "flow
  // created but empty" defect. Enforce nodes:
  //  - if a flow body is present, it must carry ≥1 node; and
  //  - on a CREATE (no `where.id` targeting an existing flow) a flow body with
  //    nodes is REQUIRED — a header-only create produces an empty flow. Only an
  //    id-targeted metadata update (rename / toggle active) may omit the flow.
  const whereId = isObj(p.where) ? asStr((p.where as Record<string, unknown>).id) : asStr(findKey(p, 'dataFlowId'));
  if (flow) {
    const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
    if (nodes.length === 0) {
      return 'error: this data flow has an empty "nodes" array — it would save with no nodes (nothing renders). Put the real nodes (each with id, name, type, data) in version.flow.nodes and resend.';
    }
  } else if (!whereId) {
    return 'error: creating a data flow requires its BODY — include version.flow with { id, type, version, and a non-empty nodes array }. A header without a flow body saves an EMPTY flow (nothing runs or renders). Build the nodes and resend.';
  }

  const allowed = FLOW_TYPES.join(' | ');
  if (headerType && !inList(headerType, FLOW_TYPES)) {
    return `error: invalid dataFlowTypeId "${headerType}". Allowed data-flow types are: ${allowed}. Set header.dataFlowTypeId (and flow.type) to the correct one and resend.`;
  }
  if (flowType && !inList(flowType, FLOW_TYPES)) {
    return `error: invalid flow.type "${flowType}". Allowed data-flow types are: ${allowed}. Set flow.type (and header.dataFlowTypeId) to the correct one and resend.`;
  }
  if (headerType && flowType && headerType.toLowerCase() !== flowType.toLowerCase()) {
    return `error: header.dataFlowTypeId ("${headerType}") must EQUAL flow.type ("${flowType}"). Make them identical and resend.`;
  }
  if (opts.callableTool) {
    const t = (headerType || flowType || '').toLowerCase();
    if (t && t !== 'integration') {
      return `error: this flow must be callable as an MCP tool/API, which requires dataFlowTypeId "Integration" — it is "${headerType || flowType}". Change BOTH header.dataFlowTypeId and flow.type to "Integration" and resend.`;
    }
  }
  // moduleId must be a REAL module id (the "invalid reference id" wall). Only
  // enforced when a flow body is being written and we know the valid ids.
  if (flow && opts.moduleIds && opts.moduleIds.length) {
    const mid = asStr(findKey(payload, 'moduleId'));
    const list = opts.moduleIds.slice(0, 40).join(', ');
    if (!mid) return `error: header.moduleId is required. Set it to one of these real module ids: ${list}`;
    if (!opts.moduleIds.includes(mid)) return `error: invalid moduleId "${mid}" — it is not a real module id. Use one of: ${list}`;
  }
  // Catch JSONata operator mistakes in any transform before the server does.
  const jsonataErr = lintJsonataTransforms(payload);
  if (jsonataErr) return jsonataErr;
  return null;
}

/**
 * Validate a data-model mutation payload's type/kind before it is sent. Blocks an
 * invalid dataModelTypeId (setup | master | transactional) or dataModelKindId
 * (Reference | Embeddable | Abstract). Returns an error string or null.
 */
/**
 * Ensure a saved-transform mutation carries a target key. The server requires
 * `where.id` / `where.name` / `header.name`; models sometimes send only
 * `data.name` or a bare `name`. Derive `where.name` from those when missing.
 */
export function normalizeSavedTransform(payload: Record<string, unknown>): { payload: Record<string, unknown>; note?: string } {
  if (!isObj(payload)) return { payload };
  const where = isObj(payload.where) ? payload.where as Record<string, unknown> : undefined;
  const header = isObj(payload.header) ? payload.header as Record<string, unknown> : undefined;
  const data = isObj(payload.data) ? payload.data as Record<string, unknown> : undefined;
  const hasKey = (where && (asStr(where.id) || asStr(where.name))) || (header && asStr(header.name));
  if (hasKey) return { payload };
  const name = asStr(data?.name) ?? asStr(payload.name) ?? asStr(header?.name);
  if (name) {
    payload.where = { ...(where ?? {}), name };
    return { payload, note: `set where.name="${name}" (the mutation requires where.id/where.name or header.name)` };
  }
  return { payload };
}

/**
 * Repair the common wrong-argument mistakes models make when calling RAW Fuuz MCP
 * tools through the generic `fuuz_mcp_call` escape hatch (seen repeatedly in the
 * trace): missing/invalid `service`, `model` instead of `modelName`, `where` as an
 * object instead of a JSON string, and `name`/`id` instead of `dataFlowId`.
 * Mutates the args in place; returns a note listing what was fixed. Pure.
 */
export function normalizeMcpCallArgs(tool: string, args: Record<string, unknown>): { args: Record<string, unknown>; note?: string } {
  if (!isObj(args)) return { args: {} };
  const fixes: string[] = [];
  const t = (tool || '').toLowerCase();

  // `service` must be "system" | "application" for these read tools — default it.
  if (/^system_(list_models|query_model|list_model_fields|list_model_references)/.test(t)) {
    const svc = asStr(args.service);
    if (svc !== 'system' && svc !== 'application') { args.service = 'application'; fixes.push('service=application'); }
  }
  // `model` → `modelName` (raw system_* tools use modelName).
  if ('model' in args && !asStr(args.modelName)) { args.modelName = args.model; delete args.model; fixes.push('model→modelName'); }
  // `where` object → JSON string (raw tools take a stringified filter).
  if (args.where && typeof args.where === 'object') { args.where = JSON.stringify(args.where); fixes.push('where→string'); }
  // data-flow details/diagram tools need `dataFlowId` — map a provided id/name.
  if (/data_flow.*(detail|diagram)/.test(t) && !asStr(args.dataFlowId)) {
    const cand = asStr(args.flowId) ?? asStr(args.id) ?? asStr((args as any).dataFlowName) ?? asStr(args.name);
    if (cand) { args.dataFlowId = cand; fixes.push('→dataFlowId'); }
  }
  return fixes.length ? { args, note: `normalized MCP args (${fixes.join(', ')})` } : { args };
}

export function checkDataModelPayload(payload: unknown): string | null {
  const type = asStr(findKey(payload, 'dataModelTypeId'));
  const kind = asStr(findKey(payload, 'dataModelKindId'));
  if (type && !inList(type, MODEL_TYPES)) {
    return `error: invalid dataModelTypeId "${type}". Allowed data-model types are: ${MODEL_TYPES.join(' | ')}. Set dataModelTypeId accordingly and resend.`;
  }
  if (kind && !inList(kind, MODEL_KINDS)) {
    return `error: invalid dataModelKindId "${kind}". Allowed data-model kinds are: Reference | Embeddable | Abstract. Set dataModelKindId accordingly and resend.`;
  }
  return null;
}

/** Heuristic: does the user's goal describe a flow that must be callable as a tool/API? */
export function isCallableToolGoal(text: string): boolean {
  return /\b(mcp tool|as a tool|callable|call this|can call|an? api\b|endpoint|expose|invoke|run (it|this) )/i.test(text || '');
}
