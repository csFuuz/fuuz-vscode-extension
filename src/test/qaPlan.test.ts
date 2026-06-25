import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQaPlan, planToBrief } from '../qa/planGenerator';
import { deriveTarget, isLikelyTestEnv } from '../qa/qaTarget';
import { Persona, RunScope } from '../qa/runTypes';

const personas: Persona[] = [{ name: 'Operator', role: 'shop floor' }, { name: 'Supervisor' }];
const scope: RunScope = { kind: 'screen', name: 'Work Orders', model: 'WorkOrder' };
const mk = (target = deriveTarget('build.mfgx'), destructive = true) =>
  buildQaPlan({ runId: 'qa-1', createdAt: '2026-06-24T00:00:00Z', scope, target, personas, destructiveAllowed: destructive, runDir: '.fuuz/qa/tnt/qa-1' });

test('isLikelyTestEnv: test tokens true, prod tokens false', () => {
  assert.equal(isLikelyTestEnv('build.mfgx'), true);
  assert.equal(isLikelyTestEnv('dev.acme'), true);
  assert.equal(isLikelyTestEnv('qa.acme'), true);
  assert.equal(isLikelyTestEnv('prod.acme'), false);
  assert.equal(isLikelyTestEnv('acme.production'), false);
  assert.equal(isLikelyTestEnv('mfgx'), false); // unknown → not auto-allowed
});

test('deriveTarget: builds the app URL and flags test env', () => {
  const t = deriveTarget('build.mfgx');
  assert.equal(t.url, 'https://build.mfgx.fuuz.app');
  assert.equal(t.isTestEnv, true);
  assert.equal(deriveTarget('build.mfgx', 'https://custom.example').url, 'https://custom.example');
});

test('buildQaPlan: includes destructive steps when allowed', () => {
  const plan = mk(deriveTarget('build.mfgx'), true);
  assert.ok(plan.steps.some(s => s.id === 'create' && s.destructive));
  assert.equal(plan.runDir, '.fuuz/qa/tnt/qa-1');
});

test('buildQaPlan: omits destructive steps when not allowed', () => {
  const plan = mk(deriveTarget('build.mfgx'), false);
  assert.ok(!plan.steps.some(s => s.destructive));
  assert.ok(plan.steps.some(s => s.id === 'read')); // non-destructive steps remain
});

test('planToBrief: renders target, personas, checklist and safety', () => {
  const brief = planToBrief(mk());
  assert.match(brief, /QA Run — Work Orders/);
  assert.match(brief, /https:\/\/build\.mfgx\.fuuz\.app/);
  assert.match(brief, /Persona 1: Operator/);
  assert.match(brief, /Persona 2: Supervisor/);
  assert.match(brief, /UI\/UX grooming/);
  assert.match(brief, /collected separately by the extension over MCP/);
  assert.match(brief, /\.fuuz\/qa\/tnt\/qa-1\/result\.json/); // structured result requested
  assert.match(brief, /\.fuuz\/qa\/tnt\/qa-1\/artifacts/); // tenant-scoped artifacts path
});

test('planToBrief: warns when destructive disabled', () => {
  const brief = planToBrief(mk(deriveTarget('build.mfgx'), false));
  assert.match(brief, /Destructive steps are \*\*disabled\*\*/);
});

test('planToBrief: flags a non-test environment', () => {
  const brief = planToBrief(mk(deriveTarget('prod.acme'), false));
  assert.match(brief, /does NOT look like a test environment/);
});
