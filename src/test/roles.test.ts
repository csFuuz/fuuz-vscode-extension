import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roleTestUserKey,
  roleSandboxDir,
  planRoleRun,
  rolesFromRecords,
  MAX_CONCURRENT_ROLES,
  TenantRole,
} from '../qa/roles';

test('roleTestUserKey builds a stable namespaced key', () => {
  assert.equal(roleTestUserKey('acme', 'admin'), 'fuuz-qa-user:acme:admin');
});

test('roleTestUserKey throws on empty tenant or role', () => {
  assert.throws(() => roleTestUserKey('', 'admin'));
  assert.throws(() => roleTestUserKey('acme', ''));
  assert.throws(() => roleTestUserKey('  ', 'admin'));
});

test('roleSandboxDir sanitizes the role id', () => {
  assert.equal(roleSandboxDir('/runs/42', 'admin'), '/runs/42/roles/admin');
  assert.equal(roleSandboxDir('/runs/42', 'Shop Floor/Op'), '/runs/42/roles/Shop-Floor-Op');
  assert.equal(roleSandboxDir('/runs/42', 'a.b_c-d'), '/runs/42/roles/a.b_c-d');
});

test('planRoleRun makes one session per role', () => {
  const roles: TenantRole[] = [
    { id: 'admin', name: 'Administrator' },
    { id: 'op', name: 'Operator' },
  ];
  const { sessions, capped, note } = planRoleRun('acme', '/runs/1', roles);
  assert.equal(capped, false);
  assert.equal(note, undefined);
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions[0], {
    roleId: 'admin',
    roleName: 'Administrator',
    credentialKey: 'fuuz-qa-user:acme:admin',
    sandboxDir: '/runs/1/roles/admin',
  });
});

test('planRoleRun dedupes by roleId', () => {
  const roles: TenantRole[] = [
    { id: 'admin', name: 'Administrator' },
    { id: 'admin', name: 'Dupe' },
    { id: 'op', name: 'Operator' },
  ];
  const { sessions } = planRoleRun('acme', '/runs/1', roles);
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions.map((s) => s.roleId), ['admin', 'op']);
});

test('planRoleRun with empty selection returns nothing, not capped', () => {
  const { sessions, capped, note } = planRoleRun('acme', '/runs/1', []);
  assert.deepEqual(sessions, []);
  assert.equal(capped, false);
  assert.equal(note, undefined);
});

test('planRoleRun caps at MAX_CONCURRENT_ROLES with a note', () => {
  const roles: TenantRole[] = Array.from({ length: 7 }, (_, i) => ({
    id: `r${i}`,
    name: `Role ${i}`,
  }));
  const { sessions, capped, note } = planRoleRun('acme', '/runs/1', roles);
  assert.equal(capped, true);
  assert.equal(sessions.length, MAX_CONCURRENT_ROLES);
  assert.equal(sessions.length, 5);
  assert.deepEqual(sessions.map((s) => s.roleId), ['r0', 'r1', 'r2', 'r3', 'r4']);
  assert.equal(note, 'limited to 5 of 7 roles for this run');
});

test('rolesFromRecords maps id/name rows', () => {
  const roles = rolesFromRecords([
    { id: 'admin', name: 'Administrator' },
    { id: 'op', name: 'Operator' },
  ]);
  assert.deepEqual(roles, [
    { id: 'admin', name: 'Administrator' },
    { id: 'op', name: 'Operator' },
  ]);
});

test('rolesFromRecords skips rows without an id', () => {
  const roles = rolesFromRecords([{ name: 'No Id' }, { id: 'ok', name: 'Ok' }, {}]);
  assert.deepEqual(roles, [{ id: 'ok', name: 'Ok' }]);
});

test('rolesFromRecords falls back to id for missing name', () => {
  const roles = rolesFromRecords([{ id: 'admin' }, { id: 'op', name: '' }]);
  assert.deepEqual(roles, [
    { id: 'admin', name: 'admin' },
    { id: 'op', name: 'op' },
  ]);
});
