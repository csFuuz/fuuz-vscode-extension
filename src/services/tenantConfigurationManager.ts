import * as vscode from 'vscode';
import { Enterprise, EnterpriseEndpoints, Tenant } from '../types';
import { TokenStore } from './tokenStore';
import { deriveEndpoints } from '../util/fuuzParse';

const CACHE_PREFIX = 'fuuz.resourceCache';

/**
 * Manages all tenant configuration operations.
 *
 * Connection metadata (enterprises, tenants, active selection) lives in user
 * settings; access tokens live in SecretStorage via {@link TokenStore}; and the
 * synced resource cache lives in globalState (never in settings.json).
 */
export class TenantConfigurationManager {
  private context: vscode.ExtensionContext;
  private tokenStore: TokenStore;

  private readonly _onDidChangeActiveTenant = new vscode.EventEmitter<void>();
  /** Fires when the active enterprise/tenant selection changes. */
  readonly onDidChangeActiveTenant = this._onDidChangeActiveTenant.event;

  constructor(context: vscode.ExtensionContext, tokenStore: TokenStore) {
    this.context = context;
    this.tokenStore = tokenStore;
  }

  private get cfg(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('fuuz');
  }

  /**
   * Migrate any legacy plaintext `apiKey` values out of settings and into
   * SecretStorage, then strip them from settings. Safe to run on every startup.
   */
  async migrateLegacyKeys(): Promise<void> {
    const enterprises = this.getEnterprises();
    let mutated = false;

    for (const enterprise of enterprises) {
      for (const tenant of enterprise.tenants) {
        if (tenant.apiKey) {
          if (!(await this.tokenStore.hasToken(enterprise.id, tenant.id))) {
            await this.tokenStore.setToken(enterprise.id, tenant.id, tenant.apiKey);
          }
          delete tenant.apiKey;
          mutated = true;
        }
      }
    }

    if (mutated) {
      await this.cfg.update('enterprises', enterprises, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage(
        'Fuuz: migrated tenant API keys from settings into secure storage.'
      );
    }
  }

  // --- Reads -------------------------------------------------------------

  getEnterprises(): Enterprise[] {
    return this.cfg.get<Enterprise[]>('enterprises', []);
  }

  hasEnterprises(): boolean {
    return this.getEnterprises().length > 0;
  }

  getEnterprise(id: string): Enterprise | null {
    return this.getEnterprises().find(e => e.id === id) || null;
  }

  getActiveEnterprise(): Enterprise | null {
    const activeId = this.cfg.get<string>('activeEnterprise');
    return this.getEnterprises().find(e => e.id === activeId) || null;
  }

  getActiveTenant(): Tenant | null {
    const enterprise = this.getActiveEnterprise();
    if (!enterprise) return null;
    const activeTenantId = this.cfg.get<string>('activeTenant');
    return enterprise.tenants.find(t => t.id === activeTenantId) || null;
  }

  getTenant(enterpriseId: string, tenantId: string): Tenant | null {
    const enterprise = this.getEnterprise(enterpriseId);
    return enterprise?.tenants.find(t => t.id === tenantId) || null;
  }

  /** Resolve every endpoint for an enterprise (overrides win, else derived). */
  endpointsFor(enterprise: Enterprise): EnterpriseEndpoints {
    return deriveEndpoints(enterprise);
  }

  /** Convenience: the streamable-HTTP MCP server URL for an enterprise. */
  getMcpServerUrl(enterprise: Enterprise): string {
    return this.endpointsFor(enterprise).mcp;
  }

  // --- Writes ------------------------------------------------------------

  async addOrUpdateEnterprise(enterprise: Enterprise): Promise<void> {
    const enterprises = this.getEnterprises();
    const index = enterprises.findIndex(e => e.id === enterprise.id);
    if (index >= 0) {
      enterprises[index] = enterprise;
    } else {
      enterprises.push(enterprise);
    }
    await this.cfg.update('enterprises', enterprises, vscode.ConfigurationTarget.Global);
  }

  async addOrUpdateTenant(enterpriseId: string, tenant: Tenant, token?: string): Promise<void> {
    const enterprise = this.getEnterprise(enterpriseId);
    if (!enterprise) {
      throw new Error(`Enterprise ${enterpriseId} not found`);
    }

    const existingIndex = enterprise.tenants.findIndex(t => t.id === tenant.id);
    if (existingIndex >= 0) {
      // Merge so fields like `disabled` survive a name/token update.
      enterprise.tenants[existingIndex] = { ...enterprise.tenants[existingIndex], ...tenant };
    } else {
      enterprise.tenants.push(tenant);
    }

    await this.addOrUpdateEnterprise(enterprise);
    if (token !== undefined && token !== '') {
      await this.tokenStore.setToken(enterpriseId, tenant.id, token);
    }
  }

  async removeEnterprise(enterpriseId: string): Promise<void> {
    const enterprise = this.getEnterprise(enterpriseId);
    if (enterprise) {
      for (const tenant of enterprise.tenants) {
        await this.tokenStore.deleteToken(enterpriseId, tenant.id);
        await this.clearCache(tenant.id);
      }
    }

    const enterprises = this.getEnterprises().filter(e => e.id !== enterpriseId);
    await this.cfg.update('enterprises', enterprises, vscode.ConfigurationTarget.Global);

    if (this.cfg.get<string>('activeEnterprise') === enterpriseId) {
      await this.cfg.update('activeEnterprise', undefined, vscode.ConfigurationTarget.Global);
      await this.cfg.update('activeTenant', undefined, vscode.ConfigurationTarget.Global);
      this._onDidChangeActiveTenant.fire();
    }
  }

  async removeTenant(enterpriseId: string, tenantId: string): Promise<void> {
    const enterprise = this.getEnterprise(enterpriseId);
    if (!enterprise) {
      throw new Error(`Enterprise ${enterpriseId} not found`);
    }

    enterprise.tenants = enterprise.tenants.filter(t => t.id !== tenantId);
    await this.addOrUpdateEnterprise(enterprise);
    await this.tokenStore.deleteToken(enterpriseId, tenantId);
    await this.clearCache(tenantId);

    if (this.cfg.get<string>('activeTenant') === tenantId) {
      await this.cfg.update('activeTenant', undefined, vscode.ConfigurationTarget.Global);
      this._onDidChangeActiveTenant.fire();
    }
  }

  /** Enable or disable a tenant (disabled tenants are not registered as MCP servers). */
  async setTenantDisabled(enterpriseId: string, tenantId: string, disabled: boolean): Promise<void> {
    const enterprise = this.getEnterprise(enterpriseId);
    if (!enterprise) {
      throw new Error(`Enterprise ${enterpriseId} not found`);
    }
    const tenant = enterprise.tenants.find(t => t.id === tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    tenant.disabled = disabled;
    await this.addOrUpdateEnterprise(enterprise);

    // Disabling the active tenant clears the active selection.
    if (disabled && this.cfg.get<string>('activeTenant') === tenantId && this.cfg.get<string>('activeEnterprise') === enterpriseId) {
      await this.cfg.update('activeTenant', undefined, vscode.ConfigurationTarget.Global);
    }
    this._onDidChangeActiveTenant.fire();
  }

  /** Whether an MCP tool is enabled for agents on a tenant (default: enabled). */
  isToolEnabled(enterpriseId: string, tenantId: string, toolName: string): boolean {
    const tenant = this.getTenant(enterpriseId, tenantId);
    return !tenant?.disabledTools?.includes(toolName);
  }

  /** The set of disabled tool names for a tenant. */
  disabledTools(enterpriseId: string, tenantId: string): string[] {
    return this.getTenant(enterpriseId, tenantId)?.disabledTools ?? [];
  }

  /** Enable or disable an MCP tool for agents on a tenant. */
  async setToolEnabled(enterpriseId: string, tenantId: string, toolName: string, enabled: boolean): Promise<void> {
    const enterprise = this.getEnterprise(enterpriseId);
    const tenant = enterprise?.tenants.find(t => t.id === tenantId);
    if (!enterprise || !tenant) return;
    const set = new Set(tenant.disabledTools ?? []);
    if (enabled) set.delete(toolName);
    else set.add(toolName);
    tenant.disabledTools = [...set];
    await this.addOrUpdateEnterprise(enterprise);
    this._onDidChangeActiveTenant.fire();
  }

  async setActiveTenant(enterpriseId: string, tenantId: string): Promise<void> {
    const enterprise = this.getEnterprise(enterpriseId);
    if (!enterprise) {
      throw new Error(`Enterprise ${enterpriseId} not found`);
    }
    if (!enterprise.tenants.some(t => t.id === tenantId)) {
      throw new Error(`Tenant ${tenantId} not found in enterprise ${enterpriseId}`);
    }

    await this.cfg.update('activeEnterprise', enterpriseId, vscode.ConfigurationTarget.Global);
    await this.cfg.update('activeTenant', tenantId, vscode.ConfigurationTarget.Global);
    this._onDidChangeActiveTenant.fire();
  }

  /** Quick-pick flow for selecting a tenant from the command palette. */
  async selectTenant(): Promise<void> {
    const enterprises = this.getEnterprises();
    if (enterprises.length === 0) {
      const choice = await vscode.window.showWarningMessage(
        'No Fuuz enterprises configured yet.',
        'Configure Connections'
      );
      if (choice) {
        await vscode.commands.executeCommand('fuuz.configureTenants');
      }
      return;
    }

    const enterprisePick = await vscode.window.showQuickPick(
      enterprises.map(e => ({ label: e.name, description: e.mcpEndpoint, value: e.id })),
      { placeHolder: 'Select an enterprise' }
    );
    if (!enterprisePick) return;

    const enterprise = this.getEnterprise(enterprisePick.value)!;
    if (enterprise.tenants.length === 0) {
      void vscode.window.showWarningMessage(`${enterprise.name} has no tenants configured.`);
      return;
    }

    const tenantPick = await vscode.window.showQuickPick(
      enterprise.tenants.map(t => ({ label: t.name, value: t.id })),
      { placeHolder: 'Select a tenant' }
    );
    if (!tenantPick) return;

    await this.setActiveTenant(enterprise.id, tenantPick.value);
    void vscode.window.showInformationMessage(`Fuuz: active tenant set to ${enterprise.name} › ${tenantPick.label}`);
  }

  async openConfigurationUI(): Promise<void> {
    await vscode.commands.executeCommand('fuuz.openConfigPanel');
  }

  // --- Resource cache (globalState, not settings) ------------------------

  private cacheKey(tenantId: string): string {
    return `${CACHE_PREFIX}:${tenantId}`;
  }

  getCachedResources(tenantId: string): any | null {
    return this.context.globalState.get<any>(this.cacheKey(tenantId), null);
  }

  async cacheResources(tenantId: string, resources: any): Promise<void> {
    await this.context.globalState.update(this.cacheKey(tenantId), resources ?? undefined);
  }

  async clearCache(tenantId: string): Promise<void> {
    await this.context.globalState.update(this.cacheKey(tenantId), undefined);
  }

  dispose(): void {
    this._onDidChangeActiveTenant.dispose();
  }
}
