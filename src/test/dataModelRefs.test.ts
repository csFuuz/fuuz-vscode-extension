import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relationFkFieldNames, findRelationFkTypeViolations, fixRelationFkTypes, fixRelationFksInPayload } from '../qa/dataModelRefs';

/** A model with a String FK (wrong) and a correctly-typed ID FK. */
const model = {
  name: 'FormulaHeader',
  fields: [
    { name: 'id', type: 'ID!' },
    { name: 'siteId', type: 'String' }, // wrong — should be ID
    { name: 'site', type: 'Site', metadata: { mfgx: { relation: { fields: { from: 'siteId', to: 'id' } } } } },
    { name: 'areaId', type: 'ID!' }, // correct
    { name: 'area', type: 'Area!', metadata: { mfgx: { relation: { fields: { from: 'areaId', to: 'id' } } } } },
    { name: 'formulaName', type: 'String!' }, // not an FK — leave alone
  ],
};

test('relationFkFieldNames collects every relation fields.from', () => {
  assert.deepEqual([...relationFkFieldNames(model)].sort(), ['areaId', 'siteId']);
});

test('findRelationFkTypeViolations flags only String FKs backing a relation', () => {
  const v = findRelationFkTypeViolations(model);
  assert.equal(v.length, 1);
  assert.deepEqual(v[0], { field: 'siteId', type: 'String', expected: 'ID' });
});

test('fixRelationFkTypes retypes FKs to ID (preserving nullability), leaves others', () => {
  const { model: fixed, fixed: names } = fixRelationFkTypes(model);
  assert.deepEqual(names, ['siteId']);
  const byName = Object.fromEntries(fixed.fields!.map((f: any) => [f.name, f.type]));
  assert.equal(byName.siteId, 'ID');
  assert.equal(byName.areaId, 'ID!');       // untouched
  assert.equal(byName.formulaName, 'String!'); // untouched
  // Idempotent: a second pass changes nothing.
  assert.deepEqual(fixRelationFkTypes(fixed).fixed, []);
});

test('required String! FK becomes ID! (keeps non-null)', () => {
  const m = {
    fields: [
      { name: 'ownerId', type: 'String!' },
      { name: 'owner', type: 'User!', metadata: { mfgx: { relation: { fields: { from: 'ownerId', to: 'id' } } } } },
    ],
  };
  assert.equal(findRelationFkTypeViolations(m)[0].expected, 'ID!');
  assert.equal(fixRelationFkTypes(m).model.fields![0].type, 'ID!');
});

test('fixRelationFksInPayload walks a nested mutation envelope', () => {
  const payload = { modelDefinition: model, other: [1, 2] };
  const { payload: out, fixed } = fixRelationFksInPayload(payload) as any;
  assert.deepEqual(fixed, ['siteId']);
  assert.equal(out.modelDefinition.fields.find((f: any) => f.name === 'siteId').type, 'ID');
  assert.deepEqual(out.other, [1, 2]); // untouched
});
