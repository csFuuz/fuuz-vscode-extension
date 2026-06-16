import { Enterprise } from '../types';
import { TenantConfigurationManager } from './tenantConfigurationManager';
import { TokenStore } from './tokenStore';
import { FuuzMcpClient, EndpointProbe } from './fuuzMcpClient';
import { decodeJwt, environmentFromClaims, namesFrom } from '../util/fuuzParse';

export interface ImportResult {
  enterpriseId: string;
  enterpriseName: string;
  tenantId: string;
  tenantName: string;
  environment: string;
  serverName?: string;
  createdEnterprise: boolean;
  /** Availability of every endpoint for this credential/environment. */
  probes: EndpointProbe[];
}

/**
 * Onboards a connection from a single API key: decode the Fuuz JWT to learn the
 * enterprise, tenant and environment, validate the key against the MCP server,
 * then upsert the enterprise and add the tenant (token stored in SecretStorage).
 */
export class ConnectionImporter {
  constructor(
    private readonly configManager: TenantConfigurationManager,
    private readonly tokenStore: TokenStore,
    private readonly mcpClient: FuuzMcpClient
  ) {}

  async importByToken(token: string): Promise<ImportResult> {
    const claims = decodeJwt(token);
    if (!claims) {
      throw new Error('Could not read that API key (not a valid JWT).');
    }

    const environment = environmentFromClaims(claims);
    const tenantId: string | undefined = claims.tenantId;
    const enterpriseId: string | undefined = claims.enterpriseId;
    if (!environment || !tenantId || !enterpriseId) {
      throw new Error('API key is missing tenant/enterprise/host claims — add this connection manually.');
    }

    // Resolve the endpoint set (respecting any existing overrides) and probe all
    // of them with the credential.
    const existing = this.configManager.getEnterprise(enterpriseId);
    const probeBasis: Enterprise = existing
      ? { ...existing, environment: existing.environment || environment }
      : { id: enterpriseId, name: enterpriseId, environment, mcpEndpoint: `https://api.${environment}.fuuz.app`, tenants: [] };
    const endpoints = this.configManager.endpointsFor(probeBasis);
    const probes = await this.mcpClient.probeEndpoints(endpoints, token);

    const mcp = probes.find(p => p.key === 'mcp')!;
    if (mcp.state !== 'available') {
      throw new Error(`Key did not validate against the MCP server (${mcp.url}) — ${mcp.detail || mcp.state}.`);
    }

    const { enterpriseName, tenantName } = namesFrom(mcp.serverName, enterpriseId, tenantId);

    const createdEnterprise = !existing;
    const enterprise: Enterprise = existing
      ? { ...existing, environment: existing.environment || environment }
      : {
          id: enterpriseId,
          name: enterpriseName,
          environment,
          mcpEndpoint: `https://api.${environment}.fuuz.app`,
          tenants: [],
        };
    await this.configManager.addOrUpdateEnterprise(enterprise);
    await this.configManager.addOrUpdateTenant(enterpriseId, { id: tenantId, name: tenantName }, token);

    return {
      enterpriseId,
      enterpriseName: enterprise.name,
      tenantId,
      tenantName,
      environment,
      serverName: mcp.serverName,
      createdEnterprise,
      probes,
    };
  }
}

