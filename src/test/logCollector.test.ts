import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectFuuzLogs, shapeIntegrationLogs, shapeSpanLogs, LogQueryFn } from '../qa/logCollector';

test('shapeIntegrationLogs: error field drives error severity', () => {
  const logs = shapeIntegrationLogs([
    { id: '1', error: 'Timeout contacting ERP', connectionName: 'ERP', requestName: 'postOrder', responseTime: '5000', requestTimestamp: 't1' },
    { id: '2', error: '', connectionName: 'ERP', responseTime: '120', requestTimestamp: 't2' },
  ]);
  assert.equal(logs[0].severity, 'error');
  assert.match(logs[0].message, /Timeout/);
  assert.equal(logs[1].severity, 'info');
});

test('shapeSpanLogs: builds a readable message + location', () => {
  const logs = shapeSpanLogs([{ id: '1', eventType: 'Mutation', topic: 'workOrder.update', url: '/work-orders/42', createdAt: 't' }]);
  assert.match(logs[0].message, /Mutation · workOrder.update/);
  assert.equal(logs[0].where, '/work-orders/42');
});

test('collectFuuzLogs: queries runtime sources with a window filter and sorts errors first', async () => {
  const seen: string[] = [];
  const query: LogQueryFn = async (model, _fields, where) => {
    seen.push(model);
    assert.match(where, /_gte/);
    if (model === 'IntegrationRequestLog') return [{ id: '1', error: 'boom', connectionName: 'X', requestTimestamp: 't' }];
    return [{ id: '3', eventType: 'Query', topic: 'x', createdAt: 't' }];
  };
  const logs = await collectFuuzLogs(query, { startIso: 'a', endIso: 'b' });
  assert.deepEqual(seen.sort(), ['ApplicationSpanEventLog', 'IntegrationRequestLog']);
  assert.ok(!seen.includes('DataFlowDeploymentLog'), 'deploy logs excluded');
  assert.equal(logs[0].severity, 'error'); // sorted: integration error first
});

test('collectFuuzLogs: a failing source is skipped, not fatal', async () => {
  const skipped: string[] = [];
  const query: LogQueryFn = async model => {
    if (model === 'ApplicationSpanEventLog') throw new Error('createdAt not filterable');
    return [];
  };
  const logs = await collectFuuzLogs(query, { startIso: 'a', endIso: 'b' }, m => skipped.push(m));
  assert.deepEqual(skipped, ['ApplicationSpanEventLog']);
  assert.deepEqual(logs, []);
});
