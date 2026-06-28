import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFlowFixPlan, buildTenantFixPlan } from '../qa/remediation';
import { runFlowGraphCompliance, analyzeFlowsCrossCutting } from '../qa/flowAnalysis';
import { FlowGraph, FlowNode } from '../qa/flowTypes';

const node = (p: Partial<FlowNode> & { id: string; kind: FlowNode['kind'] }): FlowNode =>
  ({ rawType: p.kind, ...p });

const messyFlow = (): FlowGraph => ({
  id: 'postingFlow', name: 'New Data Flow', type: 'System',
  versions: [{ number: '0.0.1', description: '', deployed: true }],
  nodes: [
    node({ id: 'postingFlow.a', kind: 'entry', entryType: 'request', name: 'Request' }),
    node({ id: 'postingFlow.b', kind: 'query', name: 'Query 1', variablesTransform: '$', query: 'query { workOrder { edges { node { id } } } }' }),
    node({ id: 'postingFlow.c', kind: 'inlineScript', name: 'Script 1', script: '/**\n * corePostingCalculation\n */\n' + Array.from({ length: 320 }, (_, i) => `var x${i}=${i};`).join('\n') }),
    node({ id: 'postingFlow.d', kind: 'savedTransform', name: 'Saved', requestTransform: '$', savedRef: { id: 's1', name: 'Calc' } }),
  ],
});

test('buildFlowFixPlan renders actionable sections with node ids + suggestions', () => {
  const g = messyFlow();
  const md = buildFlowFixPlan(g, runFlowGraphCompliance(g, { savedTransforms: new Map([['s1', { id: 's1', hasInputSchema: true }]]) }));
  assert.ok(md.includes('# Fuuz fix plan'));
  assert.ok(md.includes('system_data_flow_mutations'));
  assert.ok(/Rename nodes/.test(md));
  assert.ok(md.includes('postingFlow.b')); // a node id appears in the plan
  assert.ok(/Extract long inline scripts/.test(md));
  assert.ok(/payload contract/i.test(md));
  assert.ok(/Scope or paginate/.test(md));
});

test('buildFlowFixPlan on a clean flow says nothing to do', () => {
  const clean: FlowGraph = {
    id: 'f', name: 'Compute Order Totals', type: 'System',
    versions: [{ number: '0.1.0', description: 'init', deployed: true }],
    nodes: [
      node({ id: 'f.1', kind: 'entry', entryType: 'request', name: 'From Web Flow', description: 'entry' }),
      node({ id: 'f.2', kind: 'tryCatch', name: 'Try Main', description: 'guard' }),
      node({ id: 'f.3', kind: 'response', name: 'Return Result', description: 'ok' }),
    ],
  };
  const md = buildFlowFixPlan(clean, runFlowGraphCompliance(clean));
  assert.ok(/compliant/i.test(md));
});

test('buildTenantFixPlan includes cross-flow extraction + worst-first flows', () => {
  const shared = 'var items = ctx.items.map(function(i){ return { id: i.id, qty: i.qty }; }); return { items: items };';
  const a: FlowGraph = { id: 'A', name: 'Flow A', nodes: [node({ id: 'A.s', kind: 'inlineScript', name: 'Map', script: shared })] };
  const b: FlowGraph = { id: 'B', name: 'Flow B', nodes: [node({ id: 'B.s', kind: 'inlineScript', name: 'Map', script: '/* v2 */ ' + shared })] };
  const cross = analyzeFlowsCrossCutting([a, b]);
  const md = buildTenantFixPlan('mesIsa88Development', {
    flows: [{ graph: a, report: runFlowGraphCompliance(a) }, { graph: b, report: runFlowGraphCompliance(b) }],
    cross,
    screens: [],
  });
  assert.ok(md.includes('Shared logic across flows'));
  assert.ok(/Saved Script/.test(md));
  assert.ok(md.includes('Flow A') || md.includes('Flow B'));
});
