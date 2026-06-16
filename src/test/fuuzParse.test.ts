import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTool,
  parseTronRecords,
  extractModelNames,
  assembleApplication,
  decodeJwt,
  environmentFromClaims,
  namesFrom,
  deriveEndpoints,
  toMermaid,
  parseReferences,
  buildModelErd,
  buildSetErd,
} from '../util/fuuzParse';

test('classifyTool: only system_ is system; everything else is a data flow', () => {
  assert.equal(classifyTool('system_query_model').kind, 'system');
  assert.equal(classifyTool('system_list_models').kind, 'system');
  assert.equal(classifyTool('data_flow_dynamic_query').kind, 'dataflow');
  assert.equal(classifyTool('publishToLocalUns').kind, 'dataflow');
  assert.equal(classifyTool('myCustomFlow').kind, 'dataflow');
});

test('parseTronRecords: flat class with quoted values incl parens/commas', () => {
  const tron = [
    'Retrieved 2 record(s). Results in TRON format:',
    '',
    'class A: id,name,moduleId',
    '',
    '[A("addOperator","Add Operator","controlPanels"),A("badge","Badge In/Out (Operator), v2","employees")]',
  ].join('\n');
  const recs = parseTronRecords(tron);
  assert.equal(recs.length, 2);
  assert.deepEqual(recs[0], { id: 'addOperator', name: 'Add Operator', moduleId: 'controlPanels' });
  // value with comma + parens inside quotes is preserved
  assert.equal(recs[1].name, 'Badge In/Out (Operator), v2');
  assert.equal(recs[1].moduleId, 'employees');
});

test('parseTronRecords: no class def returns empty', () => {
  assert.deepEqual(parseTronRecords('no tron here'), []);
});

test('extractModelNames: pulls unique sorted tuple names', () => {
  const tron = '{"Reference":{"system":{"accessControl":[A("Beta",false,"d"),A("Alpha",false,"d"),A("Beta",false,"d")]}}}';
  assert.deepEqual(extractModelNames(tron), ['Alpha', 'Beta']);
});

test('assembleApplication: nests modules/screens/flows/datamodels by relation ids', () => {
  const app = assembleApplication(
    [{ id: 'g1', name: 'Group One' }],
    [{ id: 'm1', name: 'Module One', moduleGroupId: 'g1' }, { id: 'm2', name: 'Orphan', moduleGroupId: 'gX' }],
    [{ id: 's1', name: 'Screen One', moduleId: 'm1' }],
    [{ id: 'f1', name: 'Flow One', moduleId: 'm1' }],
    [{ id: 'd1', name: 'Model One', moduleId: 'm1', dataModelTypeId: 'master' }],
  );
  assert.equal(app.length, 1);
  assert.equal(app[0].modules.length, 1); // orphan module (gX) excluded
  const m = app[0].modules[0];
  assert.equal(m.screens[0].name, 'Screen One');
  assert.equal(m.flows[0].name, 'Flow One');
  assert.equal(m.dataModels[0].name, 'Model One');
  assert.equal(m.dataModels[0].description, 'master');
});

test('assembleApplication: excludes the platform "system" module group', () => {
  const app = assembleApplication(
    [{ id: 'system', name: 'System' }, { id: 'g1', name: 'Group One' }],
    [{ id: 'accessControl', name: 'Access Control', moduleGroupId: 'system' }, { id: 'm1', name: 'Module One', moduleGroupId: 'g1' }],
    [], [], [],
  );
  assert.equal(app.length, 1);
  assert.equal(app[0].id, 'g1');
});

test('decodeJwt + environmentFromClaims: real-shaped Fuuz token', () => {
  const claims = { tenantId: 't1', enterpriseId: 'mfgx', aud: 'build.mfgx.fuuz.app', iss: 'build.mfgx.fuuz.app' };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const token = `aaa.${payload}.bbb`;
  const decoded = decodeJwt(token);
  assert.equal(decoded?.tenantId, 't1');
  assert.equal(environmentFromClaims(decoded!), 'build.mfgx');
  assert.equal(environmentFromClaims({ aud: 'admin.fuuz.app' }), 'admin');
  assert.equal(environmentFromClaims({}), undefined);
});

