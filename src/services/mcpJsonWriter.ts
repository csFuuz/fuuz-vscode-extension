import * as vscode from 'vscode';
import { TenantConfigurationManager } from './tenantConfigurationManager';

/**
 * Writes / maintains `.vscode/mcp.json` for the open workspace so the Fuuz MCP
 * servers are discoverable by Copilot even outside this extension (and on hosts
 * without the runtime MCP API). Tokens are NOT written: each server references
 * a password `${input:...}` prompt, so the secret stays out of source control.
 *
 * Only `fuuz-*` entries are managed; any other servers/inputs in the file are
 * preserved untouched.
 */
export class McpJsonWriter {
  constructor(private readonly configManager: TenantConfigurationManager) {}

  private get fileUri(): vscode.Uri | null {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return null;
    return vscode.Uri.joinPath(folder.uri, '.vscode', 'mcp.json');
  }

  /** True when there is a workspace folder to write into. */
  get canWrite(): boolean {
    return this.fileUri !== null;
  }

  async sync(): Promise<vscode.Uri | null> {
    const uri = this.fileUri;
    if (!uri) return null;

    const existing = await this.readExisting(uri);
    const inputs: any[] = Array.isArray(existing.inputs)
      ? existing.inputs.filter((i: any) => !String(i?.id ?? '').startsWith('fuuz-token-'))
      : [];
    const servers: Record<string, any> = {};
    for (const [key, value] of Object.entries(existing.servers ?? {})) {
      if (!key.startsWith('fuuz-')) servers[key] = value;
    }

    for (const enterprise of this.configManager.getEnterprises()) {
      const url = this.configManager.getMcpServerUrl(enterprise);
      for (const tenant of enterprise.tenants) {
        if (tenant.disabled) continue;
        const inputId = `fuuz-token-${enterprise.id}-${tenant.id}`;
        inputs.push({
          type: 'promptString',
          id: inputId,
          description: `Fuuz access token for ${enterprise.name} › ${tenant.name}`,
          password: true,
        });
        servers[`fuuz-${enterprise.id}-${tenant.id}`] = {
          type: 'http',
          url,
          headers: {
            'Authorization': `Bearer \${input:${inputId}}`,
            'X-Fuuz-Tenant': tenant.id,
          },
        };
      }
    }

    const out = { ...existing, inputs, servers };
    const body = Buffer.from(JSON.stringify(out, null, 2) + '\n', 'utf8');
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
    await vscode.workspace.fs.writeFile(uri, body);
    return uri;
  }

  private async readExisting(uri: vscode.Uri): Promise<any> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
