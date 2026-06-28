import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeTronPayload } from '../util/tron';

test('decodes a plain-JSON payload with a nested configuration object', () => {
  const raw = 'Retrieved 1 record(s). Results in TRON format:\n\n[{"name":"JS","type":"javascriptTransform","configuration":{"transform":"return 1;","nextNodes":["a"]}}]';
  const recs = decodeTronPayload(raw);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].type, 'javascriptTransform');
  assert.equal(recs[0].configuration.transform, 'return 1;');
  assert.deepEqual(recs[0].configuration.nextNodes, ['a']);
});

test('decodes a flat TRON class table', () => {
  const raw = 'class A: id,name,type\n\n[A("n1","Start","request"),A("n2","Calc","query")]';
  const recs = decodeTronPayload(raw);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].id, 'n1');
  assert.equal(recs[1].type, 'query');
});

test('decodes nested TRON tuples into real objects (configuration → savedRef)', () => {
  const raw = [
    'class A: name,type,configuration',
    'class B: requestTransform,transformId,nextNodes',
    'class C: id,name,scriptLanguageId',
    '',
    '[A("Saved","savedTransformV2",B("$",C("myScript","My Script","JavaScript"),["x"]))]',
  ].join('\n');
  const recs = decodeTronPayload(raw);
  assert.equal(recs.length, 1);
  const cfg = recs[0].configuration;
  assert.equal(cfg.requestTransform, '$');
  assert.equal(cfg.transformId.id, 'myScript');
  assert.equal(cfg.transformId.name, 'My Script');
  assert.deepEqual(cfg.nextNodes, ['x']);
});

test('decodes nested arrays of tuples (fork branches)', () => {
  const raw = [
    'class A: name,type,configuration',
    'class D: branches',
    'class B: name,nextNodes',
    '',
    '[A("Fork","fork",D([B("Header",["c1"]),B("Chat",["c2"])]))]',
  ].join('\n');
  const recs = decodeTronPayload(raw);
  const branches = recs[0].configuration.branches;
  assert.equal(branches.length, 2);
  assert.equal(branches[0].name, 'Header');
  assert.deepEqual(branches[1].nextNodes, ['c2']);
});

test('handles numbers, null and booleans in scalars', () => {
  const raw = 'class A: name,type,configuration\n\n[A("Collect","collect",{"batchCount":7,"batchTimeMs":30000,"merge":true,"x":null})]';
  const recs = decodeTronPayload(raw);
  assert.equal(recs[0].configuration.batchCount, 7);
  assert.equal(recs[0].configuration.merge, true);
  assert.equal(recs[0].configuration.x, null);
});

test('quoted parens/commas/class-letters inside values do not corrupt parsing', () => {
  const raw = 'class A: id,name\n\n[A("n1","Fork (A, B) — see C(x)"),A("n2","ok")]';
  const recs = decodeTronPayload(raw);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].name, 'Fork (A, B) — see C(x)');
  assert.equal(recs[1].id, 'n2');
});

test('preserves newlines from escaped \\n in script bodies', () => {
  const raw = 'class A: type,configuration\n\n[A("javascriptTransform",{"transform":"line1\\nline2\\nline3"})]';
  const recs = decodeTronPayload(raw);
  assert.equal((recs[0].configuration.transform as string).split('\n').length, 3);
});

test('returns [] for non-payload / unparseable text', () => {
  assert.deepEqual(decodeTronPayload('no tron here'), []);
  assert.deepEqual(decodeTronPayload(''), []);
});
