import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptFlowElement, adaptFlow, FLOW_ELEMENT_FIELDS } from '../qa/flowDescriptor';

test('FLOW_ELEMENT_FIELDS requests the stable system-model fields', () => {
  assert.deepEqual(FLOW_ELEMENT_FIELDS, ['id', 'name', 'type', 'description', 'configuration']);
});

test('adaptFlowElement maps real node types to kinds', () => {
  const cases: Array<[string, string]> = [
    ['request', 'entry'], ['schedule', 'entry'], ['fork', 'fork'], ['collect', 'collect'],
    ['ifElse', 'ifElse'], ['switch', 'switch'], ['javascriptTransform', 'inlineScript'],
    ['transform', 'jsonata'], ['savedTransformV2', 'savedTransform'], ['query', 'query'],
    ['http', 'http'], ['tryCatch', 'tryCatch'], ['validate', 'validate'], ['mysteryType', 'other'],
  ];
  for (const [type, kind] of cases) {
    assert.equal(adaptFlowElement({ id: type, type }, 0).kind, kind, `${type} → ${kind}`);
  }
});

test('adaptFlowElement extracts query, saved ref, fork/collect, http, script config', () => {
  const q = adaptFlowElement({ id: 'q', type: 'query', configuration: { api: 'application', variablesTransform: '$', query: 'query { workOrder(where:{id:{_eq:$id}}) { edges { node { id } } } }' } }, 0);
  assert.equal(q.queryApi, 'application');
  assert.ok(q.query?.includes('workOrder'));
  assert.equal(q.variablesTransform, '$');

  const saved = adaptFlowElement({ id: 's', type: 'savedTransformV2', configuration: { requestTransform: '$', transformId: { id: 'myScript', name: 'My Script', scriptLanguageId: 'JavaScript' } } }, 0);
  assert.equal(saved.requestTransform, '$');
  assert.equal(saved.savedRef?.id, 'myScript');
  assert.equal(saved.savedRef?.name, 'My Script');

  const fork = adaptFlowElement({ id: 'f', type: 'fork', configuration: { branches: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] } }, 0);
  assert.equal(fork.branchCount, 3);

  const collect = adaptFlowElement({ id: 'c', type: 'collect', configuration: { batchCount: 3 } }, 0);
  assert.equal(collect.collectBatchCount, 3);

  const http = adaptFlowElement({ id: 'h', type: 'http', configuration: { connectionName: 'ClaudeAPI Endpoint' } }, 0);
  assert.equal(http.connectionName, 'ClaudeAPI Endpoint');

  const js = adaptFlowElement({ id: 'j', type: 'javascriptTransform', configuration: { transform: 'return 1;' } }, 0);
  assert.equal(js.script, 'return 1;');
});

test('adaptFlow builds a graph with metadata + nodes', () => {
  const g = adaptFlow({ id: 'flowA', name: 'Flow A', type: 'System', versions: [{ number: '0.0.1', description: '', deployed: true }] },
    [{ id: 'n0', type: 'request', name: 'Start', configuration: { nextNodes: ['n1'] } }]);
  assert.equal(g.id, 'flowA');
  assert.equal(g.nodes.length, 1);
  assert.equal(g.nodes[0].kind, 'entry');
  assert.equal(g.nodes[0].entryType, 'request');
  assert.equal(g.versions?.length, 1);
});

test('adaptFlowElement tolerates string/missing configuration', () => {
  assert.doesNotThrow(() => adaptFlowElement({ id: 'x', type: 'query', configuration: 'oops' }, 0));
  assert.doesNotThrow(() => adaptFlowElement({ id: 'y', type: 'fork' }, 0));
});
