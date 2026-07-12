import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecordCount, parseModelMeta, buildModelIndex, pascalize, lookupModel } from '../qa/modelContext';

test('parseRecordCount handles k/m/b suffixes, plain numbers, and junk', () => {
  assert.equal(parseRecordCount('37m'), 37_000_000);
  assert.equal(parseRecordCount('59k'), 59_000);
  assert.equal(parseRecordCount('1.2m'), 1_200_000);
  assert.equal(parseRecordCount('384'), 384);
  assert.equal(parseRecordCount('2k'), 2_000);
  assert.equal(parseRecordCount(99), 99);
  assert.equal(parseRecordCount(''), undefined);
  assert.equal(parseRecordCount('n/a'), undefined);
  assert.equal(parseRecordCount(null), undefined);
});

test('parseModelMeta pulls DCC + triggers from a model definition', () => {
  const def = { name: 'WorkOrderStatus', metadata: { mfgx: { dataChangeCapture: { exposed: false, retentionDays: 120 }, triggers: { create: '$merge([$, { "id": $after.name }])' } } } };
  const meta = parseModelMeta(def);
  assert.equal(meta.dcc?.exposed, false);
  assert.equal(meta.dcc?.retentionDays, 120);
  assert.ok(meta.triggers?.create?.includes('$merge'));
});

test('parseModelMeta is null-safe on missing metadata', () => {
  assert.deepEqual(parseModelMeta(undefined), { dcc: undefined, triggers: undefined });
  assert.deepEqual(parseModelMeta({ metadata: {} }), { dcc: undefined, triggers: undefined });
});

test('buildModelIndex parses record counts + deployment id', () => {
  const idx = buildModelIndex([
    { name: 'OperationalSignal', dataModelTypeId: 'transactional', estimatedRecordCount: '37m', currentDataModelDeploymentId: 'dep1' },
    { name: 'WorkOrder', dataModelTypeId: 'transactional', estimatedRecordCount: '67' },
  ]);
  assert.equal(idx.get('OperationalSignal')?.recordCount, 37_000_000);
  assert.equal(idx.get('OperationalSignal')?.deploymentId, 'dep1');
  assert.equal(idx.get('WorkOrder')?.type, 'transactional');
});

test('pascalize upper-cases the first character and is empty-safe', () => {
  assert.equal(pascalize('productionRun'), 'ProductionRun');
  assert.equal(pascalize('WorkOrder'), 'WorkOrder');
  assert.equal(pascalize(''), '');
});

test('lookupModel resolves a camelCase query root via PascalCase, then raw', () => {
  const models = buildModelIndex([
    { name: 'ProductionRun', dataModelTypeId: 'transactional' },
    { name: 'workCenter', dataModelTypeId: 'master' }, // already-lowercased name stored verbatim
  ]);
  const ctx = { models };
  assert.equal(lookupModel(ctx, 'productionRun')?.name, 'ProductionRun'); // camel → Pascal hit
  assert.equal(lookupModel(ctx, 'workCenter')?.name, 'workCenter'); // raw-token fallback
  assert.equal(lookupModel(ctx, 'missing'), undefined);
  assert.equal(lookupModel(undefined, 'anything'), undefined);
});
