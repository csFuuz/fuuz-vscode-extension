import * as vscode from 'vscode';
import { Enterprise, EnterpriseEndpoints, Tenant } from '../types';
import { TenantConfigurationManager } from '../services/tenantConfigurationManager';
import { TokenStore } from '../services/tokenStore';
import { FuuzApiClient, ApiResult } from '../services/fuuzApiClient';
import { ConnectionHealth } from '../services/connectionHealth';
import { fuuzChannel } from '../services/logger';
import { isWebflowType } from '../util/fuuzParse';
import { isAbortError } from '../util/abort';

interface RuntimeDeps {
  configManager: TenantConfigurationManager;
  tokenStore: TokenStore;
  apiClient: FuuzApiClient;
  health: ConnectionHealth;
}

interface ActiveContext {
  enterprise: Enterprise;
  tenant: Tenant;
  token: string;
  endpoints: EnterpriseEndpoints;
}

const output = fuuzChannel();

/**
 * Registers the runtime endpoint commands (Execute Flow, Send Webhook, Run
 * GraphQL) that act against the active tenant's enterprise endpoints.
 */
export function registerRuntimeCommands(context: vscode.ExtensionContext, deps: RuntimeDeps): void {
  const { configManager, tokenStore, apiClient } = deps;

  const resolve = async (): Promise<ActiveContext | null> => {
    const enterprise = configManager.getActiveEnterprise();
    const tenant = configManager.getActiveTenant();
    if (!enterprise || !tenant) {
      const pick = await vscode.window.showWarningMessage('Select an active Fuuz tenant first.', 'Select Tenant');
      if (pick) await vscode.commands.executeCommand('fuuz.selectTenant');
      return null;
    }
    const token = await tokenStore.getToken(enterprise.id, tenant.id);
    if (!token) {
      vscode.window.showErrorMessage(`No access token stored for ${tenant.name}. Set one in Fuuz: Configure Connections.`);
      return null;
    }
    return { enterprise, tenant, token, endpoints: configManager.endpointsFor(enterprise) };
  };

  const register = (id: string, fn: (...args: any[]) => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  register('fuuz.executeFlow', async (arg?: unknown) => {
    // Web flows run inside the Fuuz web UI and can't be executed from VS Code.
    const flowNode = (arg as any)?.node ?? (arg as any)?.data;
    if (isWebflowType(flowNode?.type)) {
      vscode.window.showWarningMessage(
        `Fuuz: "${flowNode?.name ?? 'This flow'}" is a web flow and can't be executed from VS Code — run it from the Fuuz web app.`
      );
      return;
    }

    const ctx = await resolve();
    if (!ctx) return;

    const presetFlowId = extractFlowId(arg);
    const flowId = await vscode.window.showInputBox({
      title: 'Execute Fuuz Flow',
      prompt: 'Flow ID',
      value: presetFlowId ?? '',
      ignoreFocusOut: true,
      validateInput: v => (v.trim() ? undefined : 'Flow ID is required'),
    });
    if (!flowId) return;

    const payload = await promptJson('Flow payload (JSON)', '{}');
    if (payload === undefined) return;

    await run(`Executing flow ${flowId}`, `executeFlow ${flowId}`, ctx.endpoints.flowExecution, signal =>
      apiClient.executeFlow(ctx.endpoints, ctx.token, flowId.trim(), payload, signal), ctx, deps.health
    );
  });

  register('fuuz.sendWebhook', async () => {
    const ctx = await resolve();
    if (!ctx) return;

    const topic = await vscode.window.showInputBox({
      title: 'Send Fuuz Webhook',
      prompt: 'Webhook topic (appended to /webhook/post/)',
      placeHolder: 'robot.update',
      ignoreFocusOut: true,
      validateInput: v => (v.trim() ? undefined : 'Topic is required'),
    });
    if (!topic) return;

    const body = await promptJson('Webhook body (JSON)', '{}');
    if (body === undefined) return;

    const url = `${ctx.endpoints.webhook.replace(/\/$/, '')}/${topic.trim().replace(/^\//, '')}`;
    await run(`Sending webhook ${topic}`, `webhook ${topic}`, url, signal =>
      apiClient.sendWebhook(ctx.endpoints, ctx.token, topic.trim(), body, signal), ctx, deps.health
    );
  });
}

/** Run an API call with progress, surface the result, and handle auth failures. */
async function run(
  progressTitle: string,
  label: string,
  url: string,
  call: (signal: AbortSignal) => Promise<ApiResult>,
  ctx?: ActiveContext,
  health?: ConnectionHealth
): Promise<void> {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Fuuz: ${progressTitle}…`, cancellable: true },
    async (_progress, token) => {
      const controller = new AbortController();
      token.onCancellationRequested(() => controller.abort());
      try {
        const result = await call(controller.signal);
        await showResult(label, url, result);
        if (result.status === 401 || result.status === 403) {
          if (ctx && health) health.set(ctx.enterprise.id, ctx.tenant.id, 'unauthorized', `HTTP ${result.status}`);
          const pick = await vscode.window.showWarningMessage(
            `Fuuz: ${label} → HTTP ${result.status} (API key rejected).`,
            'Replace API Key'
          );
          if (pick && ctx) {
            await vscode.commands.executeCommand('fuuz.replaceKey', ctx.enterprise.id, ctx.tenant.id);
          }
        } else if (result.ok) {
          if (ctx && health) health.set(ctx.enterprise.id, ctx.tenant.id, 'ok');
          vscode.window.showInformationMessage(`Fuuz: ${label} → HTTP ${result.status}`);
        } else {
          vscode.window.showWarningMessage(`Fuuz: ${label} → HTTP ${result.status}`);
        }
      } catch (error) {
        if (isAbortError(error)) {
          output.appendLine(`[${label}] cancelled`);
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        output.appendLine(`[${label}] ERROR ${message}`);
        vscode.window.showErrorMessage(`Fuuz: ${label} failed — ${message}`);
      }
    }
  );
}

async function showResult(label: string, url: string, result: ApiResult): Promise<void> {
  output.appendLine(`[${label}] POST ${url} → HTTP ${result.status}`);
  const bodyText = typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2);
  const doc = await vscode.workspace.openTextDocument({
    language: 'json',
    content:
      `// ${label} → POST ${url}\n` +
      `// HTTP ${result.status} ${result.ok ? '(ok)' : '(error)'}\n` +
      bodyText,
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}

/** Prompt for a JSON value; returns parsed value, or undefined if cancelled. */
async function promptJson(prompt: string, defaultValue: string): Promise<unknown | undefined> {
  const raw = await vscode.window.showInputBox({
    title: prompt,
    value: defaultValue,
    ignoreFocusOut: true,
    validateInput: v => {
      if (!v.trim()) return undefined;
      try {
        JSON.parse(v);
        return undefined;
      } catch {
        return 'Must be valid JSON';
      }
    },
  });
  if (raw === undefined) return undefined;
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Pull a flow id from a resource-tree item (`node`), a string arg, or nothing. */
function extractFlowId(arg: unknown): string | undefined {
  if (typeof arg === 'string') return arg;
  const node = (arg as any)?.node ?? (arg as any)?.data;
  return node?.id ? String(node.id) : undefined;
}
