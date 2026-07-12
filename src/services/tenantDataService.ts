import { Enterprise, ModelService, Tenant, TenantResources } from '../types';
import { FuuzMcpClient } from './fuuzMcpClient';
import { TenantConfigurationManager } from './tenantConfigurationManager';
import { TokenStore } from './tokenStore';
import * as vscode from 'vscode';
import { ConnectionHealth } from './connectionHealth';
import { fuuzLog, fuuzChannel } from './logger';

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

    // A sync is an explicit refresh — drop derived caches so ERDs/fields reload,
    // and the resolved-connection memo so a just-replaced key is picked up.
    this.connCache.delete(tenant.id);
    this.refsCache.delete(tenant.id);
    for (const key of [...this.fieldCache.keys()]) {
      if (key.startsWith(`${tenant.id}:`)) this.fieldCache.delete(key);
    }

    const endpoints = this.configManager.endpointsFor(enterprise);
    let mcp = null;
    try {
      mcp = await this.mcpClient.loadMcpSnapshot(endpoints.mcp, token);
    } catch (error) {
      fuuzLog(`MCP snapshot failed for ${tenant.name}: ${error instanceof Error ? error.message : String(error)}`);
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

    if (mcp) {
      fuuzLog(`sync ${tenant.name}: ${mcp.application.length} module groups, ${mcp.systemDataModels.length} system models, ${mcp.tools.length} tools`);
      for (const issue of mcp.issues) fuuzLog(`  ⚠ ${issue}`);
      this.warnIfUnauthorized(tenant.id, tenant.name, mcp.issues);
    } else {
      fuuzLog(`sync ${tenant.name}: MCP unavailable (manual fallback)`);
    }

    // Persist to the (globalState) cache — but never let a failed or empty MCP
    // snapshot evict a previously-good one. A transient MCP hiccup (e.g. an SSE
    // drop mid-sync, or a sync fired before the key's query policy took effect)
    // would otherwise poison the cache: the tree keeps serving the empty snapshot
    // and shows "no resources" while the connection reads "connected", until a
    // manual re-sync. That's the main cause of "connected, but nothing loads",
    // and it bites hardest when switching between tenants to build across them.
    const prior = this.configManager.getCachedResources(tenant.id) as TenantResources | null;
    if (hasResourceContent(resources) || !hasResourceContent(prior)) {
      await this.configManager.cacheResources(tenant.id, resources);
      return resources;
    }
    fuuzLog(`sync ${tenant.name}: MCP returned no data — keeping previously cached resources`);
    return prior as TenantResources;
  }

  private findEnterpriseForTenant(tenantId: string) {
    return this.configManager.getEnterprises().find(e => e.tenants.some(t => t.id === tenantId)) || null;
  }

  /**
   * Resolved connection (enterprise + token + MCP url) for a tenant, memoized with
   * a short TTL. Without this, every per-record call in an audit/fix-plan loop
   * re-reads the token from SecretStorage and re-derives endpoints; this hoists
   * that to once per ~30s window. An explicit sync (`syncTenantResources`) drops
   * the entry so a replaced key takes effect immediately.
   */
  private readonly connCache = new Map<string, { enterprise: Enterprise; token: string; mcpUrl: string; at: number }>();
  private static readonly CONN_TTL_MS = 30_000;

  private async resolveConn(tenant: Tenant): Promise<{ enterprise: Enterprise; token: string; mcpUrl: string } | null> {
    const cached = this.connCache.get(tenant.id);
    if (cached && Date.now() - cached.at < TenantDataService.CONN_TTL_MS) return cached;
    const enterprise = this.findEnterpriseForTenant(tenant.id);
    if (!enterprise) return null;
    const token = await this.tokenStore.getToken(enterprise.id, tenant.id);
    if (!token) return null;
    const mcpUrl = this.configManager.endpointsFor(enterprise).mcp;
    const entry = { enterprise, token, mcpUrl, at: Date.now() };
    this.connCache.set(tenant.id, entry);
    return entry;
  }

  // Warn at most once per tenant — until an explicit re-check (sync/replace-key)
  // clears it, so users see whether a just-granted policy actually took effect.
  private readonly warnedUnauthorized = new Set<string>();

  /** Allow the next sync to re-warn about authorization (e.g. after replacing a key). */
  forgetUnauthorizedWarning(tenantId: string): void {
    this.warnedUnauthorized.delete(tenantId);
  }

  /**
   * If discovery hit authorization failures, tell the user how to fix it: grant
   * the API User a read/query policy in Fuuz, then issue a NEW key (existing
   * keys don't inherit newly-assigned policies).
   */
  private warnIfUnauthorized(tenantId: string, tenantName: string, issues: string[]): void {
    const authIssues = issues.filter(i => /not authorized/i.test(i));
    if (authIssues.length === 0 || this.warnedUnauthorized.has(tenantId)) return;
    this.warnedUnauthorized.add(tenantId);

    const modules = [...new Set(
      authIssues.map(i => i.match(/in the (\w+) module/)?.[1]).filter(Boolean) as string[]
    )];
    const where = modules.length ? ` (modules: ${modules.join(', ')})` : '';

    void vscode.window
      .showWarningMessage(
        `Fuuz: connected to ${tenantName}, but this API key isn't authorized to read ${authIssues.length} resource(s)${where}. ` +
          `In Fuuz, assign a read/query policy or policy group to the API User for this tenant, then issue a NEW API key ` +
          `(existing keys don't pick up newly-granted policies) and use Replace API Key.`,
        'Show Details',
        'Replace API Key'
      )
      .then(choice => {
        if (choice === 'Show Details') fuuzChannel().show(true);
        else if (choice === 'Replace API Key') {
          void vscode.commands.executeCommand('fuuz.replaceKey', this.findEnterpriseForTenant(tenantId)?.id, tenantId);
        }
      });
  }

  // Lazy-loaded data model fields, keyed by `${tenantId}:${modelName}`.
  private readonly fieldCache = new Map<string, import('../types').DataModelField[]>();

  /** Fetch (and cache) a data model's fields on demand for the active tenant. */
  async getModelFields(tenant: Tenant, modelName: string, service: ModelService = 'application', signal?: AbortSignal): Promise<import('../types').DataModelField[]> {
    const key = `${tenant.id}:${service}:${modelName}`;
    const cached = this.fieldCache.get(key);
    if (cached) return cached;

    const conn = await this.resolveConn(tenant);
    if (!conn) return [];

    const fields = await this.mcpClient.fetchModelElements(conn.mcpUrl, conn.token, modelName, service, signal);
    this.fieldCache.set(key, fields);
    return fields;
  }

  /** Fetch a model's graph (fields + relations) for ERD rendering. */
  async getModelGraph(tenant: Tenant, modelName: string, service: ModelService = 'application', signal?: AbortSignal) {
    const conn = await this.resolveConn(tenant);
    if (!conn) return null;
    return this.mcpClient.fetchModelGraph(conn.mcpUrl, conn.token, modelName, service, signal);
  }

  // Tenant-wide relationship edges, cached (the full list is one MCP call).
  private readonly refsCache = new Map<string, import('../util/fuuzParse').ErdEdge[]>();

  /** Deploy an app component version for the active tenant (caller confirms). */
  async deployComponent(tenant: Tenant, componentType: string, versionId: string, opts: { forceStopPreviousVersions?: boolean } = {}, signal?: AbortSignal) {
    const conn = await this.resolveConn(tenant);
    if (!conn) return null;
    return this.mcpClient.deployComponent(conn.mcpUrl, conn.token, componentType, versionId, opts, signal);
  }

  /**
   * Run a read-only model query for the active tenant. `first` caps the page size
   * (server max 1000) for full-table index scans.
   */
  async queryModel(tenant: Tenant, modelName: string, fields: string[], where: string, service: ModelService = 'application', signal?: AbortSignal, first?: number) {
    const conn = await this.resolveConn(tenant);
    if (!conn) return null;
    return this.mcpClient.queryModel(conn.mcpUrl, conn.token, modelName, fields, where, service, signal, first);
  }

  /**
   * Call any Fuuz MCP tool by name for a tenant, returning its text payload.
   * Reaches the tenant's `system_*` catalog and custom data-flow tools. Returns
   * null when the tenant can't be resolved/reached.
   */
  async callMcpTool(tenant: Tenant, name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<string | null> {
    const conn = await this.resolveConn(tenant);
    if (!conn) return null;
    return this.mcpClient.callTool(conn.mcpUrl, conn.token, name, args, signal);
  }

  /** Fetch each Fuuz MCP tool's JSON inputSchema (name → schema) for the tenant. */
  async getMcpToolSchemas(tenant: Tenant, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const conn = await this.resolveConn(tenant);
    if (!conn) return {};
    return this.mcpClient.fetchToolSchemas(conn.mcpUrl, conn.token, signal);
  }

  /** Fetch (and cache) the tenant's relationship edges for ERD building. */
  async getReferences(tenant: Tenant, service: ModelService = 'application', signal?: AbortSignal) {
    const key = `${tenant.id}:${service}`;
    const cached = this.refsCache.get(key);
    if (cached) return cached;
    const conn = await this.resolveConn(tenant);
    if (!conn) return [];
    const edges = await this.mcpClient.fetchReferences(conn.mcpUrl, conn.token, service, signal);
    this.refsCache.set(key, edges);
    return edges;
  }

  /**
   * Get resources for the active tenant (from cache or fetch)
   */
  async getTenantResources(tenant: Tenant, forceRefresh: boolean = false): Promise<TenantResources | null> {
    if (!forceRefresh) {
      const cached = this.configManager.getCachedResources(tenant.id) as TenantResources | null;
      // Trust the cache only when it actually carries resources, or it's an
      // intentional MCP-less result synced very recently. An EMPTY snapshot left
      // behind by a past transient failure must NOT stick — treat it as a miss so
      // we re-sync and self-heal. This is what finally lets a healthy tenant show
      // its resources (e.g. after switching to it) without a manual Sync.
      if (cached && (hasResourceContent(cached) || isFreshEmpty(cached))) {
        return cached;
      }
    }

    try {
      return await this.syncTenantResources(tenant);
    } catch (error) {
      fuuzLog(`Failed to get resources for ${tenant.name}: ${error instanceof Error ? error.message : String(error)}`);
      // Fall back to whatever was cached rather than showing nothing on a
      // transient error (the non-poisoning cache above keeps good data around).
      return (this.configManager.getCachedResources(tenant.id) as TenantResources | null) ?? null;
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

/** True when a cached snapshot carries any browsable resource. */
function hasResourceContent(r: TenantResources | null | undefined): boolean {
  if (!r) return false;
  const m = r.mcp;
  return (
    (m?.application?.length ?? 0) > 0 ||
    (m?.systemDataModels?.length ?? 0) > 0 ||
    (m?.tools?.length ?? 0) > 0 ||
    (m?.scripts?.length ?? 0) > 0 ||
    (m?.queries?.length ?? 0) > 0 ||
    (m?.documents?.length ?? 0) > 0 ||
    (r.moduleGroups?.length ?? 0) > 0
  );
}

/**
 * An empty result is still trusted for a short window after its sync, so a tenant
 * that genuinely exposes nothing over MCP isn't re-synced on every tree render.
 * Past this window an empty cache is treated as stale and re-fetched (self-heal).
 */
function isFreshEmpty(r: TenantResources): boolean {
  const t = r.lastSyncedAt ? Date.parse(r.lastSyncedAt) : NaN;
  return Number.isFinite(t) && Date.now() - t < 120_000;
}
