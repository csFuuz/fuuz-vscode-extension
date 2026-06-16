/**
 * Represents a single tenant within an enterprise.
 *
 * NOTE: the per-tenant access token is NOT stored here. It lives in VS Code
 * SecretStorage (see TokenStore) so it never touches settings.json or source
 * control. `apiKey` is retained only to migrate older plaintext configs.
 */
export interface Tenant {
  id: string;
  name: string;
  /** When true, the connection is kept but not registered as an MCP server. */
  disabled?: boolean;
  /** MCP tool names the user has turned off for agents (intent + context shaping). */
  disabledTools?: string[];
  /** @deprecated legacy plaintext key — migrated into SecretStorage on load */
  apiKey?: string;
}

/**
 * Represents an enterprise containing multiple tenants.
 *
 * An enterprise is identified by its `environment` slug — the `{env}.{account}`
 * segment of the host, e.g. `build.mfgx` or `build.proveit`. Every endpoint is
 * derived from `https://api.{environment}.fuuz.app`:
 *
 *   - flow execution → `…/orchestration/executeFlow`
 *   - webhook        → `…/webhook/post/{topic}`
 *   - graphql        → `…/graphql`
 *   - mcp            → `…/mcp`  (registered with VS Code for the AI copilot)
 *
 * Any of these can be overridden explicitly. `mcpEndpoint` is retained as the
 * REST API base for the resource tree and as a fallback when `environment` is
 * not set (older configs).
 */
export interface Enterprise {
  id: string;
  name: string;
  /** `{env}.{account}` slug, e.g. `build.mfgx`. Drives all derived endpoints. */
  environment?: string;
  mcpEndpoint: string;
  mcpServerUrl?: string;
  flowExecutionUrl?: string;
  webhookUrl?: string;
  tenants: Tenant[];
}

/**
 * The full set of endpoints resolved for an enterprise (derived from its
 * `environment` slug, with explicit overrides taking precedence).
 *
 * Note: there is no GraphQL runtime endpoint. Saved GraphQL queries/mutations
 * are executed by building a data flow that references them and running it
 * through {@link flowExecution}.
 */
export interface EnterpriseEndpoints {
  apiBase: string;
  flowExecution: string;
  webhook: string;
  mcp: string;
}

/**
 * Represents the full tenant configuration with selection state
 */
export interface TenantConfig {
  enterprises: Enterprise[];
  activeEnterpriseId?: string;
  activeTenantId?: string;
}

/**
 * Tenant resource hierarchy. Mirrors the Fuuz application structure:
 *
 *   moduleGroup
 *   ├─ module
 *   │  ├─ screens
 *   │  ├─ flows
 *   │  └─ data models
 *   ├─ documents
 *   ├─ scripts
 *   └─ graphql (queries / mutations)
 */
export interface ModuleGroup {
  id: string;
  name: string;
  description?: string;
  modules: Module[];
  documents: Document[];
  scripts: Script[];
  graphql: GraphQLOperation[];
}

export interface Module {
  id: string;
  name: string;
  description?: string;
  screens: Screen[];
  flows: Flow[];
  dataModels: DataModel[];
}

export interface Screen {
  id: string;
  name: string;
  description?: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
}

export interface DataModel {
  id: string;
  name: string;
  description?: string;
  fields: DataModelField[];
}

export interface DataModelField {
  id: string;
  name: string;
  type: string;
  required?: boolean;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Script {
  id: string;
  name: string;
  language: string;
  description?: string;
}

/** A stored GraphQL operation — a query or a mutation. */
export interface GraphQLOperation {
  id: string;
  name: string;
  kind: 'query' | 'mutation';
  description?: string;
  /** The operation text, when provided by the backend. */
  query?: string;
}

/**
 * A tool advertised by the Fuuz MCP server. `kind` distinguishes the platform's
 * built-in tools from **dataflow** tools — custom data flows in the tenant that
 * the server exposes as callable tools.
 */
export interface McpTool {
  name: string;
  description?: string;
  kind: 'system' | 'dataflow';
}

/**
 * What the Fuuz MCP server exposes for a connection, pulled automatically when
 * a tenant is reachable over MCP: environment/context info, the catalog of
 * available tools, the application metamodel (module groups → modules →
 * screens/flows/data models) and the system data models.
 */
export interface McpSnapshot {
  serverName?: string;
  environment?: Record<string, any>;
  tools: McpTool[];
  /** Application hierarchy discovered via MCP query tools. */
  application: ModuleGroup[];
  /** Data models flagged as system (vs application/custom). */
  systemDataModels: DataModel[];
}

/**
 * Complete tenant resource structure. `moduleGroups` is the flow-configured
 * hierarchy; `mcp` is auto-discovered from the MCP server when available.
 */
export interface TenantResources {
  tenantId: string;
  tenantName: string;
  moduleGroups: ModuleGroup[];
  mcp?: McpSnapshot;
  /** How resources were loaded, for UI messaging. */
  source: 'mcp' | 'manual' | 'none';
  lastSyncedAt: string;
}

/**
 * MCP Client request/response types
 */
export interface McpRequest {
  method: string;
  params?: Record<string, any>;
}

export interface McpResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
