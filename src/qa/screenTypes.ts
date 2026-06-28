/**
 * Normalized shape for a Fuuz SCREEN (a flat list of ScreenElement records) so
 * the compliance analyzer can reason about it without touching raw MCP rows.
 * Pure types, no VS Code/Node imports — unit-testable in plain Node.
 */

export interface ScreenElementNode {
  id: string;
  name?: string;
  type: string;            // raw Fuuz type, e.g. 'ActionButton', 'TableColumn'
  componentName?: string;  // tab/component it lives in
  label?: string;
  /** A transform expression attached directly to this element, if any. */
  transform?: string;
  /** Data model this element binds to (Form/Table), if any. */
  model?: string;
  /** Whether the element's query carries a where/filter (Form/Table). */
  hasFilter?: boolean;
  /** Approximate serialized size of this element's configuration (chars). */
  configSize: number;
}

export interface ScreenModel {
  name: string;
  elements: ScreenElementNode[];
  /** Total configuration size across elements (chars) — proxy for embedded transforms/scripts. */
  totalConfigSize: number;
  /** Optional version/release notes presence for the screen (devops). */
  versionNotes?: { total: number; withNotes: number };
}
