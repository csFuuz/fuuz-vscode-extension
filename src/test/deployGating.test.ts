import './helpers/vscodeMock';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { activate } from '../extension';
import { makeContext, resetVscodeMock, setConfigValue, recordedMessages, recordedQuickPicks, getCommand } from './helpers/vscodeMock';

/**
 * Security gate: `fuuz.enableDeploy` is off by default and the deploy command
 * must refuse (it can write to / destructively alter the tenant) until it is
 * explicitly enabled.
 */

test('fuuz.enableDeploy defaults to false in the contributed configuration', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  const prop = pkg.contributes.configuration.properties['fuuz.enableDeploy'];
  assert.equal(prop.type, 'boolean');
  assert.equal(prop.default, false);
});

test('deploy command refuses when enableDeploy is off (the default)', async () => {
  resetVscodeMock();
  const context = makeContext();
  await activate(context);

  // Activation must have succeeded (no error toast) and registered the command.
  assert.ok(!recordedMessages().some(m => /failed to activate/i.test(m.text)), 'activation should not error');
  const deploy = getCommand('fuuz.deployComponent');
  assert.ok(deploy, 'fuuz.deployComponent is registered');

  // enableDeploy unset → default false → refuse before any tenant work.
  await deploy!();
  assert.ok(recordedMessages().some(m => m.kind === 'warn' && /deploys are disabled/i.test(m.text)), 'shows the disabled warning');
  assert.equal(recordedQuickPicks().length, 0, 'never reaches the component-type quick pick');
});

test('with enableDeploy on, the deploy command passes the gate (and stops at no-tenant)', async () => {
  resetVscodeMock();
  setConfigValue('fuuz', 'enableDeploy', true);
  const context = makeContext();
  await activate(context);

  const deploy = getCommand('fuuz.deployComponent')!;
  await deploy();
  // Past the gate: it no longer shows the "disabled" warning; with no active
  // tenant it asks the user to select one instead.
  assert.ok(!recordedMessages().some(m => /deploys are disabled/i.test(m.text)), 'gate passed — no disabled warning');
  assert.ok(recordedMessages().some(m => /active Fuuz tenant/i.test(m.text)), 'stops at the no-tenant guard');
});
