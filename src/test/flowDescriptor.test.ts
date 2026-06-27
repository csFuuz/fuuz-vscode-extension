import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptFlowElements, chooseFlowFields, flowFkField, normalizeNodeType } from '../qa/flowDescriptor';

test('normalizeNodeType: maps common labels', () => {
  assert.equal(normalizeNodeType('Broadcast'), 'broadcast');
  assert.equal(normalizeNodeType('Branch / Switch'), 'branch');
  assert.equal(normalizeNodeType('Collect'), 'collect');
  assert.equal(normalizeNodeType('Delay'), 'delay');
  assert.equal(normalizeNodeType('Integration Request'), 'integration');
  assert.equal(normalizeNodeType('Error Response'), 'errorResponse');
  assert.equal(normalizeNodeType('Script'), 'script');
  assert.equal(normalizeNodeType('Query Data'), 'query');
  assert.equal(normalizeNodeType('something else'), 'other');
});

test('chooseFlowFields: always includes id + only existing candidates', () => {
  const fields = chooseFlowFields(['id', 'name', 'script', 'dataFlowElementTypeId', 'dataFlowId', 'unrelated']);
  assert.ok(fields.includes('id'));
  assert.ok(fields.includes('name'));
  assert.ok(fields.includes('script'));
  assert.ok(fields.includes('dataFlowElementTypeId'));
  assert.ok(!fields.includes('label')); // not available
});

test('flowFkField: picks the flow foreign key', () => {
  assert.equal(flowFkField(['id', 'dataFlowId']), 'dataFlowId');
  assert.equal(flowFkField(['id', 'dataFlowVersionId']), 'dataFlowVersionId');
  assert.equal(flowFkField(['id', 'name']), undefined);
});

test('adaptFlowElements: builds nodes, resolves typeId via labels', () => {
  const available = ['id', 'name', 'description', 'dataFlowElementTypeId', 'script', 'branchCount'];
  const rows: Record<string, string>[] = [
    { id: 'a', name: 'Fan out', dataFlowElementTypeId: 't1' },
    { id: 'b', name: 'Run', dataFlowElementTypeId: 't2', script: 'return 1' },
  ];
  const labels = new Map([['t1', 'Broadcast'], ['t2', 'Script']]);
  const g = adaptFlowElements('MyFlow', 'Edge', rows, available, labels);
  assert.equal(g.name, 'MyFlow');
  assert.equal(g.nodes[0].type, 'broadcast');
  assert.equal(g.nodes[1].type, 'script');
  assert.equal(g.nodes[1].script, 'return 1');
});

test('adaptFlowElements: falls back gracefully with sparse fields', () => {
  const g = adaptFlowElements('F', undefined, [{ id: 'x' }], ['id']);
  assert.equal(g.nodes[0].type, 'other');
  assert.equal(g.nodes[0].name, undefined);
});
