import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

export const COLLAPSED_W = 210;
export const COLLAPSED_H = 44;
const ROW_H = 20;

/** Estimated rendered size of a node, so dagre can avoid overlaps. */
export function nodeSize(node: Node): { width: number; height: number } {
  const data: any = node.data || {};
  const expanded = data.expanded && Array.isArray(data.fields);
  const rows = expanded ? Math.min(data.fields.length, 30) : 0;
  return { width: COLLAPSED_W, height: COLLAPSED_H + rows * ROW_H + (expanded ? 8 : 0) };
}

/**
 * Layered left-to-right layout via dagre. Used to seed positions; after this the
 * user drags freely and positions are persisted. Nodes that already have a
 * `position` from saved layout keep it (only un-positioned nodes are placed).
 */
export function layout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 90, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    const { width, height } = nodeSize(n);
    g.setNode(n.id, { width, height });
  }
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  }
  dagre.layout(g);

  return nodes.map(n => {
    const p = g.node(n.id);
    const { width, height } = nodeSize(n);
    return p ? { ...n, position: { x: p.x - width / 2, y: p.y - height / 2 } } : n;
  });
}
