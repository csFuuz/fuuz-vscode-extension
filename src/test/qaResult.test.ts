import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQaResult, resultTotals } from '../qa/resultTypes';

test('parseQaResult: normalizes a well-formed result', () => {
  const r = parseQaResult({
    summary: 'mostly good',
    personas: [{ name: 'Operator', steps: [
      { title: 'Landing', status: 'pass' },
      { title: 'Create', status: 'fail', notes: 'save errored', evidence: 'artifacts/create.png' },
    ] }],
    defects: [{ severity: 'high', title: 'Save fails', fix: 'handle 500' }],
    uxNotes: [{ area: 'nav', note: 'deep nesting', recommendation: 'flatten' }],
  });
  assert.equal(r.personas[0].steps[1].status, 'fail');
  assert.equal(r.defects[0].severity, 'high');
  const t = resultTotals(r);
  assert.deepEqual(t, { steps: 2, passed: 1, failed: 1, defects: 1 });
});

test('parseQaResult: coerces odd status/severity strings', () => {
  const r = parseQaResult({
    personas: [{ name: 'X', steps: [{ title: 'a', status: 'SUCCESS' }, { title: 'b', status: 'broken' }] }],
    defects: [{ title: 'd', severity: 'critical' }, { title: 'e', severity: 'minor' }],
  });
  assert.equal(r.personas[0].steps[0].status, 'pass');
  assert.equal(r.personas[0].steps[1].status, 'fail');
  assert.equal(r.defects[0].severity, 'high');
  assert.equal(r.defects[1].severity, 'low');
});

test('parseQaResult: folds a flat steps array into one persona', () => {
  const r = parseQaResult({ steps: [{ title: 'a', status: 'pass' }] });
  assert.equal(r.personas.length, 1);
  assert.equal(r.personas[0].steps[0].title, 'a');
});

test('parseQaResult: tolerates missing/empty input', () => {
  const r = parseQaResult({});
  assert.deepEqual(r.personas, []);
  assert.deepEqual(r.defects, []);
  assert.deepEqual(r.uxNotes, []);
  assert.equal(resultTotals(r).steps, 0);
});

test('parseQaResult: accepts ux/grooming aliases and missing titles', () => {
  const r = parseQaResult({ grooming: [{ note: 'spacing' }], defects: [{}] });
  assert.equal(r.uxNotes[0].note, 'spacing');
  assert.equal(r.defects[0].title, '(defect)');
  assert.equal(r.defects[0].severity, 'medium'); // default
});
