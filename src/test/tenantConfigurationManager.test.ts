import './helpers/vscodeMock';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TenantConfigurationManager } from '../services/tenantConfigurationManager';
import { TokenStore } from '../services/tokenStore';
import { makeContext, resetVscodeMock } from './helpers/vscodeMock';

function setup() {
  resetVscodeMock();
  const context = makeContext();
  const tokenStore = new TokenStore(context.secrets);
  const mgr = new TenantConfigurationManager(context, tokenStore);
  return { context, tokenStore, mgr };
}

const ent = (id: string, name: string) => ({ id, name, environment: `${id}.x`, mcpEndpoint: `https://api.${id}.x.fuuz.app`, tenants: [] as any[] });

test('add/update tenant: upsert merges and preserves flags; token stored in secrets', async () => {
  const { mgr, tokenStore } = setup();
  await mgr.addOrUpdateEnterprise(ent('e1', 'Ent One'));
  await mgr.addOrUpdateTenant('e1', { id: 't1', name: 'Tenant One' }, 'TOK1');
  assert.equal(await tokenStore.getToken('e1', 't1'), 'TOK1');
  assert.equal(mgr.getTenant('e1', 't1')?.name, 'Tenant One');

  // Disable, then update the NAME only — the disabled flag must survive the merge.
  await mgr.setTenantDisabled('e1', 't1', true);
  await mgr.addOrUpdateTenant('e1', { id: 't1', name: 'Renamed' });
  assert.equal(mgr.getTenant('e1', 't1')?.name, 'Renamed');
  assert.equal(mgr.getTenant('e1', 't1')?.disabled, true);
});

test('removeTenant clears the active selection when the active tenant is removed', async () => {
  const { mgr, tokenStore } = setup();
  await mgr.addOrUpdateEnterprise(ent('e1', 'Ent One'));
  await mgr.addOrUpdateTenant('e1', { id: 't1', name: 'T1' }, 'TOK1');
  await mgr.addOrUpdateTenant('e1', { id: 't2', name: 'T2' }, 'TOK2');
  await mgr.setActiveTenant('e1', 't1');
  assert.equal(mgr.getActiveTenant()?.id, 't1');

  let fired = 0;
  mgr.onDidChangeActiveTenant(() => fired++);
  await mgr.removeTenant('e1', 't1');
  assert.equal(mgr.getActiveTenant(), null, 'active tenant reconciled to none');
  assert.equal(await tokenStore.getToken('e1', 't1'), undefined, 'token deleted');
  assert.equal(fired, 1);

  // Removing a NON-active tenant leaves the (now-unset) selection alone.
  await mgr.setActiveTenant('e1', 't2');
  await mgr.removeTenant('e1', 't2');
  assert.equal(mgr.getActiveTenant(), null);
});

test('removeEnterprise reconciles active selection + deletes all tenant tokens', async () => {
  const { mgr, tokenStore } = setup();
  await mgr.addOrUpdateEnterprise(ent('e1', 'Ent One'));
  await mgr.addOrUpdateTenant('e1', { id: 't1', name: 'T1' }, 'TOK1');
  await mgr.setActiveTenant('e1', 't1');

  await mgr.removeEnterprise('e1');
  assert.equal(mgr.getEnterprise('e1'), null);
  assert.equal(mgr.getActiveEnterprise(), null);
  assert.equal(mgr.getActiveTenant(), null);
  assert.equal(await tokenStore.getToken('e1', 't1'), undefined);
});

test('isToolEnabled defaults to enabled; setToolEnabled toggles the deny-list', async () => {
  const { mgr } = setup();
  await mgr.addOrUpdateEnterprise(ent('e1', 'Ent One'));
  await mgr.addOrUpdateTenant('e1', { id: 't1', name: 'T1' });
  assert.equal(mgr.isToolEnabled('e1', 't1', 'system_query_model'), true, 'enabled by default');

  await mgr.setToolEnabled('e1', 't1', 'system_query_model', false);
  assert.equal(mgr.isToolEnabled('e1', 't1', 'system_query_model'), false);
  assert.deepEqual(mgr.disabledTools('e1', 't1'), ['system_query_model']);

  await mgr.setToolEnabled('e1', 't1', 'system_query_model', true);
  assert.equal(mgr.isToolEnabled('e1', 't1', 'system_query_model'), true);
  assert.deepEqual(mgr.disabledTools('e1', 't1'), []);
});

test('migrateLegacyKeys moves plaintext apiKey into secrets and strips it from settings', async () => {
  const { mgr, tokenStore } = setup();
  await mgr.addOrUpdateEnterprise({ ...ent('e1', 'Ent One'), tenants: [{ id: 't1', name: 'T1', apiKey: 'LEGACY' }] as any });
  assert.equal(await tokenStore.hasToken('e1', 't1'), false);

  await mgr.migrateLegacyKeys();
  assert.equal(await tokenStore.getToken('e1', 't1'), 'LEGACY');
  assert.equal((mgr.getTenant('e1', 't1') as any).apiKey, undefined, 'plaintext key stripped from settings');

  // Idempotent: a second run with an existing token does not overwrite it.
  await tokenStore.setToken('e1', 't1', 'ROTATED');
  await mgr.migrateLegacyKeys();
  assert.equal(await tokenStore.getToken('e1', 't1'), 'ROTATED');
});
