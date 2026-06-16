import * as vscode from 'vscode';

/**
 * Stores per-tenant Fuuz access tokens in VS Code SecretStorage.
 *
 * Tokens are keyed by `enterpriseId:tenantId` so a token is scoped to exactly
 * one tenant connection. Nothing is ever written to settings.json, keeping
 * credentials out of source control and synced settings.
 */
export class TokenStore {
  private static readonly PREFIX = 'fuuz.token';
  private readonly secrets: vscode.SecretStorage;
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  /** Fires whenever a token is set or deleted, so dependents can re-register. */
  readonly onDidChange = this._onDidChange.event;

  constructor(secrets: vscode.SecretStorage) {
    this.secrets = secrets;
  }

  private key(enterpriseId: string, tenantId: string): string {
    return `${TokenStore.PREFIX}:${enterpriseId}:${tenantId}`;
  }

  async getToken(enterpriseId: string, tenantId: string): Promise<string | undefined> {
    return this.secrets.get(this.key(enterpriseId, tenantId));
  }

  async hasToken(enterpriseId: string, tenantId: string): Promise<boolean> {
    return (await this.getToken(enterpriseId, tenantId)) !== undefined;
  }

  async setToken(enterpriseId: string, tenantId: string, token: string): Promise<void> {
    await this.secrets.store(this.key(enterpriseId, tenantId), token);
    this._onDidChange.fire();
  }

  async deleteToken(enterpriseId: string, tenantId: string): Promise<void> {
    await this.secrets.delete(this.key(enterpriseId, tenantId));
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
