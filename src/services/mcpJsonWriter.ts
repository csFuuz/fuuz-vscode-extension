import * as vscode from 'vscode';
import { TenantConfigurationManager } from './tenantConfigurationManager';
import { parseJsonc } from '../util/jsonc';

/**
 * `readExisting` outcome: a missing file degrades to `{}` (a fresh write is safe),
 * a parsed object is merged into, and an unparseable-but-present file returns
 * `null` so `sync()` can ABORT rather than clobber the user's other MCP servers.
 */
type ExistingConfig = Record<string, any> | null;

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
    if (existing === null) {
      // Present but unparseable (and not recoverable as JSONC) — do NOT overwrite:
      // a blind write would wipe the user's other MCP servers/inputs.
      vscode.window.showWarningMessage(
        `Fuuz: ${vscode.workspace.asRelativePath(uri, false)} isn't valid JSON — left untouched. Fix or remove it, then write the MCP config again.`
      );
      return null;
    }
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

  /**
   * Read the existing `mcp.json`, distinguishing a missing file (→ `{}`, safe to
   * create fresh) from a present-but-unparseable one (→ `null`, must not be
   * overwritten). Comment/trailing-comma-bearing JSONC is tolerated so such files
   * merge instead of erroring.
   */
  private async readExisting(uri: vscode.Uri): Promise<ExistingConfig> {
    let text: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      text = Buffer.from(bytes).toString('utf8');
    } catch (err) {
      // Missing file → fresh write is safe. Any other read error is unexpected;
      // treat as "leave it alone" to be conservative.
      if (err instanceof vscode.FileSystemError && err.code === 'FileNotFound') return {};
      return null; // unreadable for some other reason → don't overwrite
    }
    if (!text.trim()) return {};
    try {
      const parsed = parseJsonc(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null; // present but unparseable → caller aborts
    }
  }
}
