import * as vscode from 'vscode';

/**
 * The AI "hosts" the Fuuz MCP servers can be wired into. These are distinct from
 * Fuuz *connections* (enterprises/tenants) — a provider is the copilot the user
 * runs (VS Code Copilot, Claude Code, Claude Desktop), and each is enabled and
 * authenticated independently.
 *
 * `copilot` needs no auth (servers are surfaced through VS Code's own MCP
 * definition provider). The Claude providers are wired by materializing the
 * Fuuz servers into Claude's config files; the Claude *account* is authenticated
 * via OAuth (see {@link ClaudeAuthProvider}).
 */
export type AiProviderId = 'copilot' | 'claude-code' | 'claude-desktop';

export interface AiProviderDef {
  id: AiProviderId;
  label: string;
  /** Whether this provider is authenticated with an OAuth sign-in (Claude). */
  usesOAuth: boolean;
  /** The `ClaudeTarget` this provider writes to, when applicable. */
  claudeTarget?: 'user' | 'desktop';
  description: string;
}

/** The static catalogue of providers the extension knows how to wire. */
export const AI_PROVIDERS: readonly AiProviderDef[] = [
  {
    id: 'copilot',
    label: 'GitHub Copilot (VS Code)',
    usesOAuth: false,
    description: 'Fuuz MCP servers are surfaced to Copilot Chat / agent mode through VS Code. No sign-in needed.',
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    usesOAuth: true,
    claudeTarget: 'user',
    description: 'Writes the Fuuz MCP servers into Claude Code (~/.claude.json). Sign in with your Claude account.',
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    usesOAuth: true,
    claudeTarget: 'desktop',
    description: 'Writes the Fuuz MCP servers into Claude Desktop. Sign in with your Claude account.',
  },
] as const;

/** Persisted per-provider state. */
export interface AiProviderState {
  id: AiProviderId;
  enabled: boolean;
}

const STATE_KEY = 'fuuz.aiProviders';

/**
 * Tracks which AI providers are enabled. State is stored as a **keyed array**
 * upserted by `id` — historically a single-value store meant enabling a second
 * provider clobbered the first (the "only recognizes the first provider" bug);
 * here every provider is an independent row, so any number can be enabled at
 * once.
 */
export class AiProviderManager {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  /** Fires whenever the enabled set or a provider's auth changes. */
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /** The full catalogue (static). */
  list(): readonly AiProviderDef[] {
    return AI_PROVIDERS;
  }

  static def(id: AiProviderId): AiProviderDef | undefined {
    return AI_PROVIDERS.find(p => p.id === id);
  }

  private states(): AiProviderState[] {
    const raw = this.context.globalState.get<AiProviderState[]>(STATE_KEY, []);
    return Array.isArray(raw) ? raw.filter(s => s && AiProviderManager.def(s.id)) : [];
  }

  isEnabled(id: AiProviderId): boolean {
    return this.states().some(s => s.id === id && s.enabled);
  }

  enabledProviders(): AiProviderDef[] {
    return AI_PROVIDERS.filter(p => this.isEnabled(p.id));
  }

  /**
   * Enable or disable a provider, upserting its row by id so other providers'
   * state is preserved. Returns the new enabled value.
   */
  async setEnabled(id: AiProviderId, enabled: boolean): Promise<void> {
    if (!AiProviderManager.def(id)) throw new Error(`Unknown AI provider: ${id}`);
    const states = this.states();
    const idx = states.findIndex(s => s.id === id);
    if (idx >= 0) {
      states[idx] = { ...states[idx], id, enabled };
    } else {
      states.push({ id, enabled });
    }
    await this.context.globalState.update(STATE_KEY, states);
    this._onDidChange.fire();
  }

  /** Fire the change event without mutating state (e.g. after an auth change). */
  notifyAuthChanged(): void {
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
