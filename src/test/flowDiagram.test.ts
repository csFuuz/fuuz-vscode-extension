import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFlowDiagram, diagramNeedsBuild, ensureFlowDiagram, stripFlowDiagram } from '../qa/flowDiagram';

test('stripFlowDiagram: removes a model-built diagram so the platform auto-generates it', () => {
  const r = stripFlowDiagram({ version: { flow: { id: 'f', nodes: [{ id: 'n1' }] }, diagram: { layers: [] } }, diagramFormat: 'json' });
  assert.equal((r.payload as any).version.diagram, undefined, 'version.diagram removed');
  assert.equal((r.payload as any).diagramFormat, undefined, 'diagramFormat hint removed');
  assert.match(r.note || '', /removed the hand-built flow diagram/);
});

test('stripFlowDiagram: also strips a top-level diagram; no-op when absent or "null"', () => {
  assert.equal((stripFlowDiagram({ diagram: { x: 1 } }).payload as any).diagram, undefined);
  assert.equal(stripFlowDiagram({ version: { flow: { nodes: [] } } }).note, undefined, 'no diagram → no note');
  assert.equal((stripFlowDiagram({ version: { diagram: 'null' } }).payload as any).version.diagram, 'null', 'explicit "null" is left (server parses it)');
});

const NODES = [
  { id: 'n1', name: 'Start', type: 'request', data: { nextNodes: ['n2'] } },
  { id: 'n2', name: 'Process', type: 'transform', data: { nextNodes: [] } },
];

test('buildFlowDiagram: a diagram node per flow node (same ids) + typed layers', () => {
  const d = buildFlowDiagram(NODES, 'ver1') as any;
  assert.equal(d.id, 'ver1');
  const layers = d.layers;
  assert.equal(layers.length, 2);
  const nodeLayer = layers.find((l: any) => l.type === 'diagram-nodes');
  const linkLayer = layers.find((l: any) => l.type === 'diagram-links');
  assert.ok(nodeLayer && linkLayer, 'has both typed layers');
  assert.deepEqual(Object.keys(nodeLayer.models).sort(), ['n1', 'n2']);
  // every diagram node has a type + position + ports
  for (const m of Object.values<any>(nodeLayer.models)) {
    assert.ok(m.type, 'node model has type');
    assert.equal(typeof m.x, 'number');
    assert.equal(m.ports.length, 2);
  }
  // the n1->n2 connection produced a link
  assert.equal(Object.keys(linkLayer.models).length, 1);
  const link = Object.values<any>(linkLayer.models)[0];
  assert.equal(link.source, 'n1');
  assert.equal(link.target, 'n2');
});

test('diagramNeedsBuild: true for missing/empty/untyped, false for a good one', () => {
  assert.equal(diagramNeedsBuild(undefined, 2), true);
  assert.equal(diagramNeedsBuild({}, 2), true);
  assert.equal(diagramNeedsBuild({ layers: [] }, 2), true);
  assert.equal(diagramNeedsBuild(buildFlowDiagram(NODES, 'v'), 2), false);
  assert.equal(diagramNeedsBuild(undefined, 0), false); // no nodes → nothing to build
});

test('ensureFlowDiagram: fills a missing diagram from version.flow.nodes', () => {
  const payload: any = { header: { dataFlowTypeId: 'System' }, version: { id: 'v9', flow: { id: 'v9', type: 'System', nodes: NODES } } };
  const { payload: outRaw, note } = ensureFlowDiagram(payload);
  const out = outRaw as any;
  assert.ok(note && /auto-generated the flow diagram/.test(note));
  assert.ok(out.version.diagram, 'diagram was added');
  assert.equal(out.version.diagram.layers.length, 2);
});

test('ensureFlowDiagram: does not clobber a diagram the model already built', () => {
  const good = buildFlowDiagram(NODES, 'v');
  const payload: any = { version: { flow: { id: 'v', type: 'System', nodes: NODES }, diagram: good } };
  const { note } = ensureFlowDiagram(payload);
  assert.equal(note, undefined, 'left the existing valid diagram alone');
});

test('ensureFlowDiagram: no-op when there are no nodes', () => {
  const payload: any = { version: { flow: { type: 'System', nodes: [] } } };
  const { note } = ensureFlowDiagram(payload);
  assert.equal(note, undefined);
});
