import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTool,
  parseTronRecords,
  parseModelFieldRecords,
  baseType,
  isRelationType,
  extractModelNames,
  assembleApplication,
  decodeJwt,
  environmentFromClaims,
  namesFrom,
  deriveEndpoints,
  parseReferences,
  relationshipEdges,
  buildModelGraph,
  buildSetGraph,
  isWebflowType,
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

test('parseTronRecords: capital-letter-paren inside a value does not spawn phantom records', () => {
  // "Step B(2)" contains `B(` — the declared class letter is A, but a naive
  // `/[A-Z]\(/g` scan would treat `B(` inside the quoted value as a tuple start.
  const tron = [
    'class A: id,name',
    '[A("wiring","Step B(2) wiring")]',
  ].join('\n');
  const recs = parseTronRecords(tron);
  assert.equal(recs.length, 1);
  assert.deepEqual(recs[0], { id: 'wiring', name: 'Step B(2) wiring' });
});

test('parseTronRecords: even the declared class letter inside a value is ignored', () => {
  // Value contains `A(` — same letter as the class. Must not become a record.
  const tron = [
    'class A: id,name',
    '[A("x","see A(ppendix) for detail"),A("y","plain")]',
  ].join('\n');
  const recs = parseTronRecords(tron);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].name, 'see A(ppendix) for detail');
  assert.equal(recs[1].id, 'y');
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

test('isWebflowType: matches web flow label variants only', () => {
  assert.equal(isWebflowType('Webflow'), true);
  assert.equal(isWebflowType('Web Flow'), true);
  assert.equal(isWebflowType('Web'), true);
  assert.equal(isWebflowType('Edge'), false);
  assert.equal(isWebflowType('Backend'), false);
  assert.equal(isWebflowType(undefined), false);
});

test('relationshipEdges: collapses FK + object twin and merges reverse collection into one edge', () => {
  const raw = [
    { from: 'Workcenter', to: 'Area', label: 'areaId', many: false }, // scalar FK
    { from: 'Workcenter', to: 'Area', label: 'area', many: false },   // object twin
    { from: 'Area', to: 'Workcenter', label: 'workcenters', many: true }, // reverse collection
  ];
  const edges = relationshipEdges(raw);
  assert.equal(edges.length, 1); // ONE relationship, not three links
  const e = edges[0];
  assert.equal(e.from, 'Workcenter'); // oriented from the FK owner
  assert.equal(e.to, 'Area');
  assert.equal(e.toMany, false);  // Area is the "one" end (bar)
  assert.equal(e.fromMany, true); // Workcenter is the "many" end (crow's foot)
});

test('relationshipEdges: keeps distinct foreign keys as separate links', () => {
  const raw = [
    { from: 'Order', to: 'Address', label: 'shipFromAddressId', many: false },
    { from: 'Order', to: 'Address', label: 'shipFromAddress', many: false },
    { from: 'Order', to: 'Address', label: 'shipToAddressId', many: false },
    { from: 'Order', to: 'Address', label: 'shipToAddress', many: false },
  ];
  const edges = relationshipEdges(raw);
  assert.equal(edges.length, 2); // two genuinely distinct relationships
  assert.deepEqual(edges.map(e => e.label).sort(), ['shipFromAddress', 'shipToAddress']);
});

test('buildModelGraph: focal carries fields; neighbors lazy; FK label canonicalized', () => {
  const graph = { name: 'Area', fields: [{ name: 'code', type: 'String!' }], relations: [{ field: 'workcenters', target: 'Workcenter', many: true }] };
  const refs = [{ from: 'WorkOrder', to: 'Area', label: 'areaId', many: false }];
  const g = buildModelGraph(graph, refs, 'application');

  const focal = g.nodes.find(n => n.name === 'Area');
  assert.ok(focal && focal.focal === true && focal.fields?.[0].name === 'code');
  const wcNode = g.nodes.find(n => n.name === 'Workcenter');
  assert.ok(wcNode && wcNode.fields === undefined && wcNode.service === 'application');
  assert.ok(g.nodes.some(n => n.name === 'WorkOrder'));
  assert.ok(g.edges.some(e => e.from === 'Area' && e.to === 'Workcenter' && e.toMany === true));
  // Inbound FK 'areaId' is canonicalized to 'area'.
  assert.ok(g.edges.some(e => e.from === 'WorkOrder' && e.to === 'Area' && e.label === 'area' && e.toMany === false));
});

test('buildSetGraph: only relationships internal to the set', () => {
  const refs = [
    { from: 'A', to: 'B', label: 'b', many: true },
    { from: 'A', to: 'External', label: 'x', many: false },
  ];
  const g = buildSetGraph(['A', 'B'], refs);
  assert.deepEqual(g.nodes.map(n => n.name).sort(), ['A', 'B']);
  assert.equal(g.edges.length, 1);
  assert.ok(g.edges[0].from === 'A' && g.edges[0].to === 'B' && g.edges[0].toMany === true);
  assert.ok(!g.nodes.some(n => n.name === 'External'));
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

test('parseModelFieldRecords: system_list_model_fields JSON-wrapped TRON tuples', () => {
  const out = [
    'Found 4 field(s) across 1 model(s). Results in TRON format:',
    '',
    'class A: name,type,description',
    '',
    '[{"name":"User","fields":[' +
      'A("id","ID!","The unique identifier of the User."),' +
      'A("email","String!","The email address. Also the username."),' +
      'A("homeTenant","Tenant","The home Tenant this User operates in."),' +
      'A("tenants","[UserTenant!]","The Tenants this User has access to.")' +
    ']}]',
  ].join('\n');
  const recs = parseModelFieldRecords(out);
  assert.equal(recs.length, 4);
  assert.deepEqual(recs[0], { name: 'id', type: 'ID!', description: 'The unique identifier of the User.' });
  assert.equal(recs[2].name, 'homeTenant');
  assert.equal(recs[3].type, '[UserTenant!]');
});

test('parseModelFieldRecords: descriptions with parens/markdown do not create phantom records', () => {
  // Real app-model descriptions embed markdown like "**`code`** (`String!`)".
  const out = [
    'class A: name,type,description',
    '[{"name":"ConversationStatus","fields":[' +
      'A("code","String!","**`code`** (`String!`)\nShort unique identifier code."),' +
      'A("conversations","[Conversation!]!","")' +
    ']}]',
  ].join('\n');
  const recs = parseModelFieldRecords(out);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].name, 'code');
  assert.equal(recs[1].name, 'conversations');
});

test('baseType / isRelationType: scalars vs model references', () => {
  assert.equal(baseType('[UserTenant!]'), 'UserTenant');
  assert.equal(baseType('String!'), 'String');
  assert.equal(isRelationType('String!'), false);
  assert.equal(isRelationType('ID!'), false);
  assert.equal(isRelationType('[JSONObject!]'), false); // JSON arrays aren't relations
  assert.equal(isRelationType('Duration'), false); // composite scalar {milliseconds,text}, not a relation
  assert.equal(isRelationType('Duration!'), false);
  assert.equal(isRelationType('Tenant'), true);
  assert.equal(isRelationType('[UserTenant!]'), true);
});
