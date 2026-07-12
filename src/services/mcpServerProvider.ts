import * as vscode from 'vscode';
import { TenantConfigurationManager } from './tenantConfigurationManager';
import { TokenStore } from './tokenStore';

/**
 * Contributes Fuuz MCP servers to VS Code so the developer's AI copilot
 * (Copilot Chat / agent mode) can discover and call into each configured Fuuz
 * tenant over the Model Context Protocol.
 *
 * One server is published per tenant, registered directly as a streamable-HTTP
 * server with the SecretStorage token supplied at provision time (never written
 * to settings or `.vscode/mcp.json`). The former stdio gating proxy — which
 * enforced a per-tenant disabled-tools deny-list — has been removed.
 */
export class FuuzMcpServerProvider implements vscode.McpServerDefinitionProvider<vscode.McpHttpServerDefinition> {
  /** Must match the id declared in package.json `mcpServerDefinitionProviders`. */
  static readonly PROVIDER_ID = 'fuuz';

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeMcpServerDefinitions = this._onDidChange.event;

  constructor(
    private readonly configManager: TenantConfigurationManager,
    private readonly tokenStore: TokenStore
  ) {}

  /** Notify VS Code that the set of servers (or their auth) has changed. */
  refresh(): void {
    this._onDidChange.fire();
  }

  async provideMcpServerDefinitions(): Promise<vscode.McpHttpServerDefinition[]> {
    const definitions: vscode.McpHttpServerDefinition[] = [];
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
        const label = `Fuuz: ${enterprise.name} › ${tenant.name}${isActive ? ' (active)' : ''}`;
        definitions.push(
          new vscode.McpHttpServerDefinition(label, vscode.Uri.parse(serverUrl), {
            'Authorization': `Bearer ${token}`,
            'X-Fuuz-Tenant': tenant.id,
          })
        );
      }
    }

    return definitions;
  }

  /**
   * Called lazily right before VS Code starts a server. Re-reads the token so a
   * rotated credential is picked up without a window reload.
   */
  async resolveMcpServerDefinition(server: vscode.McpHttpServerDefinition): Promise<vscode.McpHttpServerDefinition> {
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
