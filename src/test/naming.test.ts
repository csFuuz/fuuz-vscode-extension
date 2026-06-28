import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeName, isAmbiguousName } from '../qa/naming';

test('flags placeholders and scaffold names', () => {
  for (const n of ['New Screen', 'New Data Flow', 'Untitled', 'test', 'Copy of Flow', 'temp', 'draft']) {
    assert.equal(isAmbiguousName(n), true, `should flag: ${n}`);
  }
});

test('flags default node labels and too-short names', () => {
  assert.equal(isAmbiguousName('Node 1', 'Node'), true);
  assert.equal(isAmbiguousName('transform', 'Node'), true);
  assert.equal(isAmbiguousName('If Else', 'Node'), true);
  assert.equal(isAmbiguousName('ab'), true);
});

test('flags single vague words and numbered copies', () => {
  assert.equal(isAmbiguousName('data'), true);
  assert.equal(isAmbiguousName('Form 2'), true);
  assert.equal(judgeName('Form 2').risk, 'numbered-copy');
});

test('accepts clear, descriptive names', () => {
  for (const n of ['Compute Order Totals', 'Work Order Management Web Flow', 'Production Posting Validation', 'Load the open work orders']) {
    assert.equal(isAmbiguousName(n), false, `should accept: ${n}`);
  }
});

test('judgeName returns a reason when ambiguous', () => {
  const v = judgeName('', 'Flow');
  assert.equal(v.ambiguous, true);
  assert.ok(v.reason && /no name/.test(v.reason));
});
