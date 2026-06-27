import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFlow, runFlowGraphCompliance, analyzeFlowsCrossCutting, normalizeScript } from '../qa/flowAnalysis';
import { FlowGraph, FlowNode } from '../qa/flowTypes';

const node = (p: Partial<FlowNode> & { id: string; type: FlowNode['type'] }): FlowNode => ({ name: 'Well Named Node', description: 'does a thing', ...p });
const flow = (nodes: FlowNode[], name = 'MyFlow'): FlowGraph => ({ name, type: 'Edge', nodes });
const findingIds = (g: FlowGraph) => analyzeFlow(g).flatMap(r => r.findings).map(f => f.ruleId);

test('broadcast nodes are surfaced (info)', () => {
  const f = flow([node({ id: 'b', type: 'broadcast', name: 'Fan out' })]);
  const fb = analyzeFlow(f).find(r => r.ruleId === 'flow-broadcast')!;
  assert.equal(fb.findings.length, 1);
  assert.equal(fb.findings[0].severity, 'info');
});

test('branch/collect mismatch is an error; balanced passes', () => {
  const bad = flow([node({ id: '1', type: 'branch', branchCount: 3 }), node({ id: '2', type: 'collect', collectCount: 2 })]);
  assert.ok(analyzeFlow(bad).find(r => r.ruleId === 'flow-branch-collect')!.findings.some(f => f.severity === 'error'));
  const good = flow([node({ id: '1', type: 'branch', branchCount: 2 }), node({ id: '2', type: 'collect', collectCount: 2 })]);
  assert.equal(analyzeFlow(good).find(r => r.ruleId === 'flow-branch-collect')!.findings.length, 0);
});

test('branch without a collect is flagged', () => {
  const f = flow([node({ id: '1', type: 'branch', branchCount: 2 })]);
  assert.ok(analyzeFlow(f).find(r => r.ruleId === 'flow-branch-collect')!.findings.some(f => /branch node/.test(f.message)));
});

test('default/missing names and missing descriptions are flagged', () => {
  const f = flow([
    node({ id: '1', type: 'script', name: 'Script 1', script: 'return {}' }), // default-looking
    node({ id: '2', type: 'output', name: '', description: '' }),             // no name/desc
  ]);
  const ids = findingIds(f);
  assert.ok(ids.includes('flow-node-naming'));
  assert.ok(ids.includes('flow-node-descriptions'));
});

test('duplicate node names flagged', () => {
  const f = flow([node({ id: '1', type: 'script', name: 'Dup', script: 'x' }), node({ id: '2', type: 'output', name: 'Dup' })]);
  assert.ok(findingIds(f).includes('flow-duplicate-names'));
});

test('long scripts (>100 lines) suggested as saved scripts', () => {
  const big = Array.from({ length: 130 }, (_, i) => `const x${i}=${i};`).join('\n');
  const f = flow([node({ id: '1', type: 'script', name: 'Big', script: big })]);
  const r = analyzeFlow(f).find(r => r.ruleId === 'flow-long-scripts')!;
  assert.ok(r.findings.some(x => /130 lines/.test(x.message)));
});

test('missing error handling warns; try/catch or error node passes', () => {
  const none = flow([node({ id: '1', type: 'script', name: 'S', script: 'return 1' })]);
  assert.equal(analyzeFlow(none).find(r => r.ruleId === 'flow-error-handling')!.passed, 0);
  const tc = flow([node({ id: '1', type: 'script', name: 'S', script: 'try { go() } catch (e) { fail(e) }' })]);
  assert.equal(analyzeFlow(tc).find(r => r.ruleId === 'flow-error-handling')!.passed, 1);
  const en = flow([node({ id: '1', type: 'errorResponse', name: 'On error' })]);
  assert.equal(analyzeFlow(en).find(r => r.ruleId === 'flow-error-handling')!.passed, 1);
});

test('delay nodes raise a warning', () => {
  const f = flow([node({ id: '1', type: 'delay', name: 'Wait 5s' })]);
  const r = analyzeFlow(f).find(r => r.ruleId === 'flow-delay')!;
  assert.equal(r.findings[0].severity, 'warn');
});

test('$integrate in a script is an error with a fix', () => {
  const f = flow([node({ id: '1', type: 'script', name: 'Call', script: 'const r = $integrate("erp", payload); return r;' })]);
  const r = analyzeFlow(f).find(r => r.ruleId === 'flow-integrate-in-script')!;
  assert.ok(r.findings.some(x => x.severity === 'error' && /Integration node/.test(x.fix || '')));
});

test('hard-coded credentials in a script are surfaced as a risk', () => {
  for (const s of ['const apiKey = "sk-live-abc123"', "let token: 'eyJhbGciOi...'", 'password = "hunter2"', 'const passphrase="open sesame"']) {
    const f = flow([node({ id: '1', type: 'script', name: 'S', script: s })]);
    assert.ok(analyzeFlow(f).find(r => r.ruleId === 'flow-credentials')!.findings.some(x => x.severity === 'error'), `should flag: ${s}`);
  }
  const clean = flow([node({ id: '1', type: 'script', name: 'S', script: 'const total = price * qty;' })]);
  assert.equal(analyzeFlow(clean).find(r => r.ruleId === 'flow-credentials')!.findings.length, 0);
});

test('script anti-patterns: hard-coded URL + console logging', () => {
  const f = flow([node({ id: '1', type: 'script', name: 'S', script: 'fetch("https://api.example.com/x"); console.log("hi");' })]);
  const r = analyzeFlow(f).find(r => r.ruleId === 'flow-script-antipatterns')!;
  assert.ok(r.findings.some(x => /URL/.test(x.message)));
  assert.ok(r.findings.some(x => /console/.test(x.message)));
});

test('runFlowGraphCompliance: clean flow scores 100', () => {
  const f = flow([
    node({ id: '1', type: 'start', name: 'Start' }),
    node({ id: '2', type: 'script', name: 'Compute totals', description: 'sum lines', script: 'try { return sum() } catch(e){ throw e }' }),
    node({ id: '3', type: 'errorResponse', name: 'On error' }),
    node({ id: '4', type: 'output', name: 'Return result' }),
  ]);
  const rep = runFlowGraphCompliance(f);
  assert.equal(rep.kind, 'flow');
  assert.equal(rep.score, 100);
});

test('cross-flow: repeated query + script suggest saved query/script', () => {
  const sharedScript = 'const items = input.items.map(i => ({ id: i.id, qty: i.qty })); return { items, count: items.length };';
  const a = flow([
    node({ id: 'q', type: 'query', name: 'Open WOs', query: 'WorkOrder:id,status' }),
    node({ id: 's', type: 'script', name: 'Map', script: sharedScript }),
  ], 'FlowA');
  const b = flow([
    node({ id: 'q', type: 'query', name: 'Open WOs', query: 'WorkOrder:id,status' }),
    node({ id: 's', type: 'script', name: 'Map2', script: '/* c */ ' + sharedScript }),
  ], 'FlowB');
  const rep = analyzeFlowsCrossCutting([a, b]);
  assert.ok(rep.findings.some(f => f.ruleId === 'flow-shared-query'));
  assert.ok(rep.findings.some(f => f.ruleId === 'flow-shared-script'));
});

test('normalizeScript: comments + whitespace ignored', () => {
  assert.equal(normalizeScript('a();   // x\n/* y */ b();'), 'a(); b();');
});
