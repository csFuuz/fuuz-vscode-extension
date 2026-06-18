/**
 * Wire types for the interactive ERD, shared between the extension host and the
 * React Flow webview bundle. Pure interfaces with **no runtime and no Node/VS
 * Code imports** so esbuild can bundle this into the browser webview safely.
 */

export type ErdService = 'system' | 'application';

export interface ErdField {
  name: string;
  type: string;
}

export interface ErdNode {
  /** Model name; unique within a graph and used as the React Flow node id. */
  name: string;
  service: ErdService;
  /** The focal model of a single-model ERD (rendered emphasized, pre-expanded). */
  focal?: boolean;
  /**
   * Scalar fields. `undefined` means "not loaded yet" — the webview can request
   * them lazily (expand) so large graphs don't fetch every model up front. An
   * empty array means "loaded, no scalar fields".
   */
  fields?: ErdField[];
}

export interface ErdEdgeJson {
  from: string;
  to: string;
  /** Relationship label (the FK / object-relation field name). */
  label: string;
  /** Cardinality at the `to` end: true ⇒ `from` has many `to` (crow's foot on `to`). */
  toMany: boolean;
  /** Cardinality at the `from` end: true ⇒ `to` has many `from` (crow's foot on `from`). */
  fromMany: boolean;
}

export interface ErdGraph {
  nodes: ErdNode[];
  edges: ErdEdgeJson[];
}

// --- Webview ↔ extension messages -----------------------------------------

/** Webview → extension. */
export type ErdOutbound =
  | { type: 'ready' }
  | { type: 'expandNode'; name: string; service: ErdService }
  | { type: 'expandNeighbors'; name: string; service: ErdService }
  | { type: 'queryModel'; name: string; service: ErdService }
  | { type: 'saveLayout'; positions: Record<string, { x: number; y: number }> };

/** Extension → webview. */
export type ErdInbound =
  | { type: 'init'; title: string; graph: ErdGraph; positions: Record<string, { x: number; y: number }> }
  | { type: 'nodeFields'; name: string; fields: ErdField[]; error?: string }
  | { type: 'addGraph'; source: string; graph: ErdGraph; error?: string };
