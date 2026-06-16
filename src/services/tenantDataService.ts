import { Tenant, TenantResources } from '../types';
import { FuuzMcpClient } from './fuuzMcpClient';
import { TenantConfigurationManager } from './tenantConfigurationManager';
import { TokenStore } from './tokenStore';
import { ConnectionHealth } from './connectionHealth';

/**
 * Service for managing tenant data operations
 */
export class TenantDataService {
  private mcpClient: FuuzMcpClient;
  private configManager: TenantConfigurationManager;
  private tokenStore: TokenStore;
  private health: ConnectionHealth;

  constructor(
    mcpClient: FuuzMcpClient,
    configManager: TenantConfigurationManager,
    tokenStore: TokenStore,
    health: ConnectionHealth
  ) {
    this.mcpClient = mcpClient;
    this.configManager = configManager;
    this.tokenStore = tokenStore;
    this.health = health;
  }

  /**
   * Sync resources for a tenant. Tries the MCP server first (environment +
   * tool catalog); when MCP is unavailable, returns an empty manual set (the
   * user then configures flows to provide resource details). Works regardless
   * of which tenant is currently active.
   */
  async syncTenantResources(tenant: Tenant): Promise<TenantResources> {
    const enterprise = this.findEnterpriseForTenant(tenant.id);
    if (!enterprise) {
      throw new Error(`No enterprise found for tenant ${tenant.name}`);
    }

    const token = await this.tokenStore.getToken(enterprise.id, tenant.id);
    if (!token) {
      throw new Error(`No access token stored for ${tenant.name}. Set one in Fuuz: Configure Connections.`);
    }

    // A sync is an explicit refresh — drop derived caches so ERDs/fields reload.
    this.refsCache.delete(tenant.id);
    for (const key of [...this.fieldCache.keys()]) {
      if (key.startsWith(`${tenant.id}:`)) this.fieldCache.delete(key);
    }

    const endpoints = this.configManager.endpointsFor(enterprise);
    let mcp = null;
    try {
      mcp = await this.mcpClient.loadMcpSnapshot(endpoints.mcp, token);
    } catch (error) {
      console.error('MCP snapshot failed:', error);
    }

    // Record connection health: if the snapshot failed, classify why (expired
    // key vs unreachable) with a quick handshake so the UI can prompt re-auth.
    if (mcp) {
      this.health.set(enterprise.id, tenant.id, 'ok');
    } else {
      const probe = await this.mcpClient.initializeMcp(endpoints.mcp, token).catch(() => null);
      const status = probe?.message?.match(/\b(\d{3})\b/);
      this.health.set(
        enterprise.id,
        tenant.id,
        probe?.ok ? 'ok' : ConnectionHealth.fromStatus(status ? Number(status[1]) : 0),
        probe?.ok ? undefined : probe?.message
      );
    }

    const resources: TenantResources = {
      tenantId: tenant.id,
      tenantName: tenant.name,
      moduleGroups: [],
      mcp: mcp ?? undefined,
      source: mcp ? 'mcp' : 'manual',
      lastSyncedAt: new Date().toISOString(),
    };

    await this.configManager.cacheResources(tenant.id, resources);
    return resources;
  }

  private findEnterpriseForTenant(tenantId: string) {
    return this.configManager.getEnterprises().find(e => e.tenants.some(t => t.id === tenantId)) || null;
  }

  // Lazy-loaded data model fields, keyed by `${tenantId}:${modelName}`.
  private readonly fieldCache = new Map<string, import('../types').DataModelField[]>();

  /** Fetch (and cache) a data model's fields on demand for the active tenant. */
  async getModelFields(tenant: Tenant, modelName: string): Promise<import('../types').DataModelField[]> {
    const key = `${tenant.id}:${modelName}`;
    const cached = this.fieldCache.get(key);
    if (cached) return cached;

    const enterprise = this.findEnterpriseForTenant(tenant.id);
    if (!enterprise) return [];
    const token = await this.tokenStore.getToken(enterprise.id, tenant.id);
    if (!token) return [];

    const mcpUrl = this.configManager.endpointsFor(enterprise).mcp;
    const fields = await this.mcpClient.fetchModelElements(mcpUrl, token, modelName);
    this.fieldCache.set(key, fields);
    return fields;
  }

  /** Fetch a model's graph (fields + relations) for ERD rendering. */
  async getModelGraph(tenant: Tenant, modelName: string) {
    const enterprise = this.findEnterpriseForTenant(tenant.id);
    if (!enterprise) return null;
    const token = await this.tokenStore.getToken(enterprise.id, tenant.id);
    if (!token) return null;
    const mcpUrl = this.configManager.endpointsFor(enterprise).mcp;
    return this.mcpClient.fetchModelGraph(mcpUrl, token, modelName);
  }

  // Tenant-wide relationship edges, cached (the full list is one MCP call).
  private readonly refsCache = new Map<string, import('../util/fuuzParse').ErdEdge[]>();

  /** Deploy an app component version for the active tenant (caller confirms). */
  async deployComponent(tenant: Tenant, componentType: string, versionId: string, opts: { forceStopPreviousVersions?: boolean } = {}) {
    const enterprise = this.findEnterpriseForTenant(tenant.id);
    if (!enterprise) return null;
    const token = await this.tokenStore.getToken(enterprise.id, tenant.id);
    if (!token) return null;
    const mcpUrl = this.configManager.endpointsFor(enterprise).mcp;
    return this.mcpClient.deployComponent(mcpUrl, token, componentType, versionId, opts);
  }

  /** Run a read-only model query for the active tenant. */
  async queryModel(tenant: Tenant, modelName: string, fields: string[], where: string) {
    const enterprise = this.findEnterpriseForTenant(tenant.id);
    if (!enterprise) return null;
    const token = await this.tokenStore.getToken(enterprise.id, tenant.id);
    if (!token) return null;
    const mcpUrl = this.configManager.endpointsFor(enterprise).mcp;
    return this.mcpClient.queryModel(mcpUrl, token, modelName, fields, where);
  }

  /** Fetch (and cache) the tenant's relationship edges for ERD building. */
  async getReferences(tenant: Tenant) {
    const cached = this.refsCache.get(tenant.id);
    if (cached) return cached;
    const enterprise = this.findEnterpriseForTenant(tenant.id);
    if (!enterprise) return [];
    const token = await this.tokenStore.getToken(enterprise.id, tenant.id);
    if (!token) return [];
    const mcpUrl = this.configManager.endpointsFor(enterprise).mcp;
    const edges = await this.mcpClient.fetchReferences(mcpUrl, token);
    this.refsCache.set(tenant.id, edges);
    return edges;
  }

  /**
   * Get resources for the active tenant (from cache or fetch)
   */
  async getTenantResources(tenant: Tenant, forceRefresh: boolean = false): Promise<TenantResources | null> {
    if (!forceRefresh) {
      const cached = this.configManager.getCachedResources(tenant.id);
      if (cached) {
        return cached;
      }
    }

    try {
      return await this.syncTenantResources(tenant);
    } catch (error) {
      console.error('Failed to get tenant resources:', error);
      return null;
    }
  }

  /**
   * Clear cached resources for a tenant
   */
  async clearCache(tenantId: string): Promise<void> {
    await this.configManager.cacheResources(tenantId, null);
  }

  /**
   * Clear all cached resources
   */
  async clearAllCache(): Promise<void> {
    const enterprises = this.configManager.getEnterprises();
    for (const enterprise of enterprises) {
      for (const tenant of enterprise.tenants) {
        await this.clearCache(tenant.id);
      }
    }
  }
}
