import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCompliance } from '../qa/complianceChecker';
import { reportToMarkdown } from '../qa/report';
import { DataModelDescriptor } from '../qa/complianceTypes';

// A model that follows every convention (mirrors the real `Conversation` shape).
const compliant: DataModelDescriptor = {
  kind: 'dataModel',
  name: 'WorkOrder',
  fields: [
    { name: 'id', type: 'ID!', description: 'Primary unique identifier.' },
    { name: 'code', type: 'String!', description: 'Auto-generated code.' },
    { name: 'name', type: 'String!', description: 'Display name.' },
    { name: 'active', type: 'Boolean!', description: 'Soft-state flag.' },
    { name: 'statusId', type: 'ID!', description: 'FK to status.' },
  ],
  relations: [
    { field: 'status', target: 'WorkOrderStatus', many: false },
    { field: 'operations', target: 'Operation', many: true },
  ],
};

test('runCompliance: a fully-compliant data model scores 100', () => {
  const r = runCompliance(compliant);
  assert.equal(r.score, 100);
  assert.equal(r.findings.length, 0);
  assert.equal(r.passed, r.checks);
});

test('runCompliance: missing id is an error and drops the score', () => {
  const d: DataModelDescriptor = { ...compliant, fields: compliant.fields.filter(f => f.name !== 'id') };
  const r = runCompliance(d);
  assert.ok(r.score < 100);
  assert.ok(r.findings.some(f => f.ruleId === 'id-primary-key' && f.severity === 'error'));
});

test('runCompliance: an unpaired foreign key is flagged', () => {
  const d: DataModelDescriptor = {
    kind: 'dataModel', name: 'Thing',
    fields: [{ name: 'id', type: 'ID!' }, { name: 'ownerId', type: 'ID' }, { name: 'active', type: 'Boolean!' }],
    relations: [], // ownerId has no `owner` relation
  };
  const r = runCompliance(d);
  const f = r.findings.find(x => x.ruleId === 'fk-relation-pairing');
  assert.ok(f, 'expected an fk-relation-pairing finding');
  assert.match(f!.message, /owner/);
});

test('runCompliance: a to-one relation without its FK is flagged', () => {
  const d: DataModelDescriptor = {
    kind: 'dataModel', name: 'Thing',
    fields: [{ name: 'id', type: 'ID!' }, { name: 'active', type: 'Boolean!' }],
    relations: [{ field: 'owner', target: 'User', many: false }], // no ownerId
  };
  const r = runCompliance(d);
  assert.ok(r.findings.some(x => x.ruleId === 'fk-relation-pairing' && /ownerId/.test(x.message)));
});

test('runCompliance: unknown scalar type is an error', () => {
  const d: DataModelDescriptor = {
    kind: 'dataModel', name: 'Thing',
    fields: [{ name: 'id', type: 'ID!' }, { name: 'amount', type: 'Money' }, { name: 'active', type: 'Boolean!' }],
    relations: [],
  };
  const r = runCompliance(d);
  assert.ok(r.findings.some(x => x.ruleId === 'known-scalar-types' && /Money/.test(x.message)));
});

test('runCompliance: non-camelCase field and non-Pascal model are warnings', () => {
  const d: DataModelDescriptor = {
    kind: 'dataModel', name: 'work_order',
    fields: [{ name: 'id', type: 'ID!' }, { name: 'Bad_Name', type: 'String' }, { name: 'active', type: 'Boolean!' }],
    relations: [],
  };
  const r = runCompliance(d);
  assert.ok(r.findings.some(x => x.ruleId === 'camelCase-fields'));
  assert.ok(r.findings.some(x => x.ruleId === 'pascalCase-model'));
});

test('runCompliance: non-dataModel kinds run their own real profile', () => {
  // A flow with no type/nodes is scored by the flow profile (not a placeholder).
  const r = runCompliance({ kind: 'flow', name: 'SyncOrders', raw: {} });
  assert.equal(r.kind, 'flow');
  assert.ok(r.findings.some(f => f.ruleId === 'flow-type' && f.severity === 'error'));
  assert.ok(r.score < 100);
});

test('reportToMarkdown: renders score badge and findings', () => {
  const md = reportToMarkdown(runCompliance(compliant));
  assert.match(md, /Compliance — WorkOrder/);
  assert.match(md, /100% — fully compliant/);
  assert.match(md, /\| Rule \| Checks \| Passed \|/);
});
