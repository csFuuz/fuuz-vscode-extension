import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScreenModel } from '../qa/screenDescriptor';
import { analyzeScreen, runScreenCompliance } from '../qa/screenAnalysis';

const findingIds = (rows: Record<string, any>[], name = 'Customer Orders') =>
  analyzeScreen(buildScreenModel(name, rows)).flatMap(r => r.findings).map(f => f.ruleId);

test('buildScreenModel extracts column + form transforms and computes sizes', () => {
  const rows = [
    { id: 'c1', type: 'TableColumn', name: 'Status', configuration: { label: 'Status', transform: 'x.code' } },
    { id: 'c2', type: 'TableColumn', name: 'Plain', configuration: { label: 'Plain' } },
    { id: 'f1', type: 'Form', name: 'Order', configuration: { query: { dataTransform: { transform: 'rows[0]', remote: true } } } },
    { id: 'f2', type: 'Form', name: 'NoXform', configuration: { query: { dataTransform: { transform: null } } } },
  ];
  const m = buildScreenModel('Orders', rows);
  const col = m.elements.find(e => e.id === 'c1')!;
  const plain = m.elements.find(e => e.id === 'c2')!;
  const form = m.elements.find(e => e.id === 'f1')!;
  const noForm = m.elements.find(e => e.id === 'f2')!;
  assert.equal(col.transform, 'x.code');
  assert.equal(plain.transform, undefined);
  assert.equal(form.transform, 'rows[0]');
  assert.equal(noForm.transform, undefined);
  assert.ok(col.configSize > 0);
  assert.equal(m.totalConfigSize, m.elements.reduce((n, e) => n + e.configSize, 0));
});

test('buildScreenModel is defensive about missing/odd configuration', () => {
  const m = buildScreenModel('Edge', [
    { id: 'a', type: 'TableColumn' },
    { id: 'b', type: 'TextInput', configuration: 'oops-a-string' },
  ]);
  assert.equal(m.elements[0].transform, undefined);
  assert.equal(m.elements[1].transform, undefined);
  assert.ok(m.totalConfigSize >= 0);
});

test('more than 5 action buttons is flagged (warn)', () => {
  const rows = Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, type: i % 2 ? 'FlowButton' : 'ActionButton', name: `Btn ${i}` }));
  const r = analyzeScreen(buildScreenModel('Orders', rows)).find(x => x.ruleId === 'screen-action-buttons')!;
  assert.equal(r.passed, 0);
  assert.ok(r.findings.some(f => f.severity === 'warn' && /6 action buttons/.test(f.message)));
});

test('more than 75 elements is flagged', () => {
  const rows = Array.from({ length: 80 }, (_, i) => ({ id: `e${i}`, type: 'DisplayText', name: `E${i}` }));
  const r = analyzeScreen(buildScreenModel('Big Screen', rows)).find(x => x.ruleId === 'screen-element-count')!;
  assert.equal(r.passed, 0);
  assert.ok(r.findings.some(f => /80 elements/.test(f.message)));
});

test('column and field inline transforms are each flagged with a location', () => {
  const rows = [
    { id: 'c1', type: 'TableColumn', name: 'Status', configuration: { transform: 'a.b' } },
    { id: 'f1', type: 'TextInput', name: 'Notes', configuration: { transform: 'trim($)' } },
  ];
  const rules = analyzeScreen(buildScreenModel('Orders', rows));
  const col = rules.find(r => r.ruleId === 'screen-column-transforms')!;
  const field = rules.find(r => r.ruleId === 'screen-field-transforms')!;
  assert.ok(col.findings.some(f => f.where === 'Status' && /Table-level/.test(f.message)));
  assert.ok(field.findings.some(f => f.where === 'Notes' && /Form-level/.test(f.message)));
  const ids = findingIds(rows);
  assert.ok(ids.includes('screen-column-transforms'));
  assert.ok(ids.includes('screen-field-transforms'));
});

test('ambiguous screen name "New Screen" is flagged', () => {
  const r = analyzeScreen(buildScreenModel('New Screen', [])).find(x => x.ruleId === 'screen-naming')!;
  assert.equal(r.passed, 0);
  assert.ok(r.findings.length === 1 && r.findings[0].severity === 'warn');
});

test('missing version notes is an info finding; skipped when not provided', () => {
  const withGap = analyzeScreen(buildScreenModel('Orders', [], { total: 3, withNotes: 0 })).find(x => x.ruleId === 'screen-version-notes')!;
  assert.equal(withGap.checks, 1);
  assert.equal(withGap.passed, 0);
  assert.ok(withGap.findings.some(f => f.severity === 'info'));
  const skipped = analyzeScreen(buildScreenModel('Orders', [])).find(x => x.ruleId === 'screen-version-notes')!;
  assert.equal(skipped.checks, 0);
  assert.equal(skipped.findings.length, 0);
});

test('a clean small screen scores 100', () => {
  const rows = [
    { id: 't1', type: 'Table', name: 'Orders Table' },
    { id: 'c1', type: 'TableColumn', name: 'Status', configuration: { label: 'Status' } },
    { id: 'f1', type: 'TextInput', name: 'Search', configuration: { label: 'Search' } },
    { id: 'b1', type: 'ActionButton', name: 'Refresh' },
  ];
  const rep = runScreenCompliance(buildScreenModel('Customer Orders', rows));
  assert.equal(rep.score, 100);
  assert.equal(rep.findings.length, 0);
});

test('runScreenCompliance returns kind screen and a 0-100 score', () => {
  const rep = runScreenCompliance(buildScreenModel('New Screen', []));
  assert.equal(rep.kind, 'screen');
  assert.ok(rep.score >= 0 && rep.score <= 100);
});
