/**
 * Message + state contract shared between the config panel's extension host
 * ([ui/configPanel.ts]) and its React webview ([webview/config/index.tsx]).
 * Pure types, no VS Code or Node imports, so esbuild can bundle it into the
 * browser webview and `tsc` can type-check the host against the same shapes.
 */

/** A single endpoint probe result, as surfaced in the UI. */
export interface ProbeView {
  key: 'mcp' | 'flow' | 'webhook';
  label: string;
  url: string;
  state: 'available' | 'unauthorized' | 'forbidden' | 'unavailable' | 'error';
  status?: number;
  detail?: string;
  serverName?: string;
}

export interface TenantView {
  id: string;
  name: string;
  hasToken: boolean;
  active: boolean;
  disabled: boolean;
}

export interface EnterpriseView {
  id: string;
  name: string;
  environment: string;
  mcpEndpoint: string;
  endpoints: { apiBase: string; mcp: string; flowExecution: string; webhook: string };
  tenants: TenantView[];
}

export interface ToolView {
  name: string;
  description?: string;
  kind: string;
  enabled: boolean;
}

/** An AI host the Fuuz MCP servers can be wired into. */
export interface ProviderView {
  id: 'copilot' | 'claude-code' | 'claude-desktop';
  label: string;
  description: string;
  enabled: boolean;
  /** Whether this provider authenticates via OAuth sign-in (Claude). */
  usesOAuth: boolean;
  /** Whether an OAuth session currently exists (Claude providers only). */
  signedIn: boolean;
  /** Account label for the signed-in session, if any. */
  account?: string;
}

export interface PanelState {
  enterprises: EnterpriseView[];
  /** AI hosts the MCP servers are wired into (Copilot, Claude Code, Claude Desktop). */
  providers: ProviderView[];
  /** Agent tools for the active tenant (from the last MCP sync). */
  activeTools?: {
    enterpriseId: string;
    tenantId: string;
    tenantName: string;
    items: ToolView[];
  };
}

export interface ImportResultView {
  enterpriseName: string;
  tenantName: string;
  tenantId: string;
  probes: ProbeView[];
}

/** Webview → extension. */
export type ConfigInbound =
  | { type: 'ready' }
  | { type: 'addByToken'; token: string }
  | { type: 'removeEnterprise'; id: string }
  | { type: 'removeTenant'; enterpriseId: string; tenantId: string }
  | { type: 'setActive'; enterpriseId: string; tenantId: string }
  | { type: 'setDisabled'; enterpriseId: string; tenantId: string; disabled: boolean }
  | { type: 'replaceKey'; enterpriseId: string; tenantId: string }
  | { type: 'setToolEnabled'; enterpriseId: string; tenantId: string; name: string; enabled: boolean }
  | { type: 'createTool' }
  | { type: 'test'; enterpriseId: string; tenantId: string; token?: string }
  | { type: 'setProviderEnabled'; id: ProviderView['id']; enabled: boolean }
  | { type: 'signInProvider'; id: ProviderView['id'] }
  | { type: 'signOutProvider'; id: ProviderView['id'] };

/** Extension → webview. */
export type ConfigOutbound =
  | { type: 'state'; state: PanelState }
  | { type: 'probeResult'; tenantId: string; probes: ProbeView[]; message?: string }
  | { type: 'importResult'; ok: boolean; result?: ImportResultView; message?: string }
  | { type: 'error'; message: string };
