import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AppComponent,
  McpTool,
  componentPath,
  planMirror,
  planWikiPages,
  safeSeg,
} from '../github/mirrorPlan';

function comp(over: Partial<AppComponent>): AppComponent {
  return {
    kind: 'screen',
    id: 'id-1',
    name: 'My Screen',
    moduleGroup: 'Sales',
    module: 'Quoting',
    definition: { a: 1 },
    ...over,
  };
}

test('safeSeg: sanitizes unsafe chars, collapses/trims, and falls back to unnamed', () => {
  assert.equal(safeSeg('My Screen'), 'My-Screen');
  assert.equal(safeSeg('a/b\\c:d*e'), 'a-b-c-d-e');
  assert.equal(safeSeg('  --weird!!name--  '), 'weird-name');
  assert.equal(safeSeg('keeps.dots_and-dashes'), 'keeps.dots_and-dashes');
  assert.equal(safeSeg('***'), 'unnamed');
  assert.equal(safeSeg(''), 'unnamed');
});

test('componentPath: pluralizes kind and builds app/<mg>/<module>/<kind>/<name>.json', () => {
  assert.equal(
    componentPath(comp({ kind: 'screen', name: 'Home' })),
    'app/Sales/Quoting/screens/Home.json',
  );
  assert.equal(componentPath(comp({ kind: 'flow', name: 'Sync' })), 'app/Sales/Quoting/flows/Sync.json');
  assert.equal(
    componentPath(comp({ kind: 'dataModel', name: 'Order' })),
    'app/Sales/Quoting/dataModels/Order.json',
  );
  assert.equal(
    componentPath(comp({ kind: 'script', name: 'calc' })),
    'app/Sales/Quoting/scripts/calc.json',
  );
  assert.equal(
    componentPath(comp({ kind: 'query', name: 'topN' })),
    'app/Sales/Quoting/queries/topN.json',
  );
  assert.equal(
    componentPath(comp({ kind: 'document', name: 'spec' })),
    'app/Sales/Quoting/documents/spec.json',
  );
});

test('planMirror: excludes system data models (system flag and system group), counts skipped', () => {
  const components: AppComponent[] = [
    comp({ kind: 'dataModel', name: 'Order', moduleGroup: 'Sales' }),
    comp({ kind: 'dataModel', name: 'SysA', moduleGroup: 'Sales', ...( { system: true } as any) }),
    comp({ kind: 'dataModel', name: 'SysB', moduleGroup: 'system' }),
    comp({ kind: 'screen', name: 'Home', moduleGroup: 'system' }), // system group but not a dataModel -> kept
  ];
  const plan = planMirror(components, []);
  assert.equal(plan.skipped.systemModels, 2);
  const paths = plan.files.map((f) => f.path);
  assert.ok(paths.includes('app/Sales/Quoting/dataModels/Order.json'));
  assert.ok(!paths.some((p) => p.includes('SysA')));
  assert.ok(!paths.some((p) => p.includes('SysB')));
  // system-group *screen* is still mirrored (only data models are excluded)
  assert.ok(paths.includes('app/system/Quoting/screens/Home.json'));
});

test('planMirror: includeSystemDataModels keeps them and reports zero skipped', () => {
  const components: AppComponent[] = [
    comp({ kind: 'dataModel', name: 'SysB', moduleGroup: 'system' }),
  ];
  const plan = planMirror(components, [], { includeSystemDataModels: true });
  assert.equal(plan.skipped.systemModels, 0);
  assert.ok(plan.files.some((f) => f.path === 'app/system/Quoting/dataModels/SysB.json'));
});

test('planMirror: writes custom tools under tools/custom/ and skips system tools', () => {
  const tools: McpTool[] = [
    { name: 'my_flow_tool', kind: 'dataflow', definition: { x: 1 } },
    { name: 'system_query_model', kind: 'system' },
    { name: 'system_list_models', kind: 'system' },
  ];
  const plan = planMirror([], tools);
  assert.equal(plan.skipped.systemTools, 2);
  const toolFile = plan.files.find((f) => f.path === 'tools/custom/my_flow_tool.json');
  assert.ok(toolFile, 'custom tool file present');
  assert.deepEqual(JSON.parse(toolFile!.content), { name: 'my_flow_tool', kind: 'dataflow', definition: { x: 1 } });
  assert.ok(!plan.files.some((f) => f.path.includes('system_query_model')));
});

test('planMirror: always emits README.md and MIRROR.md; files sorted; content is pretty JSON', () => {
  const plan = planMirror(
    [comp({ kind: 'screen', name: 'Home' }), comp({ kind: 'flow', name: 'Sync' })],
    [{ name: 'tool_a', kind: 'dataflow' }],
  );
  const paths = plan.files.map((f) => f.path);
  assert.ok(paths.includes('README.md'));
  assert.ok(paths.includes('MIRROR.md'));

  // sorted deterministically
  const sorted = [...paths].sort();
  assert.deepEqual(paths, sorted);

  // README lists counts by kind
  const readme = plan.files.find((f) => f.path === 'README.md')!;
  assert.match(readme.content, /As-built Fuuz app mirror/);
  assert.match(readme.content, /screens: 1/);
  assert.match(readme.content, /flows: 1/);

  // MIRROR manifest lists the component + tool paths
  const manifest = plan.files.find((f) => f.path === 'MIRROR.md')!;
  assert.match(manifest.content, /app\/Sales\/Quoting\/screens\/Home\.json/);
  assert.match(manifest.content, /tools\/custom\/tool_a\.json/);

  // component content is pretty JSON with the expected shape
  const homeFile = plan.files.find((f) => f.path === 'app/Sales/Quoting/screens/Home.json')!;
  assert.ok(homeFile.content.includes('\n  '), 'pretty-printed with 2-space indent');
  const parsed = JSON.parse(homeFile.content);
  assert.deepEqual(Object.keys(parsed), ['id', 'name', 'moduleGroup', 'module', 'definition']);
});

test('planWikiPages: emits UAT-*/QA-* pages plus a linking Home.md index', () => {
  const files = planWikiPages({
    uatDocs: [
      { role: 'Sales Rep', filename: 'uat-sales.md', markdown: '# UAT Sales' },
      { role: 'Admin', filename: 'uat-admin.md', markdown: '# UAT Admin' },
    ],
    qaResults: [{ runId: 'run-2026-07-01', markdown: '# QA run' }],
  });
  const paths = files.map((f) => f.path);
  assert.ok(paths.includes('UAT-Sales-Rep.md'));
  assert.ok(paths.includes('UAT-Admin.md'));
  assert.ok(paths.includes('QA-run-2026-07-01.md'));
  assert.ok(paths.includes('Home.md'));

  // sorted
  assert.deepEqual(paths, [...paths].sort());

  const home = files.find((f) => f.path === 'Home.md')!;
  assert.match(home.content, /\[\[UAT-Sales-Rep\]\]/);
  assert.match(home.content, /\(uat-sales\.md\)/);
  assert.match(home.content, /\[\[QA-run-2026-07-01\]\]/);

  // UAT page content preserved verbatim
  const salesPage = files.find((f) => f.path === 'UAT-Sales-Rep.md')!;
  assert.equal(salesPage.content, '# UAT Sales');
});
