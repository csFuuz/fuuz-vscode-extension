import * as vscode from 'vscode';
import { createHash, randomBytes } from 'crypto';
import { fuuzLog } from './logger';

/**
 * VS Code authentication provider that signs the user into their **Claude**
 * account via OAuth 2.0 with PKCE. This is what backs the "Sign in" action on
 * the Claude providers (Claude Code / Claude Desktop) — instead of pasting a
 * key, the user authorizes in the browser and the resulting token is stored in
 * SecretStorage.
 *
 * The OAuth client is configurable (`fuuz.claudeOAuth.*`) so an organization can
 * point it at the Claude OAuth application it has registered. With no client id
 * configured, {@link createSession} surfaces a clear, actionable error rather
 * than failing opaquely.
 */
export const CLAUDE_AUTH_ID = 'fuuz-claude';
export const CLAUDE_AUTH_LABEL = 'Claude (Fuuz)';

interface OAuthConfig {
  clientId: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
}

interface StoredSession {
  id: string;
  accessToken: string;
  account: { id: string; label: string };
  scopes: string[];
}

const SESSIONS_SECRET = 'fuuz.claudeOAuth.sessions';

export class ClaudeAuthProvider implements vscode.AuthenticationProvider {
  private readonly _onDidChangeSessions =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  readonly onDidChangeSessions = this._onDidChangeSessions.event;

