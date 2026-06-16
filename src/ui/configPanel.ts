import * as vscode from 'vscode';
import { Enterprise } from '../types';
import { TenantConfigurationManager } from '../services/tenantConfigurationManager';
import { TokenStore } from '../services/tokenStore';
import { FuuzMcpClient } from '../services/fuuzMcpClient';
import { ConnectionImporter } from '../services/connectionImporter';
import { TenantDataService } from '../services/tenantDataService';
import { ConnectionHealth } from '../services/connectionHealth';

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

/** State sent to the webview — never includes raw tokens, only presence flags. */
interface PanelState {
  enterprises: Array<{
    id: string;
    name: string;
    environment: string;
    mcpEndpoint: string;
    overrides: { mcpServerUrl: string; flowExecutionUrl: string; webhookUrl: string };
    endpoints: { apiBase: string; mcp: string; flowExecution: string; webhook: string };
    tenants: Array<{ id: string; name: string; hasToken: boolean; active: boolean; disabled: boolean }>;
  }>;
  /** Agent tools for the active tenant (from the last MCP sync). */
  activeTools?: {
    enterpriseId: string;
    tenantId: string;
    tenantName: string;
    items: Array<{ name: string; description?: string; kind: string; enabled: boolean }>;
  };
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

  private async handleMessage(msg: any): Promise<void> {
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
              await this.deps.resourceService.syncTenantResources(tenant).catch(() => undefined);
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
          await this.deps.resourceService.syncTenantResources(tenant).catch(() => undefined);
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

  private async post(message: any): Promise<void> {
    await this.panel.webview.postMessage(message);
  }

  private html(): string {
    const webview = this.panel.webview;
    const nonce = getNonce();
    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'logo-full.png')
    );
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
  <title>Fuuz Connections</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 24px 48px; }
    header { display: flex; align-items: center; gap: 14px; padding: 20px 0; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 20px; }
    header img { height: 28px; }
    header .sub { color: var(--vscode-descriptionForeground); font-size: 12px; }
    h1 { font-size: 16px; margin: 0; }
    h2 { font-size: 14px; margin: 0; }
    .card { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 16px; margin-bottom: 16px; }
    .ent-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .muted { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 6px 0; }
    label { font-size: 12px; display: block; margin: 8px 0 3px; color: var(--vscode-descriptionForeground); }
    input { width: 100%; box-sizing: border-box; padding: 5px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 3px; }
    button { padding: 5px 12px; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    button.danger { background: transparent; color: var(--vscode-errorForeground); }
    .tenant { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-top: 1px solid var(--vscode-panel-border); flex-wrap: wrap; }
    .tenant.off .name { opacity: 0.55; text-decoration: line-through; }
    .tenant .name { font-weight: 600; }
    .badge { font-size: 10px; padding: 1px 6px; border-radius: 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .active { background: var(--vscode-testing-iconPassed, #2ea043); color: #fff; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .spacer { flex: 1; }
    .status { font-size: 11px; margin-left: 6px; }
    .ok { color: var(--vscode-testing-iconPassed, #2ea043); }
    .fail { color: var(--vscode-errorForeground); }
    .empty { color: var(--vscode-descriptionForeground); padding: 24px 0; }
    table.endpoints { width: 100%; border-collapse: collapse; margin: 4px 0 10px; font-size: 12px; }
    table.endpoints td { padding: 2px 8px 2px 0; vertical-align: top; }
    table.endpoints td:first-child { color: var(--vscode-descriptionForeground); white-space: nowrap; width: 110px; }
    table.endpoints td:last-child { font-family: var(--vscode-editor-font-family, monospace); word-break: break-all; }
    .probes { display: inline-flex; gap: 4px; flex-wrap: wrap; }
    .ep { font-size: 10px; padding: 1px 6px; border-radius: 8px; border: 1px solid var(--vscode-panel-border); cursor: help; }
    .ep.ok { color: var(--vscode-testing-iconPassed, #2ea043); }
    .ep.fail { color: var(--vscode-errorForeground); }
    details > summary { cursor: pointer; margin-top: 10px; font-size: 12px; color: var(--vscode-textLink-foreground); }
    .form-actions { margin-top: 10px; display: flex; gap: 8px; }
  </style>
</head>
<body>
  <header>
    <img src="${logoUri}" alt="Fuuz" />
    <div>
      <h1>Connections</h1>
      <div class="sub">Configure enterprises &amp; tenants. Tokens are stored securely and registered as MCP servers for your AI copilot.</div>
    </div>
  </header>
  <div id="app"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = { enterprises: [] };
    const probeStatus = {}; // tenantId -> { probes:[], message? }

    function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
    function send(msg) { vscode.postMessage(msg); }

    function render() {
      const app = document.getElementById('app');
      app.innerHTML = '';
      app.appendChild(addByKeyCard());
      for (const e of state.enterprises) app.appendChild(enterpriseCard(e));
      if (state.activeTools) app.appendChild(agentToolsCard(state.activeTools));
      app.appendChild(addEnterpriseCard());
    }

    function agentToolsCard(at) {
      const card = document.createElement('div');
      card.className = 'card';
      const rows = at.items.map(t => {
        const cls = t.kind === 'dataflow' ? 'badge active' : 'badge';
        return \`<div class="tenant\${t.enabled ? '' : ' off'}">
          <span class="name">\${esc(t.name)}</span>
          <span class="\${cls}">\${t.kind === 'dataflow' ? 'custom' : 'system'}</span>
          <span class="muted" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${esc(t.description || '')}</span>
          <button class="secondary" data-act="toggleTool" data-name="\${esc(t.name)}" data-ent="\${esc(at.enterpriseId)}" data-id="\${esc(at.tenantId)}" data-enabled="\${t.enabled ? '0' : '1'}">\${t.enabled ? 'Disable' : 'Enable'}</button>
        </div>\`;
      }).join('');
      card.innerHTML = \`
        <div class="ent-head">
          <div>
            <h2>Agent Tools — \${esc(at.tenantName)}</h2>
            <div class="muted">Tools the MCP server exposes to agents. Disable any you don't want agents to use.</div>
          </div>
          <button data-act="createTool">+ Create New Tool</button>
        </div>
        <div class="muted" style="margin:6px 0">Disabling re-registers this connection through a local <b>gating proxy</b> that hides the tool from <code>tools/list</code> and blocks calls to it — enforced, not just advisory. (Reload the MCP server / window to apply.)</div>
        \${rows || '<div class="muted">No tools — sync the tenant first.</div>'}\`;
      return card;
    }

    function addByKeyCard() {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = \`
        <h2>Add a connection</h2>
        <div class="muted">Paste an API key — the tenant, enterprise and environment are detected from it, and every endpoint is tested.</div>
        <label>API key</label>
        <input id="byKeyToken" type="password" placeholder="eyJhbGciOi…" />
        <div class="form-actions"><button id="byKeyBtn">Add &amp; test</button></div>
        <div id="byKeyResult"></div>\`;
      return card;
    }

    function probeBadges(probes) {
      return probes.map(p => {
        const ok = p.state === 'available';
        // Tooltip shows the exact endpoint URL that was checked + the result.
        const title = esc(p.url + '\\n→ ' + (p.detail || p.state) + (p.status ? ' (HTTP ' + p.status + ')' : ''));
        return '<span class="ep ' + (ok ? 'ok' : 'fail') + '" title="' + title + '">' + esc(p.label) + ' ' + (ok ? '✓' : '✗') + '</span>';
      }).join(' ');
    }

    function enterpriseCard(e) {
      const card = document.createElement('div');
      card.className = 'card';
      const tenants = e.tenants.map(t => tenantRow(e, t)).join('');
      const ep = e.endpoints;
      card.innerHTML = \`
        <div class="ent-head">
          <div>
            <h2>\${esc(e.name)}</h2>
            <div class="muted">\${e.environment ? 'env: ' + esc(e.environment) : 'no environment set'}</div>
          </div>
          <button class="danger" data-act="removeEnt" data-id="\${esc(e.id)}">Remove</button>
        </div>
        <table class="endpoints">
          <tr><td>MCP</td><td>\${esc(ep.mcp)}</td></tr>
          <tr><td>Flow execution</td><td>\${esc(ep.flowExecution)}</td></tr>
          <tr><td>Webhook</td><td>\${esc(ep.webhook)}<span class="muted">{topic}</span></td></tr>
        </table>
        <div class="tenants">\${tenants || '<div class="muted" style="padding:8px 0">No tenants yet.</div>'}</div>
        <details>
          <summary>+ Add tenant</summary>
          <div class="grid2">
            <div><label>Tenant name</label><input data-f="tname" data-ent="\${esc(e.id)}" placeholder="Production" /></div>
            <div><label>Access token</label><input data-f="ttoken" data-ent="\${esc(e.id)}" type="password" placeholder="fuuz_pat_…" /></div>
          </div>
          <div class="form-actions"><button data-act="addTenant" data-id="\${esc(e.id)}">Save tenant</button></div>
        </details>
        <details>
          <summary>Edit environment &amp; endpoints</summary>
          <label>Environment slug — the {env}.{account} part of api.&lt;slug&gt;.fuuz.app</label>
          <input data-f="eEnv" data-ent="\${esc(e.id)}" value="\${esc(e.environment)}" placeholder="build.mfgx" />
          <label>MCP server URL (override)</label>
          <input data-f="eMcp" data-ent="\${esc(e.id)}" value="\${esc(e.overrides.mcpServerUrl)}" placeholder="\${esc(ep.mcp)}" />
          <label>Flow execution URL (override)</label>
          <input data-f="eFlow" data-ent="\${esc(e.id)}" value="\${esc(e.overrides.flowExecutionUrl)}" placeholder="\${esc(ep.flowExecution)}" />
          <label>Webhook base URL (override)</label>
          <input data-f="eHook" data-ent="\${esc(e.id)}" value="\${esc(e.overrides.webhookUrl)}" placeholder="\${esc(ep.webhook)}" />
          <div class="form-actions"><button data-act="saveEnt" data-id="\${esc(e.id)}" data-name="\${esc(e.name)}">Save</button></div>
        </details>\`;
      return card;
    }

    function tenantRow(e, t) {
      const st = probeStatus[t.id];
      const statusHtml = st
        ? (st.message ? '<span class="status fail">' + esc(st.message) + '</span>' : '<span class="probes">' + probeBadges(st.probes) + '</span>')
        : '';
      const ds = 'data-ent="'+esc(e.id)+'" data-id="'+esc(t.id)+'"';
      return \`<div class="tenant\${t.disabled ? ' off' : ''}">
        <span class="name">\${esc(t.name)}</span>
        \${t.active && !t.disabled ? '<span class="badge active">active</span>' : ''}
        \${t.disabled ? '<span class="badge">disabled</span>' : ''}
        \${t.hasToken ? '<span class="badge">token set</span>' : '<span class="badge">no token</span>'}
        \${statusHtml}
        <span class="spacer"></span>
        \${(!t.active && !t.disabled) ? '<button class="secondary" data-act="setActive" '+ds+'>Set active</button>' : ''}
        <button class="secondary" data-act="test" \${ds}>Test</button>
        <button class="secondary" data-act="replaceKey" \${ds}>Replace key</button>
        <button class="secondary" data-act="toggleDisabled" data-disabled="\${t.disabled ? '0' : '1'}" \${ds}>\${t.disabled ? 'Enable' : 'Disable'}</button>
        <button class="danger" data-act="removeTenant" \${ds}>✕</button>
      </div>\`;
    }

    function addEnterpriseCard() {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = \`
        <h2>Add enterprise</h2>
        <div class="grid2">
          <div><label>Name</label><input id="newEntName" placeholder="ACME Corporation" /></div>
          <div><label>Environment slug</label><input id="newEntEnv" placeholder="build.mfgx" /></div>
        </div>
        <div class="muted">All endpoints derive from <code>https://api.&lt;slug&gt;.fuuz.app</code> — flow execution, webhook, graphql and mcp.</div>
        <div class="form-actions"><button id="addEntBtn">Add enterprise</button></div>\`;
      return card;
    }

    document.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-act], #addEntBtn, #byKeyBtn');
      if (!el) return;
      if (el.id === 'byKeyBtn') {
        const token = document.getElementById('byKeyToken').value.trim();
        if (!token) return;
        document.getElementById('byKeyResult').innerHTML = '<span class="muted">Validating…</span>';
        send({ type: 'addByToken', token });
        return;
      }
      if (el.id === 'addEntBtn') {
        const name = document.getElementById('newEntName').value.trim();
        const environment = document.getElementById('newEntEnv').value.trim();
        if (!name || !environment) return;
        send({ type: 'saveEnterprise', name, environment });
        return;
      }
      const act = el.getAttribute('data-act');
      const id = el.getAttribute('data-id');
      const ent = el.getAttribute('data-ent');
      if (act === 'createTool') { send({ type: 'createTool' }); return; }
      if (act === 'toggleTool') {
        send({ type: 'setToolEnabled', enterpriseId: ent, tenantId: id, name: el.getAttribute('data-name'), enabled: el.getAttribute('data-enabled') === '1' });
        return;
      }
      if (act === 'removeEnt') send({ type: 'removeEnterprise', id });
      else if (act === 'removeTenant') send({ type: 'removeTenant', enterpriseId: ent, tenantId: id });
      else if (act === 'setActive') send({ type: 'setActive', enterpriseId: ent, tenantId: id });
      else if (act === 'replaceKey') send({ type: 'replaceKey', enterpriseId: ent, tenantId: id });
      else if (act === 'toggleDisabled') send({ type: 'setDisabled', enterpriseId: ent, tenantId: id, disabled: el.getAttribute('data-disabled') === '1' });
      else if (act === 'test') {
        const tokenInput = document.querySelector('[data-f="ttoken"][data-ent="'+ent+'"]');
        send({ type: 'test', enterpriseId: ent, tenantId: id, token: tokenInput ? tokenInput.value : '' });
      }
      else if (act === 'addTenant') {
        const name = document.querySelector('[data-f="tname"][data-ent="'+id+'"]').value.trim();
        const token = document.querySelector('[data-f="ttoken"][data-ent="'+id+'"]').value;
        if (!name) return;
        send({ type: 'saveTenant', enterpriseId: id, name, token });
      }
      else if (act === 'saveEnt') {
        const val = (f) => document.querySelector('[data-f="'+f+'"][data-ent="'+id+'"]').value.trim();
        send({
          type: 'saveEnterprise',
          id,
          name: el.getAttribute('data-name'),
          environment: val('eEnv'),
          mcpServerUrl: val('eMcp'),
          flowExecutionUrl: val('eFlow'),
          webhookUrl: val('eHook'),
        });
      }
    });

    window.addEventListener('message', (ev) => {
      const m = ev.data;
      if (m.type === 'state') { state = m.state; render(); }
      else if (m.type === 'probeResult') {
        probeStatus[m.tenantId] = { probes: m.probes || [], message: m.message };
        render();
      } else if (m.type === 'importResult') {
        const box = document.getElementById('byKeyResult');
        if (!box) return;
        if (m.ok) {
          const r = m.result;
          box.innerHTML = '<div class="ok">Added ' + esc(r.enterpriseName) + ' › ' + esc(r.tenantName) +
            '</div><div class="probes">' + probeBadges(r.probes) + '</div>';
          probeStatus[r.tenantId] = { probes: r.probes };
          const inp = document.getElementById('byKeyToken'); if (inp) inp.value = '';
        } else {
          box.innerHTML = '<div class="fail">' + esc(m.message) + '</div>';
        }
      }
    });

    send({ type: 'ready' });
  </script>
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
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
