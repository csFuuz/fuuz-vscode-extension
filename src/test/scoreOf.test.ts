import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreOf } from '../qa/complianceTypes';
import { runScreenCompliance } from '../qa/screenAnalysis';
import { buildScreenModel } from '../qa/screenDescriptor';

test('scoreOf: nothing checked is inconclusive, and NOT a pass', () => {
  const none = scoreOf(0, 0);
  assert.equal(none.inconclusive, true);
  assert.notEqual(none.score, 100, 'zero checks used to score 100 — a false pass');
});

test('scoreOf: a real rule set scores normally and is not flagged', () => {
  assert.deepEqual(scoreOf(4, 3), { score: 75 });
  assert.deepEqual(scoreOf(2, 2), { score: 100 });
  assert.deepEqual(scoreOf(3, 0), { score: 0 });
});

test('an EMPTY screen still scores 100 — its rules pass trivially, so the score is vacuous', () => {
  // Found on a real tenant: two deployed screens with zero element rows reported a
  // clean 100%. The cause is NOT `checks === 0` — rules like "fewer than 75
  // elements" and "at most 5 action buttons" genuinely pass on nothing, so the
  // score is arithmetically right and still means nothing.
  //
  // That is why the emptiness has to be reported separately rather than inferred
  // from the score. Pinned here so the distinction is not lost: `inconclusive`
  // covers "no rule could assert anything", which is a different failure.
  const empty = runScreenCompliance(buildScreenModel('emptyScreen', []));
  assert.ok(empty.checks > 0, 'rules do assert against an empty screen');
  assert.equal(empty.score, 100);
  assert.equal(empty.inconclusive, undefined, 'not the checks===0 case');
});

test('a real screen still scores, and carries no inconclusive flag', () => {
  const rows = [
    { id: 's.ROOT', name: 'Screen', type: 'Screen', configuration: {} },
    {
      id: 's.t1', name: 'Table1', type: 'Table', description: 'readings',
      configuration: { query: { model: 'DemoMachineReading', dataPath: 'edges', parameters: '{"filter":{"id":{"_eq":"x"}}}' } },
    },
    { id: 's.c1', name: 'TableColumn1', type: 'TableColumn', label: 'Recorded At', description: 'when', configuration: { field: 'recordedAt', dataPath: 'recordedAt', format: 'datetime' } },
  ];
  const report = runScreenCompliance(buildScreenModel('demoLineHealthScreen', rows));
  assert.ok(report.checks > 0, 'a populated screen must actually be checked');
  assert.equal(report.inconclusive, undefined);
  assert.ok(report.score >= 0 && report.score <= 100);
});
