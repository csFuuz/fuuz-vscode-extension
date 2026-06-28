import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFlow, runFlowGraphCompliance, analyzeFlowsCrossCutting, normalizeScript, rootModelsOf } from '../qa/flowAnalysis';
import { FlowGraph, FlowNode, FlowAnalysisContext } from '../qa/flowTypes';

const node = (p: Partial<FlowNode> & { id: string; kind: FlowNode['kind'] }): FlowNode =>
  ({ name: 'Well Named Node', description: 'does a thing', rawType: p.kind, ...p });
const flow = (nodes: FlowNode[], name = 'My Posting Flow'): FlowGraph => ({ id: 'f1', name, type: 'System', nodes });
const rules = (g: FlowGraph, ctx?: FlowAnalysisContext) => analyzeFlow(g, ctx);
const ruleOf = (g: FlowGraph, id: string, ctx?: FlowAnalysisContext) => rules(g, ctx).find(r => r.ruleId === id)!;
const findingIds = (g: FlowGraph, ctx?: FlowAnalysisContext) => rules(g, ctx).flatMap(r => r.findings).map(f => f.ruleId);

test('multiple request entry points are surfaced (info, not error)', () => {
  const f = flow([node({ id: 'r1', kind: 'entry', entryType: 'request', name: 'From Web' }), node({ id: 'r2', kind: 'entry', entryType: 'request', name: 'From API' })]);
  const r = ruleOf(f, 'flow-entry-points');
  assert.ok(r.findings.some(x => x.severity === 'info' && /2 request entry points/.test(x.message)));
});

test('fork without a collect is allowed (parallel paths); orphan collect is flagged', () => {
  const forkOnly = flow([node({ id: 'f', kind: 'fork', name: 'Fan out', branchCount: 2 })]);
  assert.ok(!ruleOf(forkOnly, 'flow-fork-collect').findings.some(x => x.severity === 'warn'));
  const orphan = flow([node({ id: 'c', kind: 'collect', name: 'Join', collectBatchCount: 2 })]);
  assert.ok(ruleOf(orphan, 'flow-fork-collect').findings.some(x => x.severity === 'warn' && /no fork/.test(x.message)));
});

test('fork/collect count mismatch warns; matched passes', () => {
  const bad = flow([node({ id: 'f', kind: 'fork', name: 'Fan', branchCount: 3 }), node({ id: 'c', kind: 'collect', name: 'Join', collectBatchCount: 2 })]);
  assert.ok(ruleOf(bad, 'flow-fork-collect').findings.some(x => x.severity === 'warn' && /fans out 3/.test(x.message)));
  const good = flow([node({ id: 'f', kind: 'fork', name: 'Fan', branchCount: 2 }), node({ id: 'c', kind: 'collect', name: 'Join', collectBatchCount: 2 })]);
  assert.ok(!ruleOf(good, 'flow-fork-collect').findings.some(x => x.severity === 'warn'));
});

test('saved script with $ pass-through + input schema + no validate → contract warning', () => {
  const ctx: FlowAnalysisContext = { savedTransforms: new Map([['s1', { id: 's1', name: 'Calc', hasInputSchema: true }]]) };
  const f = flow([node({ id: 'n', kind: 'savedTransform', name: 'Calc', requestTransform: '$', savedRef: { id: 's1', name: 'Calc' } })]);
  assert.ok(ruleOf(f, 'flow-saved-contract', ctx).findings.some(x => x.severity === 'warn' && /no payload contract/.test(x.message)));
  // a Validate node in the flow satisfies the contract
  const withValidate = flow([
    node({ id: 'v', kind: 'validate', name: 'Validate payload' }),
    node({ id: 'n', kind: 'savedTransform', name: 'Calc', requestTransform: '$', savedRef: { id: 's1' } }),
  ]);
  assert.equal(ruleOf(withValidate, 'flow-saved-contract', ctx).findings.length, 0);
});

test('query scoping: unfiltered transactional warns; setup model is exempt; where passes', () => {
  const ctx: FlowAnalysisContext = { models: new Map([
    ['WorkOrder', { name: 'WorkOrder', type: 'transactional', recordCount: 100 }],
    ['OrderStatus', { name: 'OrderStatus', type: 'setup', recordCount: 5 }],
    ['ProductionHistory', { name: 'ProductionHistory', type: 'transactional', recordCount: 9000000 }],
  ]) };
  const unfiltered = flow([node({ id: 'q', kind: 'query', name: 'All WOs', variablesTransform: '$', query: 'query { workOrder { edges { node { id } } } }' })]);
  assert.ok(ruleOf(unfiltered, 'flow-query-scoping', ctx).findings.some(x => x.severity === 'warn'));
  const setup = flow([node({ id: 'q', kind: 'query', name: 'Statuses', variablesTransform: '$', query: 'query { orderStatus { edges { node { id } } } }' })]);
  assert.equal(ruleOf(setup, 'flow-query-scoping', ctx).findings.length, 0);
  const filtered = flow([node({ id: 'q', kind: 'query', name: 'One WO', variablesTransform: '$', query: 'query { workOrder(where: { id: { _eq: $id } }) { edges { node { id } } } }' })]);
  assert.equal(ruleOf(filtered, 'flow-query-scoping', ctx).findings.length, 0);
  const huge = flow([node({ id: 'q', kind: 'query', name: 'All history', variablesTransform: '$', query: 'query { productionHistory { edges { node { id } } } }' })]);
  assert.ok(ruleOf(huge, 'flow-query-scoping', ctx).findings.some(x => x.severity === 'error'));
});

