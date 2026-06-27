import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQaPlan, planToBrief } from '../qa/planGenerator';
import { deriveTarget, isLikelyTestEnv } from '../qa/qaTarget';
import { Persona, RunScope } from '../qa/runTypes';

const personas: Persona[] = [{ name: 'Operator', role: 'shop floor' }, { name: 'Supervisor' }];
const scope: RunScope = { kind: 'screen', name: 'Work Orders', model: 'WorkOrder' };
const mk = (target = deriveTarget('build.mfgx'), destructive = true, authority: 'autonomous' | 'manual' = 'autonomous') =>
  buildQaPlan({ runId: 'qa-1', createdAt: '2026-06-24T00:00:00Z', scope, target, personas, destructiveAllowed: destructive, authority, runDir: '.fuuz/qa/tnt/qa-1' });

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

test('buildQaPlan: includes security probes; gates injection on destructive', () => {
  const open = mk(deriveTarget('build.mfgx'), true);
  assert.ok(open.securitySteps.some(s => s.id === 'sec-forced-browse'));
  assert.ok(open.securitySteps.some(s => s.id === 'sec-xss')); // destructive, allowed
  const ro = mk(deriveTarget('build.mfgx'), false);
  assert.ok(ro.securitySteps.some(s => s.id === 'sec-forced-browse')); // read-only probe stays
  assert.ok(!ro.securitySteps.some(s => s.id === 'sec-xss')); // injection probe gated out
});

test('planToBrief: reflects authority and renders security section', () => {
  assert.match(planToBrief(mk(deriveTarget('build.mfgx'), true, 'autonomous')), /COMPLETE AUTHORITY/);
  assert.match(planToBrief(mk(deriveTarget('build.mfgx'), true, 'manual')), /Manual — supervised/);
  assert.match(planToBrief(mk()), /Security & RBAC probes/);
  assert.match(planToBrief(mk()), /Forced browsing/);
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
