import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { Enterprise } from '../types';
import { TenantConfigurationManager } from '../services/tenantConfigurationManager';
import { TokenStore } from '../services/tokenStore';
import { FuuzMcpClient } from '../services/fuuzMcpClient';
import { ConnectionImporter } from '../services/connectionImporter';
import { TenantDataService } from '../services/tenantDataService';
import { ConnectionHealth } from '../services/connectionHealth';
import { fuuzLog } from '../services/logger';
import type { ConfigInbound, ConfigOutbound, PanelState } from '../webview/config/protocol';

export interface ConfigPanelDeps {
  configManager: TenantConfigurationManager;
  tokenStore: TokenStore;
  mcpClient: FuuzMcpClient;
  connectionImporter: ConnectionImporter;
  resourceService: TenantDataService;
  health: ConnectionHealth;
  /** Called after any mutation so the host can re-register MCP servers etc. */
  onChanged: () => void;
}

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

/**
 * Webview-based configuration UI for Fuuz enterprise/tenant connections.
 * Replaces hand-editing settings.json: add/edit/remove enterprises and tenants,
 * store tokens securely, test connectivity, and pick the active tenant.
 */
export class ConfigPanel {
  private static current: ConfigPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  /** Re-render the panel if it is currently open (e.g. after a command-line change). */
  static refreshIfOpen(): void {
    void ConfigPanel.current?.postState();
  }

