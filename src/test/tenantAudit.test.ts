import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTenantAudit } from '../qa/tenantAudit';
import { ComplianceReport } from '../qa/complianceTypes';

const rep = (name: string, kind: ComplianceReport['kind'], checks: number, passed: number, findings: ComplianceReport['findings'] = []): ComplianceReport =>
  ({ kind, name, checks, passed, score: Math.round((passed / checks) * 100), rules: [], findings });

test('runTenantAudit: overall score is weighted by checks across artifacts', () => {
  const a = rep('WorkOrder', 'dataModel', 10, 10);
  const b = rep('SyncFlow', 'flow', 10, 5);
  const audit = runTenantAudit('build.mfgx', [a, b]);
  assert.equal(audit.checks, 20);
  assert.equal(audit.passed, 15);
  assert.equal(audit.score, 75);
  assert.match(audit.name, /build\.mfgx/);
});

test('runTenantAudit: scorecard lists artifacts worst-first', () => {
  const audit = runTenantAudit('t', [rep('Good', 'dataModel', 10, 10), rep('Bad', 'flow', 10, 2)]);
  assert.match(audit.rules[0].title, /Bad/); // worst score first
  assert.match(audit.rules[1].title, /Good/);
});

test('runTenantAudit: findings are artifact-prefixed and error-sorted', () => {
  const a = rep('A', 'flow', 2, 1, [{ ruleId: 'x', severity: 'warn', message: 'minor' }]);
  const b = rep('B', 'dataModel', 2, 1, [{ ruleId: 'y', severity: 'error', message: 'broken' }]);
  const audit = runTenantAudit('t', [a, b]);
  // first finding is the summary line, then errors before warns
  assert.match(audit.findings[0].message, /artifact\(s\) audited/);
  assert.equal(audit.findings[1].severity, 'error');
  assert.match(audit.findings[1].message, /^\[B\] broken/);
  assert.ok(audit.findings.some(f => f.message === '[A] minor'));
});

test('runTenantAudit: empty input is a clean 100', () => {
  const audit = runTenantAudit('t', []);
  assert.equal(audit.score, 100);
  assert.match(audit.findings[0].message, /0 artifact/);
});
