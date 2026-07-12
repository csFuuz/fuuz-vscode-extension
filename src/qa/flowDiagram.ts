/**
 * Deterministic diagram generator for Fuuz data flows.
 *
 * A flow has TWO parallel parts: `version.flow.nodes` (execution) and
 * `version.diagram` (the visual layout the designer renders). Every flow node
 * needs a matching diagram node with the SAME id, or the designer shows nothing —
 * the "no nodes appearing in the flow" defect. Models are unreliable at producing
 * diagram geometry (positions/ports/links) and often send an empty `{}` (which
 * fails validation: "data must have required property 'type'"). So we build the
 * diagram from the nodes ourselves. Pure + unit-testable (no VS Code / IO).
 */

interface FlowNodeLike {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  data?: Record<string, unknown>;
  debug?: unknown;
  logging?: unknown;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** All downstream node ids referenced by a node's data (nextNodes + named ports). */
function outgoing(data: Record<string, unknown> | undefined): string[] {
  if (!isObj(data)) return [];
  const ids: string[] = [];
  const push = (v: unknown) => { if (Array.isArray(v)) for (const x of v) { if (typeof x === 'string') ids.push(x); } };
  push(data.nextNodes);
  push(data.onTrueNextNodes);
  push(data.onFalseNextNodes);
  push(data.onConfirmNextNodes);
  push(data.onDeclineNextNodes);
  push((data as any).catchNode ? [(data as any).catchNode] : undefined);
  for (const b of Array.isArray((data as any).branches) ? (data as any).branches : []) {
    if (isObj(b)) push(b.nextNodes);
  }
  return ids;
}

/** True when a diagram is missing, empty, or lacks the required typed layers. */
export function diagramNeedsBuild(diagram: unknown, nodeCount: number): boolean {
  if (nodeCount === 0) return false; // nothing to lay out (empty-nodes guard handles this)
  if (!isObj(diagram)) return true;
  const layers = Array.isArray(diagram.layers) ? diagram.layers : [];
  if (layers.length === 0) return true;
  const hasNodesLayer = layers.some(l => isObj(l) && l.type === 'diagram-nodes' && isObj(l.models) && Object.keys(l.models as object).length > 0);
  return !hasNodesLayer;
}

/**
 * Build a valid diagram (typed link + node layers, a diagram node per flow node
 * with the same id, ports, and links derived from the connections) laid out on a
 * simple grid. `diagramId` should be the version/flow id.
 */
export function buildFlowDiagram(nodes: FlowNodeLike[], diagramId: string): Record<string, unknown> {
  const COL_W = 260, ROW_H = 140, PER_COL = 6;
  const linkModels: Record<string, unknown> = {};
  const nodeModels: Record<string, unknown> = {};
  const outPortLinks: Record<string, string[]> = {};
  const inPortLinks: Record<string, string[]> = {};

  const ids = nodes.map((n, i) => str(n.id) || `node-${i}`);

  // Links first, so we can attach link ids to the ports.
  nodes.forEach((n, i) => {
    const from = ids[i];
    for (const rawTarget of outgoing(n.data)) {
      if (!ids.includes(rawTarget)) continue; // skip dangling refs
      const linkId = `${from}__${rawTarget}`;
      linkModels[linkId] = {
        id: linkId, type: 'default',
        source: from, sourcePort: `${from}-out`,
        target: rawTarget, targetPort: `${rawTarget}-in`,
        points: [],
      };
      (outPortLinks[from] ??= []).push(linkId);
      (inPortLinks[rawTarget] ??= []).push(linkId);
    }
  });

  nodes.forEach((n, i) => {
    const id = ids[i];
    const x = (Math.floor(i / PER_COL)) * COL_W + 80;
    const y = (i % PER_COL) * ROW_H + 80;
    nodeModels[id] = {
      id,
      type: str(n.type) || 'transform',
      x, y,
      name: str(n.name) || id,
      data: isObj(n.data) ? n.data : {},
      debug: isObj(n.debug) ? n.debug : {},
      logging: isObj(n.logging) ? n.logging : {},
      selected: false,
      ports: [
        { id: `${id}-in`, type: 'default', x: x, y: y, parentNode: id, links: inPortLinks[id] ?? [], in: true, fieldLabel: 'Input', fieldPath: 'data.nextNodes' },
        { id: `${id}-out`, type: 'default', x: x, y: y, parentNode: id, links: outPortLinks[id] ?? [], in: false, fieldLabel: 'Output', fieldPath: 'data.nextNodes' },
      ],
    };
  });

  return {
    id: diagramId || 'diagram',
    offsetX: 0, offsetY: 0, zoom: 100, gridSize: 5,
    layers: [
      { id: 'layer-links', type: 'diagram-links', isSvg: true, transformed: true, models: linkModels },
      { id: 'layer-nodes', type: 'diagram-nodes', isSvg: false, transformed: true, models: nodeModels },
    ],
  };
}

/**
 * Preprocess a data-flow mutation payload: if the flow has nodes but the diagram
 * is missing/empty/invalid, generate one from the nodes so the designer renders.
 * Returns the (possibly updated) payload + a note when it acted. Never throws.
 */
export function ensureFlowDiagram(payload: Record<string, unknown>): { payload: Record<string, unknown>; note?: string } {
  try {
    const version = isObj(payload.version) ? payload.version : undefined;
    const flow = (version && isObj(version.flow) ? version.flow : undefined) ?? (isObj(payload.flow) ? payload.flow : undefined);
    if (!flow) return { payload };
    const nodes = Array.isArray(flow.nodes) ? (flow.nodes as FlowNodeLike[]) : [];
    if (nodes.length === 0) return { payload }; // empty-nodes guard rejects this separately
    const container = version ?? payload; // diagram sits beside flow in the version container
    if (!diagramNeedsBuild((container as any).diagram, nodes.length)) return { payload };
    const diagramId = str((flow as any).id) || str((version as any)?.id) || 'diagram';
    (container as any).diagram = buildFlowDiagram(nodes, diagramId);
    return { payload, note: `auto-generated the flow diagram from ${nodes.length} node(s) so they render in the designer` };
  } catch {
    return { payload };
  }
}

/**
 * Preprocess a data-flow mutation: REMOVE any diagram the model built so the field
 * is omitted and the Fuuz platform auto-generates it. Per the server tool's own
 * guidance, manually-built diagrams have wrong ports/layout and break the designer
 * — and models keep sending them despite the instruction, so we strip it in code
 * rather than rely on the model obeying. Never throws.
 */
export function stripFlowDiagram(payload: Record<string, unknown>): { payload: Record<string, unknown>; note?: string } {
  let removed = false;
  const drop = (obj: Record<string, unknown>) => {
    if ('diagram' in obj && obj.diagram !== undefined && obj.diagram !== null && obj.diagram !== 'null') {
      delete obj.diagram;
      removed = true;
    }
  };
  const out: Record<string, unknown> = { ...payload };
  if (isObj(out.version)) { const v = { ...(out.version as Record<string, unknown>) }; drop(v); out.version = v; }
  drop(out);
  // The diagramFormat hint is meaningless once the diagram is gone.
  if (removed && 'diagramFormat' in out) delete out.diagramFormat;
  return removed
    ? { payload: out, note: 'auto-fix: removed the hand-built flow diagram — the Fuuz platform auto-generates it from your nodes (manual diagrams break the designer UI).' }
    : { payload };
}