test('query page size > 500 warns; nested result sets noted', () => {
  const f = flow([node({ id: 'q', kind: 'query', name: 'Big', query: 'query { workOrder(first: 1000) { edges { node { id lines { edges { node { id } } } } } } }' })]);
  const r = ruleOf(f, 'flow-query-pagesize');
  assert.ok(r.findings.some(x => /first: 1000/.test(x.message) && /nested/.test(x.message)));
});

test('long inline scripts (>300 lines) suggested as saved scripts; ≤300 pass', () => {
  const ok = Array.from({ length: 130 }, (_, i) => `var x${i}=${i};`).join('\n');
  assert.equal(ruleOf(flow([node({ id: 's', kind: 'inlineScript', name: 'Mid calc', script: ok })]), 'flow-long-scripts').findings.length, 0);
  const big = Array.from({ length: 320 }, (_, i) => `var x${i}=${i};`).join('\n');
  const r = ruleOf(flow([node({ id: 's', kind: 'inlineScript', name: 'Big calc', script: big })]), 'flow-long-scripts');
  const finding = r.findings.find(x => /320 lines/.test(x.message))!;
  assert.ok(finding);
  assert.equal(finding.targetId, 's');
  assert.ok(finding.suggestion && /Script/.test(finding.suggestion));
});

test('error handling: tryCatch node or in-script try/catch passes; nothing warns', () => {
  const none = flow([node({ id: 's', kind: 'inlineScript', name: 'S', script: 'return 1' })]);
  assert.equal(ruleOf(none, 'flow-error-handling').passed, 0);
  const tcNode = flow([node({ id: 't', kind: 'tryCatch', name: 'Try Main' })]);
  assert.equal(ruleOf(tcNode, 'flow-error-handling').passed, 1);
  const tcScript = flow([node({ id: 's', kind: 'inlineScript', name: 'S', script: 'try { go() } catch (e) { fail(e) }' })]);
  assert.equal(ruleOf(tcScript, 'flow-error-handling').passed, 1);
});

test('$integrate in an inline script is an error with an http-node fix', () => {
  const f = flow([node({ id: 's', kind: 'inlineScript', name: 'Call', script: 'const r = $integrate("erp", payload); return r;' })]);
  assert.ok(ruleOf(f, 'flow-integrate-in-script').findings.some(x => x.severity === 'error' && /HTTP \(integration\) node/.test(x.fix || '')));
});

test('hard-coded credentials in a script are surfaced as a risk', () => {
  for (const s of ['const apiKey = "sk-live-abc123"', "let token = 'eyJhbGciOi...'", 'password = "hunter2"', 'const passphrase="open sesame"']) {
    const f = flow([node({ id: 's', kind: 'inlineScript', name: 'S', script: s })]);
    assert.ok(ruleOf(f, 'flow-credentials').findings.some(x => x.severity === 'error'), `should flag: ${s}`);
  }
  const clean = flow([node({ id: 's', kind: 'inlineScript', name: 'S', script: 'var total = price * qty;' })]);
  assert.equal(ruleOf(clean, 'flow-credentials').findings.length, 0);
});

test('script anti-patterns: hard-coded URL + console logging', () => {
  const f = flow([node({ id: 's', kind: 'inlineScript', name: 'S', script: 'fetch("https://api.example.com/x"); console.log("hi");' })]);
  const r = ruleOf(f, 'flow-script-antipatterns');
  assert.ok(r.findings.some(x => /URL/.test(x.message)));
  assert.ok(r.findings.some(x => /console/.test(x.message)));
});

test('ambiguous flow + node names flagged; release-notes gap noted', () => {
  const f: FlowGraph = { id: 'f', name: 'New Data Flow', type: 'System', nodes: [node({ id: 'n', kind: 'jsonata', name: 'transform', script: '$' })], versions: [{ number: '0.0.1', description: '', deployed: true }] };
  const ids = findingIds(f);
  assert.ok(ids.includes('flow-naming'));
  assert.ok(ids.includes('flow-node-naming'));
  assert.ok(ruleOf(f, 'flow-version-notes').findings.some(x => /release\/version notes/.test(x.message)));
});