  static createOrShow(context: vscode.ExtensionContext, deps: ConfigPanelDeps): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (ConfigPanel.current) {
      ConfigPanel.current.panel.reveal(column);
      void ConfigPanel.current.postState();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'fuuzConfig',
      'Fuuz Connections',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      }
    );
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
    ConfigPanel.current = new ConfigPanel(panel, context, deps);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly deps: ConfigPanelDeps
  ) {
    this.panel = panel;
    this.panel.webview.html = this.html();

    this.panel.webview.onDidReceiveMessage(
      msg => this.handleMessage(msg),
      null,
      this.disposables
    );
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private async handleMessage(msg: ConfigInbound): Promise<void> {
    const { configManager, tokenStore, mcpClient, connectionImporter, onChanged } = this.deps;
    try {
      switch (msg.type) {
        case 'ready':
          await this.postState();
          return;

        case 'addByToken': {
          if (!msg.token?.trim()) return;
          try {
            const result = await connectionImporter.importByToken(msg.token.trim());
            this.applyHealth(result.enterpriseId, result.tenantId, result.probes);
            await configManager.setActiveTenant(result.enterpriseId, result.tenantId);
            // Auto-pull resources from MCP into the Resources view.
            const tenant = configManager.getTenant(result.enterpriseId, result.tenantId);
            if (tenant) {
              await this.deps.resourceService.syncTenantResources(tenant).catch(err => fuuzLog(`config-panel sync failed: ${err instanceof Error ? err.message : String(err)}`));
            }
            onChanged();
            await this.postState();
            await this.post({ type: 'importResult', ok: true, result });
          } catch (err) {
            await this.post({ type: 'importResult', ok: false, message: err instanceof Error ? err.message : String(err) });
          }
          return;
        }

        case 'saveEnterprise': {
          const id: string = msg.id || `ent-${slug(msg.name)}-${Date.now().toString(36)}`;
          const existing = configManager.getEnterprise(id);
          const environment: string | undefined = msg.environment?.trim() || undefined;
          // Keep mcpEndpoint meaningful for the resource tree: derive from the
          // environment slug when one is given and none was set explicitly.
          const mcpEndpoint =
            msg.mcpEndpoint?.trim() ||
            (environment ? `https://api.${environment}.fuuz.app` : existing?.mcpEndpoint || '');
          const enterprise: Enterprise = {
            id,
            name: msg.name,
            environment,
            mcpEndpoint,
            mcpServerUrl: msg.mcpServerUrl?.trim() || undefined,
            flowExecutionUrl: msg.flowExecutionUrl?.trim() || undefined,
            webhookUrl: msg.webhookUrl?.trim() || undefined,
            tenants: existing?.tenants ?? [],
          };
          await configManager.addOrUpdateEnterprise(enterprise);
          break;
        }

        case 'removeEnterprise':
          await configManager.removeEnterprise(msg.id);
          break;

        case 'saveTenant': {
          const tenantId: string = msg.tenantId || `tnt-${slug(msg.name)}-${Date.now().toString(36)}`;
          await configManager.addOrUpdateTenant(
            msg.enterpriseId,
            { id: tenantId, name: msg.name },
            msg.token || undefined
          );
          break;
        }

        case 'removeTenant':
          await configManager.removeTenant(msg.enterpriseId, msg.tenantId);
          break;

        case 'setActive':
          await configManager.setActiveTenant(msg.enterpriseId, msg.tenantId);
          break;

        case 'setDisabled':
          await configManager.setTenantDisabled(msg.enterpriseId, msg.tenantId, !!msg.disabled);
          break;

        case 'replaceKey': {
          const tenant = configManager.getTenant(msg.enterpriseId, msg.tenantId);
          if (!tenant) return;
          const newKey = await vscode.window.showInputBox({
            title: `Replace API key — ${tenant.name}`,
            prompt: 'Paste the new Fuuz API key for this tenant',
            password: true,
            ignoreFocusOut: true,
            validateInput: v => (v.trim() ? undefined : 'An API key is required'),
          });
          if (!newKey) return;
          await tokenStore.setToken(msg.enterpriseId, msg.tenantId, newKey.trim());
          // Re-probe so the user immediately sees whether the new key works,
          // and re-sync resources with the new credential.
          const probes = await mcpClient.probeEndpoints(
            configManager.endpointsFor(configManager.getEnterprise(msg.enterpriseId)!),
            newKey.trim()
          );
          this.applyHealth(msg.enterpriseId, msg.tenantId, probes);
          await this.deps.resourceService.syncTenantResources(tenant).catch(err => fuuzLog(`config-panel sync failed: ${err instanceof Error ? err.message : String(err)}`));
          onChanged();
          await this.postState();
          await this.post({ type: 'probeResult', tenantId: msg.tenantId, probes });
          return;
        }

        case 'setToolEnabled':
          await configManager.setToolEnabled(msg.enterpriseId, msg.tenantId, msg.name, !!msg.enabled);
          break;

        case 'createTool':
          await vscode.commands.executeCommand('fuuz.createTool');
          return;

        case 'test': {
          const enterprise = configManager.getEnterprise(msg.enterpriseId);
          if (!enterprise) return;
          const token = msg.token || (await tokenStore.getToken(msg.enterpriseId, msg.tenantId));
          if (!token) {
            await this.post({ type: 'probeResult', tenantId: msg.tenantId, probes: [], message: 'No token set' });
            return;
          }
          // Probe every endpoint (MCP / flow / webhook) and report each one.
          const probes = await mcpClient.probeEndpoints(configManager.endpointsFor(enterprise), token);
          this.applyHealth(msg.enterpriseId, msg.tenantId, probes);
          await this.post({ type: 'probeResult', tenantId: msg.tenantId, probes });
          return;
        }

        default:
          return;
      }
      onChanged();
      await this.postState();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Fuuz: ${message}`);
      await this.post({ type: 'error', message });
    }
  }

  /** Update connection health from a set of endpoint probes (MCP probe wins). */
  private applyHealth(enterpriseId: string, tenantId: string, probes: any[]): void {
    const mcp = probes.find(p => p.key === 'mcp');
    if (!mcp) return;
    const state = mcp.state === 'available' ? 'ok' : mcp.state === 'unauthorized' || mcp.state === 'forbidden' ? 'unauthorized' : 'unreachable';
    this.deps.health.set(enterpriseId, tenantId, state, mcp.detail);
  }

  private async buildState(): Promise<PanelState> {
    const { configManager, tokenStore } = this.deps;
    const activeEnt = configManager.getActiveEnterprise();
    const activeTen = configManager.getActiveTenant();

    const enterprises = await Promise.all(
      configManager.getEnterprises().map(async e => ({
        id: e.id,
        name: e.name,
        environment: e.environment ?? '',
        mcpEndpoint: e.mcpEndpoint,
        overrides: {
          mcpServerUrl: e.mcpServerUrl ?? '',
          flowExecutionUrl: e.flowExecutionUrl ?? '',
          webhookUrl: e.webhookUrl ?? '',
        },
        endpoints: configManager.endpointsFor(e),
        tenants: await Promise.all(
          e.tenants.map(async t => ({
            id: t.id,
            name: t.name,
            hasToken: await tokenStore.hasToken(e.id, t.id),
            active: activeEnt?.id === e.id && activeTen?.id === t.id,
            disabled: t.disabled === true,
          }))
        ),
      }))
    );

    let activeTools: PanelState['activeTools'];
    if (activeEnt && activeTen) {
      const snapshot = configManager.getCachedResources(activeTen.id);
      const tools = snapshot?.mcp?.tools ?? [];
      if (tools.length) {
        activeTools = {
          enterpriseId: activeEnt.id,
          tenantId: activeTen.id,
          tenantName: activeTen.name,
          items: tools.map((t: any) => ({
            name: t.name,
            description: t.description,
            kind: t.kind,
            enabled: configManager.isToolEnabled(activeEnt.id, activeTen.id, t.name),
          })),
        };
      }
    }

    return { enterprises, activeTools };
  }

  private async postState(): Promise<void> {
    await this.post({ type: 'state', state: await this.buildState() });
  }

  private async post(message: ConfigOutbound): Promise<void> {
    await this.panel.webview.postMessage(message);
  }

  private html(): string {
    const webview = this.panel.webview;
    const nonce = getNonce();
    const asset = (...p: string[]) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', ...p));
    const scriptUri = asset('config', 'config.js');
    const styleUri = asset('config', 'config.css');
    const logoUri = asset('logo-full.png');
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Fuuz Connections</title>
</head>
<body>
  <div id="root" data-logo="${logoUri}"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
  private dispose(): void {
    ConfigPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}

function getNonce(): string {
  return randomBytes(16).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
}
