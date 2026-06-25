import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCompliance } from '../qa/complianceChecker';
import { parseOutline, kindFromFileName, stripJsonComments } from '../qa/outline';
import { scaffoldFor } from '../qa/scaffolds';

test('kindFromFileName: maps scaffold extensions to kinds', () => {
  assert.equal(kindFromFileName('WorkOrder.model.jsonc'), 'dataModel');
  assert.equal(kindFromFileName('orders.query.jsonc'), 'query');
  assert.equal(kindFromFileName('Sync.flow.jsonc'), 'flow');
  assert.equal(kindFromFileName('List.screen.jsonc'), 'screen');
  assert.equal(kindFromFileName('calc.script.js'), 'script');
  assert.equal(kindFromFileName('readme.md'), undefined);
});

test('stripJsonComments: removes // and /* */ but keeps strings', () => {
  const src = '{ "a": 1, "url": "http://x" /* keep */ }';
  const out = JSON.parse(stripJsonComments(src));
  assert.equal(out.a, 1);
  assert.equal(out.url, 'http://x'); // the // inside the string must survive
});

test('every generated scaffold parses and scores without throwing', () => {
  for (const kind of ['dataModel', 'query', 'flow', 'screen', 'script'] as const) {
    const s = scaffoldFor(kind, 'WorkOrder');
    const d = parseOutline(kind, s.content, 'WorkOrder');
    const r = runCompliance(d);
    assert.ok(r.score >= 0 && r.score <= 100, `${kind} score in range`);
  }
});

test('query profile: flags empty fields and non-PascalCase model', () => {
  const d = parseOutline('query', JSON.stringify({ modelName: 'work_order', fields: [], where: {} }));
  const r = runCompliance(d);
  assert.ok(r.findings.some(f => f.ruleId === 'query-model'));
  assert.ok(r.findings.some(f => f.ruleId === 'query-fields' && f.severity === 'error'));
});

test('query profile: well-formed query scores 100', () => {
  const d = parseOutline('query', JSON.stringify({ modelName: 'WorkOrder', fields: ['id', 'code'], where: {}, orderBy: [{ field: 'code', direction: 'asc' }] }));
  const r = runCompliance(d);
  assert.equal(r.score, 100);
});

test('flow profile: rejects an unknown flow type, accepts a real one', () => {
  const bad = runCompliance(parseOutline('flow', JSON.stringify({ name: 'X', type: 'Backend', nodes: [{ id: 'a' }] })));
  assert.ok(bad.findings.some(f => f.ruleId === 'flow-type' && f.severity === 'error'));
  const good = runCompliance(parseOutline('flow', JSON.stringify({ name: 'X', type: 'Edge', nodes: [{ id: 'a' }] })));
  assert.ok(!good.findings.some(f => f.ruleId === 'flow-type'));
});

test('flow profile: duplicate / missing node ids are errors', () => {
  const r = runCompliance(parseOutline('flow', JSON.stringify({ name: 'X', type: 'Edge', nodes: [{ id: 'a' }, { id: 'a' }, {}] })));
  const ids = r.findings.filter(f => f.ruleId === 'flow-node-ids');
  assert.ok(ids.length >= 2);
});

test('screen profile: unknown layout warns, known layout passes', () => {
  const r = runCompliance(parseOutline('screen', JSON.stringify({ name: 'S', layout: 'wizard', dataModel: 'WorkOrder', components: [{}] })));
  assert.ok(r.findings.some(f => f.ruleId === 'screen-layout' && f.severity === 'warn'));
});

test('script profile: needs a handler and a return', () => {
  const r = runCompliance(parseOutline('script', 'const x = 1;'));
  assert.ok(r.findings.some(f => f.ruleId === 'script-handler'));
  assert.ok(r.findings.some(f => f.ruleId === 'script-returns'));
});

test('parseOutline: invalid JSON throws OutlineParseError', () => {
  assert.throws(() => parseOutline('query', '{ not json'), /valid JSON/);
});
