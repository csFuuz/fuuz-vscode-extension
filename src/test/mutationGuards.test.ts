import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFlowPayload, checkDataModelPayload, isCallableToolGoal, resolveModuleId, coerceContainerJson, normalizeSavedTransform, normalizeMcpCallArgs, unwrapFlowContainer } from '../qa/mutationGuards';

test('lintJsonataTransforms: flags JS-style operators in transform fields, ignores non-transform strings', () => {
  const { lintJsonataTransforms } = require('../qa/mutationGuards');
  assert.match(lintJsonataTransforms({ version: { flow: { nodes: [{ data: { transform: '$.qty => 10' } }] } } }), />=/);
  assert.match(lintJsonataTransforms({ responseTransform: '$.a && $.b' }), /and/);
  assert.match(lintJsonataTransforms({ data: { transform: '$.x == 5' } }), /single equals/);
  // valid JSONata passes; != is fine
  assert.equal(lintJsonataTransforms({ data: { transform: '$.qty >= 10 and $.ok != false' } }), null);
  // description text with "=>" is not a transform field → ignored
  assert.equal(lintJsonataTransforms({ description: 'maps a => b' }), null);
});

test('unwrapFlowContainer: lifts the real container out of a "content" wrapper', () => {
  const r = unwrapFlowContainer({ content: { where: { id: 'oeeFlow' }, header: { name: 'OEE' } } });
  assert.equal((r.payload as any).where.id, 'oeeFlow');
  assert.equal((r.payload as any).header.name, 'OEE');
  assert.equal((r.payload as any).content, undefined);
  assert.match(r.note || '', /unwrapped/);
});

test('unwrapFlowContainer: drops invented version_id/module_id siblings of a wrapper', () => {
  const r = unwrapFlowContainer({ version_id: 'x', module_id: 'Production', content: { header: { name: 'F' }, version: { number: '0.0.1' } } });
  assert.equal((r.payload as any).header.name, 'F');
  assert.equal((r.payload as any).version_id, undefined);
  assert.equal((r.payload as any).module_id, undefined);
});

test('unwrapFlowContainer: no-op when the container is already top-level', () => {
  const already = { header: { name: 'F' }, version: { number: '0.0.1' } };
  const r = unwrapFlowContainer(already);
  assert.equal(r.note, undefined);
  assert.equal((r.payload as any).header.name, 'F');
});

const MODULES = [{ id: 'productionManagement', name: 'Production Management' }, { id: 'batchExecution', name: 'Batch Execution' }];

const flow = (headerType: string, flowType?: string) => ({
  header: { name: 'X', dataFlowTypeId: headerType },
  version: { flow: { type: flowType ?? headerType, nodes: [{ id: 'n1', name: 'Start', type: 'request' }] } },
});

test('checkFlowPayload: valid type passes', () => {
  assert.equal(checkFlowPayload(flow('System')), null);
  assert.equal(checkFlowPayload(flow('Integration')), null);
});

test('checkFlowPayload: empty nodes is blocked (the "no nodes appear" defect)', () => {
  const empty = { header: { dataFlowTypeId: 'System' }, version: { flow: { type: 'System', nodes: [] } } };
  assert.match(String(checkFlowPayload(empty)), /empty "nodes" array/);
  const noNodes = { header: { dataFlowTypeId: 'System' }, version: { flow: { type: 'System' } } };
  assert.match(String(checkFlowPayload(noNodes)), /empty "nodes" array/);
});

test('checkFlowPayload: header-only is allowed ONLY for an id-targeted update, not a create', () => {
  // id-targeted metadata update (rename / toggle) — no flow body is fine.
  assert.equal(checkFlowPayload({ where: { id: 'existingFlow' }, header: { dataFlowTypeId: 'Integration', name: 'X' } }), null);
  // header-only CREATE (no where.id) — would save an empty flow → blocked.
  assert.match(String(checkFlowPayload({ header: { dataFlowTypeId: 'Integration', name: 'X' } })), /creating a data flow requires its BODY/);
});

test('checkFlowPayload: invalid type is blocked', () => {
  const err = checkFlowPayload(flow('Backend'));
  assert.match(String(err), /invalid dataFlowTypeId "Backend"/);
  assert.match(String(err), /System \| Document \| Integration \| Screen \| Edge/);
});

test('checkFlowPayload: header/flow type mismatch is blocked', () => {
  const err = checkFlowPayload(flow('System', 'Integration'));
  assert.match(String(err), /must EQUAL/);
});

test('checkFlowPayload: callable-tool flow saved as System is blocked (needs Integration)', () => {
  const err = checkFlowPayload(flow('System'), { callableTool: true });
  assert.match(String(err), /must be callable as an MCP tool\/API/);
  assert.match(String(err), /Integration/);
});

test('checkFlowPayload: callable-tool flow as Integration passes', () => {
  assert.equal(checkFlowPayload(flow('Integration'), { callableTool: true }), null);
});

test('checkDataModelPayload: valid type + kind pass', () => {
  assert.equal(checkDataModelPayload({ header: { dataModelTypeId: 'setup', dataModelKindId: 'reference' } }), null);
  assert.equal(checkDataModelPayload({ dataModelTypeId: 'transactional' }), null);
});

test('checkDataModelPayload: invalid type is blocked', () => {
  const err = checkDataModelPayload({ dataModelTypeId: 'lookup' });
  assert.match(String(err), /invalid dataModelTypeId "lookup"/);
  assert.match(String(err), /setup \| master \| transactional/);
});