test('decodeJwt: junk returns null', () => {
  assert.equal(decodeJwt('not-a-jwt'), null);
  assert.equal(decodeJwt(''), null);
});

test('namesFrom: parses "Fuuz MCP Server: <Ent> / <Tenant>"', () => {
  const r = namesFrom('Fuuz MCP Server: MFGx / mesIsa88Development', 'mfgx', 'mesIsa88Development');
  assert.equal(r.enterpriseName, 'MFGx');
  assert.equal(r.tenantName, 'mesIsa88Development');
  // fallback to ids when no server name
  const f = namesFrom(undefined, 'eid', 'tid');
  assert.equal(f.enterpriseName, 'eid');
  assert.equal(f.tenantName, 'tid');
});

test('parseReferences: maps edges + cardinality, drops audit/metadata noise', () => {
  const tron = [
    'class A: fromModelName,fromModelFieldName,fromModelRelationType,toModelName,toModelFieldName',
    '',
    '[A("Area","workcenters","[Workcenter!]!","Workcenter","areaId"),' +
      'A("Area","createdByUserId","User!","User","id"),' +
      'A("Workcenter","_metadata.installedPackageId","InstalledPackage","InstalledPackage","id"),' +
      'A("Workcenter","areaId","Area!","Area","id")]',
  ].join('\n');
  const edges = parseReferences(tron);
  assert.equal(edges.length, 2); // createdByUserId + _metadata dropped
  const wc = edges.find(e => e.from === 'Area' && e.to === 'Workcenter');
  assert.ok(wc && wc.many === true && wc.label === 'workcenters');
  const back = edges.find(e => e.from === 'Workcenter' && e.to === 'Area');
  assert.ok(back && back.many === false);
});

test('buildModelErd: includes inbound references as edges', () => {
  const graph = { name: 'Area', fields: [{ name: 'code', type: 'String!' }], relations: [{ field: 'workcenters', target: 'Workcenter', many: true }] };
  const refs = [{ from: 'WorkOrder', to: 'Area', label: 'areaId', many: false }];
  const mer = buildModelErd(graph, refs);
  assert.match(mer, /Area \|\|--o\{ Workcenter : workcenters/); // outbound
  assert.match(mer, /WorkOrder \}o--\|\| Area : areaId/);        // inbound
});

test('buildSetErd: only edges internal to the set', () => {
  const refs = [
    { from: 'A', to: 'B', label: 'b', many: true },
    { from: 'A', to: 'External', label: 'x', many: false },
  ];
  const mer = buildSetErd(['A', 'B'], refs);
  assert.match(mer, /A \|\|--o\{ B : b/);
  assert.doesNotMatch(mer, /External/);
});

test('deriveEndpoints: from environment slug', () => {
  const ep = deriveEndpoints({ environment: 'build.mfgx' });
  assert.equal(ep.apiBase, 'https://api.build.mfgx.fuuz.app');
  assert.equal(ep.mcp, 'https://api.build.mfgx.fuuz.app/mcp');
  assert.equal(ep.flowExecution, 'https://api.build.mfgx.fuuz.app/orchestration/executeFlow');
  assert.equal(ep.webhook, 'https://api.build.mfgx.fuuz.app/webhook/post/');
});

test('deriveEndpoints: overrides win; mcpEndpoint fallback when no env', () => {
  const ep = deriveEndpoints({ mcpEndpoint: 'https://api.x.fuuz.app/', mcpServerUrl: 'https://mcp.custom/sse' });
  assert.equal(ep.apiBase, 'https://api.x.fuuz.app');
  assert.equal(ep.mcp, 'https://mcp.custom/sse');
});

test('toMermaid: erDiagram with cardinality + sanitized ids', () => {
  const mer = toMermaid({
    name: 'Area',
    fields: [{ name: 'code', type: 'String!' }],
    relations: [
      { field: 'workcenters', target: 'Workcenter', many: true },
      { field: 'site', target: 'Site', many: false },
    ],
  });
  assert.match(mer, /^erDiagram/);
  assert.match(mer, /Area \|\|--o\{ Workcenter : workcenters/);
  assert.match(mer, /Area \}o--\|\| Site : site/);
  assert.match(mer, /String code/); // ! stripped
});
