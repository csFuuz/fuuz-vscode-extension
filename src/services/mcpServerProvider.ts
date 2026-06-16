import * as vscode from 'vscode';
import { TenantConfigurationManager } from './tenantConfigurationManager';
import { TokenStore } from './tokenStore';

type FuuzServerDef = vscode.McpHttpServerDefinition | vscode.McpStdioServerDefinition;

/**
 * Contributes Fuuz MCP servers to VS Code so the developer's AI copilot
 * (Copilot Chat / agent mode) can discover and call into each configured Fuuz
 * tenant over the Model Context Protocol.
 *
 * One server is published per tenant with a stored token. When a tenant has
 * **disabled tools**, it is registered via a local stdio **gating proxy**
 * (`proxy/mcp-proxy.js`) that strips disabled tools from `tools/list` and
 * rejects `tools/call` for them — so the deny-list is actually enforced, not
 * just advisory. Otherwise it registers directly as an HTTP server. The token
 * is supplied at provision time from SecretStorage; it is never written to
 * settings or `.vscode/mcp.json`.
 */
export class FuuzMcpServerProvider implements vscode.McpServerDefinitionProvider<FuuzServerDef> {
  /** Must match the id declared in package.json `mcpServerDefinitionProviders`. */
  static readonly PROVIDER_ID = 'fuuz';

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeMcpServerDefinitions = this._onDidChange.event;

  constructor(
    private readonly configManager: TenantConfigurationManager,
    private readonly tokenStore: TokenStore,
    private readonly extensionUri: vscode.Uri
  ) {}

  /** Notify VS Code that the set of servers (or their auth) has changed. */
  refresh(): void {
    this._onDidChange.fire();
  }

  private get proxyPath(): string {
    return vscode.Uri.joinPath(this.extensionUri, 'proxy', 'mcp-proxy.js').fsPath;
  }

  async provideMcpServerDefinitions(): Promise<FuuzServerDef[]> {
    const definitions: FuuzServerDef[] = [];
    const activeEnterprise = this.configManager.getActiveEnterprise();
    const activeTenant = this.configManager.getActiveTenant();

    for (const enterprise of this.configManager.getEnterprises()) {
      const serverUrl = this.configManager.getMcpServerUrl(enterprise);
      for (const tenant of enterprise.tenants) {
        if (tenant.disabled) {
          continue; // disabled connection → keep config but don't register
        }
        const token = await this.tokenStore.getToken(enterprise.id, tenant.id);
        if (!token) {
          continue; // no credential → don't surface a server that can't connect
        }

        const isActive = activeEnterprise?.id === enterprise.id && activeTenant?.id === tenant.id;
        const disabledTools = tenant.disabledTools ?? [];
        const label = `Fuuz: ${enterprise.name} › ${tenant.name}${isActive ? ' (active)' : ''}`;

        if (disabledTools.length > 0) {
          // Route through the local gating proxy so the deny-list is enforced.
          definitions.push(
            new vscode.McpStdioServerDefinition(label, process.execPath, [this.proxyPath], {
              ELECTRON_RUN_AS_NODE: '1',
              FUUZ_MCP_URL: serverUrl,
              FUUZ_TOKEN: token,
              FUUZ_DISABLED_TOOLS: disabledTools.join(','),
            })
          );
        } else {
          definitions.push(
            new vscode.McpHttpServerDefinition(label, vscode.Uri.parse(serverUrl), {
              'Authorization': `Bearer ${token}`,
              'X-Fuuz-Tenant': tenant.id,
            })
          );
        }
      }
    }

    return definitions;
  }

  /**
   * Called lazily right before VS Code starts a server. Re-reads the token so a
   * rotated credential is picked up without a window reload (HTTP servers only;
   * stdio proxy servers receive the token via env at provision time).
   */
  async resolveMcpServerDefinition(server: FuuzServerDef): Promise<FuuzServerDef> {
    if (!(server instanceof vscode.McpHttpServerDefinition)) {
      return server;
    }
    for (const enterprise of this.configManager.getEnterprises()) {
      for (const tenant of enterprise.tenants) {
        const label = `Fuuz: ${enterprise.name} › ${tenant.name}`;
        if (server.label.startsWith(label)) {
          const token = await this.tokenStore.getToken(enterprise.id, tenant.id);
          if (token) {
            server.headers['Authorization'] = `Bearer ${token}`;
          }
          return server;
        }
      }
    }
    return server;
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
