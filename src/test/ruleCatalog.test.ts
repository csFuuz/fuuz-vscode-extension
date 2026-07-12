import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogRules, filterReport } from '../qa/ruleCatalog';
import { ComplianceReport } from '../qa/complianceTypes';

test('catalogRules lists rules across categories with ids + titles', () => {
  const cat = catalogRules();
  const ids = new Set(cat.map(r => r.id));
  assert.ok(ids.has('flow-node-naming'));
  assert.ok(ids.has('screen-column-descriptions'));
  assert.ok(ids.has('setup-required-fields'));
  assert.ok(ids.has('app-roles'));
  assert.ok(cat.every(r => r.title && r.category));
  assert.equal(new Set(cat.map(r => r.id)).size, cat.length, 'ids are unique');
});

test('filterReport drops excluded rules and recomputes score', () => {
  const report: ComplianceReport = {
    kind: 'flow', name: 'F', score: 50, checks: 2, passed: 1,
    rules: [
      { ruleId: 'flow-node-naming', title: 'Nodes named', checks: 1, passed: 0, findings: [{ ruleId: 'flow-node-naming', severity: 'warn', message: 'x' }] },
      { ruleId: 'flow-node-descriptions', title: 'Descriptions', checks: 1, passed: 1, findings: [] },
    ],
    findings: [{ ruleId: 'flow-node-naming', severity: 'warn', message: 'x' }],
  };
  const filtered = filterReport(report, new Set(['flow-node-naming']));
  assert.equal(filtered.rules.length, 1);
  assert.equal(filtered.findings.length, 0);
  assert.equal(filtered.checks, 1);
  assert.equal(filtered.passed, 1);
  assert.equal(filtered.score, 100);
});

test('filterReport is a no-op with an empty exclusion set', () => {
  const report: ComplianceReport = { kind: 'flow', name: 'F', score: 100, checks: 1, passed: 1, rules: [{ ruleId: 'a', title: 'A', checks: 1, passed: 1, findings: [] }], findings: [] };
  assert.equal(filterReport(report, new Set()), report);
});
