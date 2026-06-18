import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { TenantConfigurationManager } from './tenantConfigurationManager';
import { TokenStore } from './tokenStore';
import { Enterprise, Tenant } from '../types';
import { applyFuuzServers, ensureDir, readJsonFile, serializeConfig, writeFileAtomic } from '../util/claudeConfig';

/** A Claude client we can write MCP configuration into. */
export type ClaudeTarget = 'project' | 'user' | 'desktop';

/** How a target supplies the token: embed the real secret, or reference an env var. */
type TokenMode = 'embed' | 'envref';

/** One Fuuz MCP server we intend to register, plus how its token is referenced. */
export interface PlannedClaudeServer {
  enterpriseId: string;
  tenantId: string;
  enterpriseName: string;
  tenantName: string;
  /** `fuuz-{enterprise}-{tenant}` — the managed key in every Claude config. */
  serverKey: string;
  /** Env var the user exports when the token isn't embedded (project scope only). */
  envVar: string;
  /** Streamable-HTTP MCP endpoint for the tenant's enterprise. */
  url: string;
  disabledTools: string[];
}

export interface ClaudeTargetResult {
  target: ClaudeTarget;
  /** Absolute path written, or null when the target wasn't applicable. */
  path: string | null;
  servers: string[];
  /** Embed targets where no token was stored, so the server was skipped. */
  missingToken: string[];
  /** Whether this target referenced env vars (project) vs embedded the token. */
  tokenMode: TokenMode;
  /** Populated instead of `path` when the target couldn't be written. */
  skipped?: string;
  /** True when the file was already up to date and left untouched. */
  unchanged?: boolean;
}

/**
 * Writes Fuuz MCP server entries into the config files that **Claude** reads —
 * Claude Code (project `.mcp.json` and user `~/.claude.json`) and Claude Desktop
 * (`claude_desktop_config.json`). VS Code's `registerMcpServerDefinitionProvider`
 * only surfaces servers to VS Code's own Copilot; Claude never sees it, so the
 * servers must be materialized into Claude's own config to make Fuuz reachable.
 *
 * **Token handling differs by scope:**
 * - **project** `.mcp.json` may be committed, so the token is **never embedded** —
 *   entries reference `Bearer ${FUUZ_TOKEN_…}` (the user exports the var).
 * - **user** (`~/.claude.json`) and **Claude Desktop** live in the private home
 *   dir (mode 600) and are never committed, so the live token is **embedded**
 *   directly — exactly like every other MCP server stores its auth. This is what
 *   makes auto-registration zero-friction: connect a key and Claude can use it.
 *
 * Only `fuuz-*` server keys are managed; any other servers or settings in the
 * files are read, preserved, and written back untouched. {@link scheduleAutoSync}
 * keeps the embed targets in sync as connections/tokens change.
 */
export class ClaudeMcpWriter {
  private autoSyncTimer?: ReturnType<typeof setTimeout>;
  /** Serializes writes so overlapping triggers can't interleave file edits. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly configManager: TenantConfigurationManager,
    private readonly tokenStore: TokenStore,
    private readonly extensionUri: vscode.Uri
  ) {}

  private get proxyPath(): string {
    return vscode.Uri.joinPath(this.extensionUri, 'proxy', 'mcp-proxy.js').fsPath;
  }

  /** The shell env var name a user exports to provide a tenant's token. */
  envVarFor(enterprise: Enterprise, tenant: Tenant): string {
    return `FUUZ_TOKEN_${enterprise.id}_${tenant.id}`.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  }

  /** Project scope might be committed → env-ref; private home-dir scopes embed. */
  private tokenModeFor(target: ClaudeTarget): TokenMode {
    return target === 'project' ? 'envref' : 'embed';
  }

