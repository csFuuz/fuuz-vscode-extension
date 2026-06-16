import * as vscode from 'vscode';

export type HealthState = 'ok' | 'unauthorized' | 'unreachable' | 'unknown';

/**
 * In-memory health of each tenant connection, updated from syncs, endpoint
 * probes, and runtime call failures. Drives the sidebar/status-bar indicators
 * and the "key may be expired" re-auth prompts.
 */
export class ConnectionHealth {
  private readonly map = new Map<string, { state: HealthState; message?: string }>();
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private key(enterpriseId: string, tenantId: string): string {
    return `${enterpriseId}:${tenantId}`;
  }

  get(enterpriseId: string, tenantId: string): HealthState {
    return this.map.get(this.key(enterpriseId, tenantId))?.state ?? 'unknown';
  }

  message(enterpriseId: string, tenantId: string): string | undefined {
    return this.map.get(this.key(enterpriseId, tenantId))?.message;
  }

  set(enterpriseId: string, tenantId: string, state: HealthState, message?: string): void {
    const k = this.key(enterpriseId, tenantId);
    const prev = this.map.get(k);
    if (prev?.state === state && prev?.message === message) return;
    this.map.set(k, { state, message });
    this._onDidChange.fire();
  }

  /** Map an MCP/HTTP status (or message containing one) to a health state. */
  static fromStatus(status: number): HealthState {
    if (status === 401 || status === 403) return 'unauthorized';
    if (status >= 200 && status < 500) return 'ok';
    return 'unreachable';
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