test('runFlowGraphCompliance: clean flow scores 100', () => {
  const f: FlowGraph = {
    id: 'f', name: 'Compute Order Totals', type: 'System',
    nodes: [
      node({ id: '1', kind: 'entry', entryType: 'request', name: 'From Web Flow' }),
      node({ id: '2', kind: 'tryCatch', name: 'Try Main' }),
      node({ id: '3', kind: 'inlineScript', name: 'Compute totals', description: 'sum lines', script: 'try { return sum() } catch(e){ throw e }' }),
      node({ id: '4', kind: 'query', name: 'Load the order', description: 'scoped', variablesTransform: '$ctx', query: 'query { workOrder(where:{id:{_eq:$id}}) { edges { node { id } } } }' }),
      node({ id: '5', kind: 'response', name: 'Return result' }),
    ],
    versions: [{ number: '0.0.2', description: 'compute totals', deployed: true }],
  };
  const rep = runFlowGraphCompliance(f);
  assert.equal(rep.kind, 'flow');
  assert.equal(rep.score, 100);
});

test('rootModelsOf extracts top-level model selections (alias + bare)', () => {
  const q = 'query($id: String!) { freshOutputs: productionSetupOutput(where:{id:{_in:$ids}}) { edges { node { id } } } freshRun: productionRun(first:1) { edges { node { id } } } }';
  const roots = rootModelsOf(q);
  assert.ok(roots.includes('productionSetupOutput'));
  assert.ok(roots.includes('productionRun'));
  assert.ok(!roots.includes('edges'));
});

test('cross-flow: repeated query + script suggest saved query/script', () => {
  const sharedScript = 'var items = input.items.map(function(i){ return { id: i.id, qty: i.qty }; }); return { items: items, count: items.length };';
  const sharedQuery = 'query { workOrder(where:{status:{_eq:"open"}}) { edges { node { id status } } } }';
  const a = flow([node({ id: 'q', kind: 'query', name: 'Open WOs', query: sharedQuery }), node({ id: 's', kind: 'inlineScript', name: 'Map', script: sharedScript })], 'Flow A');
  const b = flow([node({ id: 'q', kind: 'query', name: 'Open WOs', query: sharedQuery }), node({ id: 's', kind: 'inlineScript', name: 'Map 2', script: '/* c */ ' + sharedScript })], 'Flow B');
  const rep = analyzeFlowsCrossCutting([a, b]);
  assert.ok(rep.findings.some(f => f.ruleId === 'flow-shared-query'));
  assert.ok(rep.findings.some(f => f.ruleId === 'flow-shared-script'));
});

test('normalizeScript: comments + whitespace ignored', () => {
  assert.equal(normalizeScript('a();   // x\n/* y */ b();'), 'a(); b();');
});

test('mutexLock without a matching mutexUnlock is flagged', () => {
  const bad = flow([node({ id: 'l', kind: 'other', rawType: 'mutexLock', name: 'Lock' })]);
  assert.ok(ruleOf(bad, 'flow-mutex-balance').findings.some(x => x.severity === 'warn' && /unreleased|left/.test(x.message)));
  const ok = flow([node({ id: 'l', kind: 'other', rawType: 'mutexLock', name: 'Lock' }), node({ id: 'u', kind: 'other', rawType: 'mutexUnlock', name: 'Unlock' })]);
  assert.equal(ruleOf(ok, 'flow-mutex-balance').findings.length, 0);
});

test('multi-write flow without a try/catch boundary is flagged', () => {
  const bad = flow([node({ id: 'm1', kind: 'mutate', name: 'Write A' }), node({ id: 'm2', kind: 'mutate', name: 'Write B' })]);
  assert.ok(ruleOf(bad, 'flow-transaction-boundary').findings.some(x => x.severity === 'warn'));
  const ok = flow([node({ id: 't', kind: 'tryCatch', name: 'Try' }), node({ id: 'm1', kind: 'mutate', name: 'Write A' }), node({ id: 'm2', kind: 'mutate', name: 'Write B' })]);
  assert.equal(ruleOf(ok, 'flow-transaction-boundary').findings.length, 0);
});

test('references to a deprecated saved transform are flagged', () => {
  const ctx: FlowAnalysisContext = { savedTransforms: new Map([['old', { id: 'old', name: 'Legacy', deprecated: true }]]) };
  const f = flow([node({ id: 'n', kind: 'savedTransform', name: 'Calc', requestTransform: '$ctx', savedRef: { id: 'old', name: 'Legacy' } })]);
  assert.ok(ruleOf(f, 'flow-deprecated-ref', ctx).findings.some(x => /deprecated/.test(x.message)));
});

test('building create payloads in a script is flagged as an import risk', () => {
  const f = flow([
    node({ id: 's', kind: 'inlineScript', name: 'Build payloads', script: 'var out = []; out.push({ create: { id: 1, name: "x" } }); return { payload: out };' }),
    node({ id: 'm', kind: 'mutate', name: 'Mutate all' }),
  ]);
  assert.ok(ruleOf(f, 'flow-create-in-script').findings.some(x => x.severity === 'warn' && /data-import\/integration risk/.test(x.message)));
});

test('error-handling flow without a response node gets a standardization hint', () => {
  const f = flow([node({ id: 't', kind: 'throwError', name: 'Throw' })]);
  assert.ok(ruleOf(f, 'flow-error-response').findings.some(x => x.severity === 'info'));
});
