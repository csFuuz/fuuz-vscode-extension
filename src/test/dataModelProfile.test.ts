import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_MODEL_RULES } from '../qa/dataModelProfile';
import { DataModelDescriptor, FieldDescriptor, RelationDescriptor, RuleResult } from '../qa/complianceTypes';

/** Build a DataModelDescriptor literal, defaulting empty fields/relations. */
function model(p: Partial<DataModelDescriptor> & { name: string }): DataModelDescriptor {
  return { kind: 'dataModel', fields: [], relations: [], ...p };
}

const f = (name: string, type: string): FieldDescriptor => ({ name, type });
const rel = (field: string, target: string, many = false): RelationDescriptor => ({ field, target, many });

/** Run a single rule (by id) over a descriptor and return its RuleResult. */
function run(ruleId: string, d: DataModelDescriptor): RuleResult {
  for (const rule of DATA_MODEL_RULES) {
    const r = rule(d);
    if (r.ruleId === ruleId) return r;
  }
  throw new Error(`no rule with id ${ruleId}`);
}

test('setup-required-fields: missing color/code/active warn; complete setup passes', () => {
  const bad = run('setup-required-fields', model({ name: 'OrderStatus', modelType: 'setup' }));
  assert.equal(bad.checks, 3);
  assert.equal(bad.passed, 0);
  assert.ok(bad.findings.some(x => x.severity === 'warn' && /color/.test(x.message)));
  assert.ok(bad.findings.some(x => x.severity === 'warn' && /code/.test(x.message)));
  assert.ok(bad.findings.some(x => x.severity === 'warn' && /active/.test(x.message)));

  const good = run('setup-required-fields', model({
    name: 'OrderStatus', modelType: 'setup',
    fields: [f('color', 'String'), f('active', 'Boolean!'), f('code', 'String!')],
  }));
  assert.equal(good.checks, 3);
  assert.equal(good.passed, 3);
  // No warnings when complete, but an info about id==code immutability.
  assert.ok(!good.findings.some(x => x.severity === 'warn'));
  assert.ok(good.findings.some(x => x.severity === 'info' && /immutable/.test(x.message)));
});

test('model-name-implies-setup: setup-named transactional warns; setup model does not', () => {
  const warned = run('model-name-implies-setup', model({ name: 'OrderStatus', modelType: 'transactional' }));
  assert.equal(warned.checks, 1);
  assert.equal(warned.passed, 0);
  assert.ok(warned.findings.some(x => x.severity === 'warn'));

  const setup = run('model-name-implies-setup', model({ name: 'OrderStatus', modelType: 'setup' }));
  assert.equal(setup.checks, 0);
  assert.equal(setup.findings.length, 0);

  const ok = run('model-name-implies-setup', model({ name: 'WorkOrder', modelType: 'transactional' }));
  assert.equal(ok.checks, 1);
  assert.equal(ok.passed, 1);
});

test('setup-references: relation to a setup type satisfies; none gets info', () => {
  const ok = run('setup-references', model({
    name: 'WorkOrder', modelType: 'transactional',
    relations: [rel('orderStatus', 'OrderStatus')],
  }));
  assert.equal(ok.checks, 1);
  assert.equal(ok.passed, 1);

  const none = run('setup-references', model({ name: 'WorkOrder', modelType: 'transactional' }));
  assert.equal(none.checks, 1);
  assert.equal(none.passed, 0);
  assert.ok(none.findings.some(x => x.severity === 'info'));
});

test('status-or-active: neither gets info; isActive Boolean passes', () => {
  const none = run('status-or-active', model({ name: 'WorkOrder', modelType: 'transactional' }));
  assert.equal(none.checks, 1);
  assert.equal(none.passed, 0);
  assert.ok(none.findings.some(x => x.severity === 'info'));

  const active = run('status-or-active', model({
    name: 'WorkOrder', modelType: 'transactional', fields: [f('isActive', 'Boolean')],
  }));
  assert.equal(active.checks, 1);
  assert.equal(active.passed, 1);

  const status = run('status-or-active', model({
    name: 'WorkOrder', modelType: 'master', relations: [rel('orderStatus', 'OrderStatus')],
  }));
  assert.equal(status.passed, 1);
});

test('uom-on-measures: bare number flagged; Measure or unit sibling passes; Duration not flagged', () => {
  const bare = run('uom-on-measures', model({
    name: 'WorkOrder', modelType: 'transactional', fields: [f('quantity', 'Float')],
  }));
  assert.equal(bare.checks, 1);
  assert.equal(bare.passed, 0);
  assert.ok(bare.findings.some(x => x.severity === 'info' && /quantity/.test(x.message)));

  const measure = run('uom-on-measures', model({
    name: 'WorkOrder', modelType: 'transactional', fields: [f('quantity', 'Measure')],
  }));
  // A `Measure` field never matches the bare-number filter, so no checks run.
  assert.equal(measure.checks, 0);
  assert.equal(measure.findings.length, 0);

  const sibling = run('uom-on-measures', model({
    name: 'WorkOrder', modelType: 'transactional',
    fields: [f('quantity', 'Float'), f('quantityUnitId', 'ID')],
  }));
  assert.equal(sibling.checks, 1);
  assert.equal(sibling.passed, 1);

  const duration = run('uom-on-measures', model({
    name: 'WorkOrder', modelType: 'transactional', fields: [f('expectedDuration', 'Duration')],
  }));
  assert.equal(duration.checks, 0);
  assert.equal(duration.findings.length, 0);
});

test('type-unknown model: all 5 rules return 0 checks (do not affect score)', () => {
  // No measurement fields, so uom-on-measures (which is not type-gated) is also 0/0.
  const d = model({
    name: 'OrderStatus',
    fields: [f('color', 'String')],
    relations: [rel('orderStatus', 'OrderStatus')],
  });
  for (const id of ['setup-required-fields', 'model-name-implies-setup', 'setup-references', 'status-or-active', 'uom-on-measures']) {
    const r = run(id, d);
    assert.equal(r.checks, 0, `${id} should run no checks`);
    assert.equal(r.findings.length, 0, `${id} should emit no findings`);
  }
});