  /** Enabled tenants we will register (mirrors the VS Code provider's filter). */
  plannedServers(): PlannedClaudeServer[] {
    const planned: PlannedClaudeServer[] = [];
    for (const enterprise of this.configManager.getEnterprises()) {
      const url = this.configManager.getMcpServerUrl(enterprise);
      for (const tenant of enterprise.tenants) {
        if (tenant.disabled) continue; // keep config but don't register
        planned.push({
          enterpriseId: enterprise.id,
          tenantId: tenant.id,
          enterpriseName: enterprise.name,
          tenantName: tenant.name,
          serverKey: `fuuz-${enterprise.id}-${tenant.id}`,
          envVar: this.envVarFor(enterprise, tenant),
          url,
          disabledTools: tenant.disabledTools ?? [],
        });
      }
    }
    return planned;
  }

  /** Config file path for a target, or null if it can't be resolved on this host. */
  pathFor(target: ClaudeTarget): string | null {
    switch (target) {
      case 'project': {
        const folder = vscode.workspace.workspaceFolders?.[0];
        return folder ? path.join(folder.uri.fsPath, '.mcp.json') : null;
      }
      case 'user':
        return path.join(os.homedir(), '.claude.json');
      case 'desktop':
        return claudeDesktopConfigPath();
    }
  }

  async sync(targets: ClaudeTarget[]): Promise<ClaudeTargetResult[]> {
    const servers = this.plannedServers();

    // Pre-fetch tokens once if any target embeds them.
    const tokens = new Map<string, string | undefined>();
    if (targets.some(t => this.tokenModeFor(t) === 'embed')) {
      for (const s of servers) {
        tokens.set(s.serverKey, await this.tokenStore.getToken(s.enterpriseId, s.tenantId));
      }
    }

    // Resolve a node binary once, only if a stdio entry will actually be emitted.
    const needsNode = targets.includes('desktop') || servers.some(s => s.disabledTools.length > 0);
    const nodePath = needsNode ? await resolveNodePath() : 'node';

    const results: ClaudeTargetResult[] = [];
    for (const target of targets) {
      results.push(await this.syncTarget(target, servers, tokens, nodePath));
    }
    return results;
  }

  private async syncTarget(
    target: ClaudeTarget,
    servers: PlannedClaudeServer[],
    tokens: Map<string, string | undefined>,
    nodePath: string
  ): Promise<ClaudeTargetResult> {
    const mode = this.tokenModeFor(target);
    const file = this.pathFor(target);
    if (!file) {
      const skipped =
        target === 'project' ? 'no workspace folder is open' : 'config location unavailable on this OS';
      return { target, path: null, servers: [], missingToken: [], tokenMode: mode, skipped };
    }

    // Claude Code understands HTTP + `${VAR}`, so it gets HTTP entries directly
    // (the stdio proxy is only used to enforce a deny-list). Desktop can't talk
    // HTTP from its file config, so it always runs the proxy.
    const asHttp = target !== 'desktop';
    const config = await readJsonFile(file);
    if (config === null) {
      return {
        target,
        path: null,
        servers: [],
        missingToken: [],
        tokenMode: mode,
        skipped: `${file} is not valid JSON — left untouched`,
      };
    }

    // Build the fuuz-* entries we want present, tracking tokens we couldn't embed.
    const entries: Record<string, any> = {};
    const written: string[] = [];
    const missingToken: string[] = [];
    for (const s of servers) {
      let token: string | undefined;
      if (mode === 'embed') {
        token = tokens.get(s.serverKey);
        if (!token) {
          // Can't embed a token we don't have — skip rather than write a dead entry.
          missingToken.push(s.serverKey);
          continue;
        }
      }
      entries[s.serverKey] =
        asHttp && s.disabledTools.length === 0
          ? this.httpEntry(s, token)
          : this.stdioEntry(s, nodePath, token);
      written.push(s.serverKey);
    }

    const hadFuuzEntries = isFuuzPresent(config);

    // Nothing to register and nothing of ours to clean up → don't touch the file
    // at all. This is the "extension installed but never configured" case; we must
    // not reformat (or risk racing on) a file we have no business rewriting.
    if (written.length === 0 && !hadFuuzEntries) {
      return { target, path: file, servers: [], missingToken, tokenMode: mode, unchanged: true };
    }

    applyFuuzServers(config, entries);
    const next = serializeConfig(config);

    // Skip the write entirely when nothing changed. This is the common case on
    // startup and on unrelated `fuuz.*` config changes; rewriting `~/.claude.json`
    // unnecessarily churns a file Claude itself owns and widens the race window
    // against Claude's own writes.
    const current = await fs.readFile(file, 'utf8').catch(() => undefined);
    if (current === next) {
      return { target, path: file, servers: written, missingToken, tokenMode: mode, unchanged: true };
    }

    await ensureDir(file);
    await writeFileAtomic(file, next);
    return { target, path: file, servers: written, missingToken, tokenMode: mode };
  }