test('checkDataModelPayload: invalid kind is blocked', () => {
  const err = checkDataModelPayload({ modelDefinition: { dataModelKindId: 'Table' } });
  assert.match(String(err), /invalid dataModelKindId "Table"/);
});

test('resolveModuleId: maps a guessed display name to the real id', () => {
  const p: any = { header: { moduleId: 'Production Management' }, version: { flow: { type: 'System', nodes: [{ id: 'n1' }] } } };
  const { payload, note } = resolveModuleId(p, MODULES);
  assert.equal((payload as any).header.moduleId, 'productionManagement');
  assert.match(String(note), /resolved moduleId/);
});

test('resolveModuleId: leaves a valid id untouched', () => {
  const p: any = { header: { moduleId: 'batchExecution' } };
  const { note } = resolveModuleId(p, MODULES);
  assert.equal(note, undefined);
});

test('checkFlowPayload: invalid moduleId is blocked with the real list', () => {
  const p = { header: { dataFlowTypeId: 'Integration', moduleId: 'Nope' }, version: { flow: { type: 'Integration', nodes: [{ id: 'n1', name: 'S', type: 'request' }] } } };
  const err = checkFlowPayload(p, { moduleIds: MODULES.map(m => m.id) });
  assert.match(String(err), /invalid moduleId "Nope"/);
  assert.match(String(err), /productionManagement/);
});

test('checkFlowPayload: valid moduleId passes', () => {
  const p = { header: { dataFlowTypeId: 'Integration', moduleId: 'productionManagement' }, version: { flow: { type: 'Integration', nodes: [{ id: 'n1', name: 'S', type: 'request' }] } } };
  assert.equal(checkFlowPayload(p, { moduleIds: MODULES.map(m => m.id) }), null);
});

test('coerceContainerJson: parses a stringified version container (the real wall)', () => {
  const payload: any = {
    header: { dataFlowTypeId: 'Integration' },
    version: JSON.stringify({ id: 'v1', number: '0.0.1', flow: { id: 'v1', type: 'Integration', nodes: [{ id: 'n1', name: 'S', type: 'request' }] } }),
  };
  const { payload: out, note } = coerceContainerJson(payload);
  assert.equal(typeof (out as any).version, 'object');
  assert.equal(typeof (out as any).version.flow, 'object');
  assert.equal((out as any).version.flow.nodes.length, 1);
  assert.match(String(note), /parsed stringified JSON/);
});

test('coerceContainerJson: leaves code strings (transform/query) untouched', () => {
  const payload: any = { version: { flow: { type: 'System', nodes: [{ id: 'n1', name: 'T', type: 'transform', data: { transform: '{ "a": $.b }' } }] } } };
  const { note } = coerceContainerJson(payload);
  assert.equal(note, undefined, 'no structural string to parse; transform code left alone');
  assert.equal(typeof payload.version.flow.nodes[0].data.transform, 'string');
});

test('coerceContainerJson: then the flow guard sees the nodes (end-to-end)', () => {
  const payload: any = { header: { dataFlowTypeId: 'Integration', moduleId: 'productionManagement' }, version: JSON.stringify({ flow: { type: 'Integration', nodes: [{ id: 'n1', name: 'S', type: 'request' }] } }) };
  const { payload: out } = coerceContainerJson(payload);
  assert.equal(checkFlowPayload(out, { callableTool: true, moduleIds: ['productionManagement'] }), null);
});

test('normalizeSavedTransform: derives where.name from data.name when key missing', () => {
  const payload: any = { operation: 'create', data: { name: 'OEE Calc', transform: '$' } };
  const { payload: out, note } = normalizeSavedTransform(payload);
  assert.equal((out as any).where.name, 'OEE Calc');
  assert.match(String(note), /where\.name/);
});

test('normalizeSavedTransform: leaves a payload that already has header.name', () => {
  const { note } = normalizeSavedTransform({ header: { name: 'X' }, version: {} } as any);
  assert.equal(note, undefined);
});

test('normalizeMcpCallArgs: fixes the raw read-tool arg mistakes from the trace', () => {
  // service missing + model instead of modelName + where as object
  const a = normalizeMcpCallArgs('system_query_model', { model: 'DataFlow', where: { name: { _eq: 'X' } } } as any);
  assert.equal((a.args as any).service, 'application');
  assert.equal((a.args as any).modelName, 'DataFlow');
  assert.equal(typeof (a.args as any).where, 'string');
  assert.equal((a.args as any).model, undefined);
  assert.match(String(a.note), /normalized MCP args/);
});

test('normalizeMcpCallArgs: maps name→dataFlowId for details/diagram tools', () => {
  const a = normalizeMcpCallArgs('data_flow_data_flow_details', { name: 'oeeComputationTool' } as any);
  assert.equal((a.args as any).dataFlowId, 'oeeComputationTool');
});

test('normalizeMcpCallArgs: leaves already-correct args alone', () => {
  const a = normalizeMcpCallArgs('system_list_models', { service: 'system' } as any);
  assert.equal(a.note, undefined);
});

test('isCallableToolGoal: detects tool/API intent', () => {
  assert.equal(isCallableToolGoal('build an oee data flow that we can run as mcp tool'), true);
  assert.equal(isCallableToolGoal('expose OEE as an API endpoint'), true);
  assert.equal(isCallableToolGoal('a tool my plant manager can call'), true);
  assert.equal(isCallableToolGoal('clean up my downloads folder'), false);
});
