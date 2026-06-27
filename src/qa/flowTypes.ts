/**
 * Normalized model of a Fuuz data-flow diagram for compliance analysis. The
 * adapter ([qa/flowDescriptor.ts]) maps `DataFlowElement` records read over MCP
 * into this shape; the analyzers ([qa/flowAnalysis.ts]) are pure and operate only
 * on this model, so they're fully unit-testable without a live tenant.
 */

/** Normalized node kinds the analyzers reason about. */
export type FlowNodeType =
  | 'script'
  | 'query'
  | 'branch'
  | 'collect'
  | 'broadcast'
  | 'delay'
  | 'integration'
  | 'errorResponse'
  | 'start'
  | 'output'
  | 'other';

export interface FlowNode {
  id: string;
  name?: string;
  description?: string;
  type: FlowNodeType;
  /** Raw node-type label from Fuuz (for messages), e.g. "Script", "Broadcast". */
  rawType?: string;
  /** Script body, for `script` nodes. */
  script?: string;
  /** Normalized query signature (model + sorted fields), for `query` nodes. */
  query?: string;
  /** Number of branches, for `branch` nodes. */
  branchCount?: number;
  /** Number of payloads collected, for `collect` nodes. */
  collectCount?: number;
}

export interface FlowGraph {
  name: string;
  /** DataFlowType label (Document · Edge · Integration · Screen · System). */
  type?: string;
  nodes: FlowNode[];
}