  /** HTTP entry. Embeds the real token when given; otherwise references the env var. */
  private httpEntry(s: PlannedClaudeServer, token?: string): Record<string, any> {
    const bearer = token ? `Bearer ${token}` : `Bearer \${${s.envVar}}`;
    return {
      type: 'http',
      url: s.url,
      headers: { Authorization: bearer, 'X-Fuuz-Tenant': s.tenantId },
    };
  }

  /** Stdio-proxy entry. Passes the token directly when embedding, else by indirection. */
  private stdioEntry(s: PlannedClaudeServer, nodePath: string, token?: string): Record<string, any> {
    const env: Record<string, string> = { FUUZ_MCP_URL: s.url };
    if (token) {
      env.FUUZ_TOKEN = token;
    } else {
      // The proxy reads the secret from this env var at launch (no secret on disk).
      env.FUUZ_TOKEN_ENV = s.envVar;
    }
    if (s.disabledTools.length > 0) env.FUUZ_DISABLED_TOOLS = s.disabledTools.join(',');
    return { command: nodePath, args: [this.proxyPath], env };
  }

  // --- Auto-registration -----------------------------------------------------

  /** Targets kept in sync automatically, per the `fuuz.claudeAutoRegister` setting. */
  private autoTargets(): ClaudeTarget[] {
    const mode = vscode.workspace
      .getConfiguration('fuuz')
      .get<string>('claudeAutoRegister', 'userAndDesktop');
    if (mode === 'off') return [];
    if (mode === 'user') return ['user'];
    return ['user', 'desktop'];
  }

  /** Debounced auto-sync of the embed targets; collapses bursts of changes. */
  scheduleAutoSync(): void {
    if (this.autoTargets().length === 0) return;
    if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
    this.autoSyncTimer = setTimeout(() => {
      this.autoSyncTimer = undefined;
      this.chain = this.chain
        .then(() => this.sync(this.autoTargets()))
        .catch(err => console.error('Fuuz: auto-register with Claude failed:', err));
    }, 400);
  }

  dispose(): void {
    if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
  }
}

/** Claude Desktop's config path per platform (null on unsupported hosts). */
function claudeDesktopConfigPath(): string | null {
  const home = os.homedir();
  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32': {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return path.join(appData, 'Claude', 'claude_desktop_config.json');
    }
    case 'linux':
      return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
    default:
      return null;
  }
}

/** Whether a config already contains managed `fuuz-*` MCP server entries. */
function isFuuzPresent(config: Record<string, any>): boolean {
  const servers = config?.mcpServers;
  return !!servers && typeof servers === 'object' && Object.keys(servers).some(k => k.startsWith('fuuz-'));
}

/**
 * Find a real `node` binary to run the stdio proxy. GUI-launched clients (Claude
 * Desktop) don't inherit the shell PATH, so we bake an absolute path into the
 * config when we can find one, falling back to a bare `node`.
 */
async function resolveNodePath(): Promise<string> {
  const fromPath = (process.env.PATH || '').split(path.delimiter);
  const extra =
    process.platform === 'win32'
      ? []
      : ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', path.join(os.homedir(), '.local', 'bin')];
  const binName = process.platform === 'win32' ? 'node.exe' : 'node';
  for (const dir of [...fromPath, ...extra]) {
    if (!dir) continue;
    const candidate = path.join(dir, binName);
    try {
      await fs.access(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  return 'node';
}
