/**
 * Normalized model of a Fuuz data flow for compliance analysis, built from real
 * `DataFlowElement` records (read over the `system_query_model` MCP tool, decoded
 * by {@link ../util/tron}). The adapter ([qa/flowDescriptor.ts]) maps raw nodes
 * into this shape; the analyzers ([qa/flowAnalysis.ts]) are pure and operate only
 * on this model, so they're fully unit-testable without a live tenant.
 *
 * Node kinds mirror the real Fuuz node `type` vocabulary (request, fork, collect,
 * ifElse, switch, javascriptTransform, transform, savedTransformV2, query, http,
 * tryCatch, …) rather than invented categories.
 */

export type FlowNodeKind =
  | 'entry'           // request · schedule · when · dataChanges
  | 'fork'            // parallel fan-out
  | 'collect'         // parallel join
  | 'ifElse'          // 2-way conditional
  | 'switch'          // n-way conditional
  | 'inlineScript'    // javascriptTransform (inline JS)
  | 'jsonata'         // transform (inline JSONata)
  | 'savedTransform'  // savedTransformV2 (saved script/query reference)
  | 'query'
  | 'mutate'
  | 'http'            // integration node (uses a Connection)
  | 'tryCatch'
  | 'throwError'
  | 'response'
  | 'executeFlow'
  | 'validate'        // payload-contract / schema validation node
  | 'log'
  | 'other';

export interface SavedRef {
  id?: string;
  name?: string;
  language?: string;
}

export interface FlowNode {
  id: string;
  name?: string;
  description?: string;
  /** Raw Fuuz node type, e.g. `javascriptTransform`, `savedTransformV2`. */
  rawType: string;
  kind: FlowNodeKind;
  /** Inline script/JSONata body (inlineScript · jsonata). */
  script?: string;
  /** GraphQL query string (query nodes). */
  query?: string;
  /** Variable-building transform feeding the query (query nodes). */
  variablesTransform?: string;
  /** Which API the query targets (application · system). */
  queryApi?: string;
  /** Reference to the saved transform (savedTransform nodes). */
  savedRef?: SavedRef;
  /** Request-side transform shaping the payload into a saved transform. */
  requestTransform?: string;
  /** Branch count (fork nodes). */
  branchCount?: number;
  /** Declared join count (collect nodes). */
  collectBatchCount?: number;
  /** Connection name (http nodes). */
  connectionName?: string;
  /** Entry subtype (entry nodes): request · schedule · when · dataChanges. */
  entryType?: string;
  /** Raw type-specific configuration, for deeper/ad-hoc checks. */
  config?: Record<string, unknown>;
}

export interface FlowVersionInfo {
  number?: string;
  description?: string;
  deployed?: boolean;
}

export interface FlowGraph {
  id: string;
  name: string;
  /** DataFlowType label (Document · Edge · Integration · Screen · System). */
  type?: string;
  nodes: FlowNode[];
  /** Version history, for the release-notes (devops) check. */
  versions?: FlowVersionInfo[];
}

// --- analysis context (cross-referenced tenant facts) ---------------------

export type DataModelType = 'master' | 'setup' | 'transactional' | string;

export interface ModelInfo {
  name: string;
  type?: DataModelType;
  /** Estimated record count, when known (drives query-scoping severity). */
  recordCount?: number;
}

export interface SavedTransformInfo {
  id: string;
  name?: string;
  /** True when the saved transform declares a non-trivial input schema. */
  hasInputSchema?: boolean;
  deprecated?: boolean;
}

/**
 * Tenant facts the flow analyzers cross-reference. Optional — when absent the
 * relevant rules degrade to weaker heuristics rather than failing.
 */
export interface FlowAnalysisContext {
  /** PascalCase model name → info (query-scoping / setup-type exception). */
  models?: Map<string, ModelInfo>;
  /** Saved-transform id → info (payload-contract check). */
  savedTransforms?: Map<string, SavedTransformInfo>;
}