  /** Resolves a pending authorize redirect, keyed by OAuth `state`. */
  private readonly pending = new Map<string, (code: string) => void>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    // Catch the OAuth redirect that comes back as a vscode:// URI.
    this.disposables.push(
      vscode.window.registerUriHandler({
        handleUri: (uri: vscode.Uri) => this.handleRedirect(uri),
      })
    );
  }

  /** Register the provider with VS Code and return the disposable bundle. */
  static register(context: vscode.ExtensionContext): ClaudeAuthProvider {
    const provider = new ClaudeAuthProvider(context);
    context.subscriptions.push(
      vscode.authentication.registerAuthenticationProvider(CLAUDE_AUTH_ID, CLAUDE_AUTH_LABEL, provider, {
        supportsMultipleAccounts: false,
      }),
      provider
    );
    return provider;
  }

  // --- AuthenticationProvider -------------------------------------------

  async getSessions(_scopes?: readonly string[]): Promise<vscode.AuthenticationSession[]> {
    const stored = await this.readSessions();
    return stored.map(s => this.toSession(s));
  }

  /** The signed-in account label, or undefined if not signed in (no prompt). */
  async currentAccount(): Promise<string | undefined> {
    const [first] = await this.readSessions();
    return first?.account.label;
  }

  /** Remove every stored session (sign out). */
  async signOutAll(): Promise<void> {
    const sessions = await this.readSessions();
    if (sessions.length === 0) return;
    await this.writeSessions([]);
    this._onDidChangeSessions.fire({ added: [], removed: sessions.map(s => this.toSession(s)), changed: [] });
  }

  async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
    const cfg = this.config(scopes);
    if (!cfg.clientId) {
      throw new Error(
        'Claude OAuth is not configured. Set "fuuz.claudeOAuth.clientId" (and, if your ' +
          'org uses a custom endpoint, "fuuz.claudeOAuth.authorizeUrl" / "tokenUrl") to the ' +
          'Claude OAuth application registered for your organization.'
      );
    }

    const token = await this.runPkceFlow(cfg);
    const account = decodeAccount(token);
    const session: StoredSession = {
      id: randomBytes(8).toString('hex'),
      accessToken: token,
      account,
      scopes: [...cfg.scopes],
    };

    const sessions = await this.readSessions();
    // Single-account provider: a new sign-in replaces the previous session.
    const removed = sessions.splice(0, sessions.length);
    sessions.push(session);
    await this.writeSessions(sessions);

    const added = this.toSession(session);
    this._onDidChangeSessions.fire({ added: [added], removed: removed.map(s => this.toSession(s)), changed: [] });
    return added;
  }

  async removeSession(sessionId: string): Promise<void> {
    const sessions = await this.readSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx < 0) return;
    const [removed] = sessions.splice(idx, 1);
    await this.writeSessions(sessions);
    this._onDidChangeSessions.fire({ added: [], removed: [this.toSession(removed)], changed: [] });
  }

  // --- OAuth (PKCE) -----------------------------------------------------

  private async runPkceFlow(cfg: OAuthConfig): Promise<string> {
    const verifier = base64url(randomBytes(32));
    const challenge = base64url(createHash('sha256').update(verifier).digest());
    const state = randomBytes(16).toString('hex');

    const redirectUri = await vscode.env.asExternalUri(
      vscode.Uri.parse(`${vscode.env.uriScheme}://fuuz.fuuz-vscode-extension/claude-auth`)
    );

    const authorize = vscode.Uri.parse(cfg.authorizeUrl).with({
      query: new URLSearchParams({
        response_type: 'code',
        client_id: cfg.clientId,
        redirect_uri: redirectUri.toString(true),
        scope: cfg.scopes.join(' '),
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }).toString(),
    });

    const code = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Signing in to Claude…', cancellable: true },
      (_progress, cancel) =>
        new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.pending.delete(state);
            reject(new Error('Claude sign-in timed out. Please try again.'));
          }, 5 * 60 * 1000);

          cancel.onCancellationRequested(() => {
            clearTimeout(timeout);
            this.pending.delete(state);
            reject(new Error('Claude sign-in was cancelled.'));
          });

          this.pending.set(state, (c: string) => {
            clearTimeout(timeout);
            resolve(c);
          });

          void vscode.env.openExternal(authorize);
        })
    );

    return this.exchangeCode(cfg, code, verifier, redirectUri.toString(true));
  }

  private handleRedirect(uri: vscode.Uri): void {
    const params = new URLSearchParams(uri.query);
    const state = params.get('state') ?? '';
    const code = params.get('code');
    const error = params.get('error');
    const resolver = this.pending.get(state);
    if (!resolver) return; // not ours / already handled
    this.pending.delete(state);
    if (error) {
      void vscode.window.showErrorMessage(`Claude sign-in failed: ${params.get('error_description') || error}`);
      return;
    }
    if (code) resolver(code);
  }

  private async exchangeCode(cfg: OAuthConfig, code: string, verifier: string, redirectUri: string): Promise<string> {
    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: cfg.clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }).toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Claude token exchange failed (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }
    const json: any = await res.json().catch(() => ({}));
    const token = json.access_token;
    if (typeof token !== 'string' || !token) {
      throw new Error('Claude token exchange returned no access_token.');
    }
    fuuzLog('Claude OAuth sign-in succeeded.');
    return token;
  }

  // --- Config + storage -------------------------------------------------

  private config(scopes?: readonly string[]): OAuthConfig {
    const cfg = vscode.workspace.getConfiguration('fuuz.claudeOAuth');
    const configuredScopes = cfg.get<string[]>('scopes', []);
    return {
      clientId: (cfg.get<string>('clientId', '') || '').trim(),
      authorizeUrl: cfg.get<string>('authorizeUrl', 'https://claude.ai/oauth/authorize'),
      tokenUrl: cfg.get<string>('tokenUrl', 'https://console.anthropic.com/v1/oauth/token'),
      scopes: (scopes && scopes.length ? [...scopes] : configuredScopes.length ? configuredScopes : ['profile']),
    };
  }

  private async readSessions(): Promise<StoredSession[]> {
    const raw = await this.context.secrets.get(SESSIONS_SECRET);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeSessions(sessions: StoredSession[]): Promise<void> {
    await this.context.secrets.store(SESSIONS_SECRET, JSON.stringify(sessions));
  }

  private toSession(s: StoredSession): vscode.AuthenticationSession {
    return { id: s.id, accessToken: s.accessToken, account: s.account, scopes: s.scopes };
  }

  dispose(): void {
    this._onDidChangeSessions.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Best-effort account label from a JWT access token, falling back gracefully. */
function decodeAccount(token: string): { id: string; label: string } {
  try {
    const payload = token.split('.')[1];
    if (payload) {
      const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
      const label = claims.email || claims.name || claims.sub || 'Claude account';
      const id = String(claims.sub || claims.email || label);
      return { id, label: String(label) };
    }
  } catch {
    /* fall through */
  }
  return { id: 'claude', label: 'Claude account' };
}
