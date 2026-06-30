import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNC_STALE_MS,
  syncAgeMs,
  isSyncStale,
  describeSyncAge,
  tenantFolderSlug,
} from '../util/syncFreshness';
import { Enterprise, Tenant, TenantResources } from '../types';

const NOW = Date.parse('2026-06-30T12:00:00.000Z');
const res = (lastSyncedAt?: string): TenantResources =>
  ({ tenantId: 't', tenantName: 'T', moduleGroups: [], source: 'mcp', lastSyncedAt } as TenantResources);

test('syncAgeMs: returns elapsed ms, Infinity when never synced', () => {
  assert.equal(syncAgeMs(res('2026-06-30T11:00:00.000Z'), NOW), 60 * 60 * 1000);
  assert.equal(syncAgeMs(res(undefined), NOW), Infinity);
  assert.equal(syncAgeMs(null, NOW), Infinity);
  assert.equal(syncAgeMs(res('not-a-date'), NOW), Infinity);
});

test('isSyncStale: fresh under 24h, stale at/over 24h, stale when never synced', () => {
  assert.equal(isSyncStale(res(new Date(NOW - 23 * 3600_000).toISOString()), NOW), false);
  assert.equal(isSyncStale(res(new Date(NOW - 25 * 3600_000).toISOString()), NOW), true);
  // Exactly the threshold is NOT stale (strictly greater-than).
  assert.equal(isSyncStale(res(new Date(NOW - SYNC_STALE_MS).toISOString()), NOW), false);
  assert.equal(isSyncStale(res(new Date(NOW - SYNC_STALE_MS - 1).toISOString()), NOW), true);
  assert.equal(isSyncStale(null, NOW), true);
});

test('describeSyncAge: humanizes hours/days and never', () => {
  assert.equal(describeSyncAge(res(new Date(NOW - 30 * 60_000).toISOString()), NOW), 'less than an hour ago');
  assert.equal(describeSyncAge(res(new Date(NOW - 1 * 3600_000).toISOString()), NOW), '1 hour ago');
  assert.equal(describeSyncAge(res(new Date(NOW - 5 * 3600_000).toISOString()), NOW), '5 hours ago');
  assert.equal(describeSyncAge(res(new Date(NOW - 26 * 3600_000).toISOString()), NOW), '1 day ago');
  assert.equal(describeSyncAge(res(new Date(NOW - 72 * 3600_000).toISOString()), NOW), '3 days ago');
  assert.equal(describeSyncAge(null, NOW), 'never');
});

const ent = (name: string, id = 'e'): Enterprise => ({ id, name, mcpEndpoint: '', tenants: [] });
const ten = (name: string, id = 't'): Tenant => ({ id, name });

test('tenantFolderSlug: filesystem-safe, lowercased, collapses separators', () => {
  assert.equal(tenantFolderSlug(ent('ACME Corp'), ten('Production')), 'acme-corp-production');
  assert.equal(tenantFolderSlug(ent('A/B  C!!'), ten('Test  Env')), 'a-b-c-test-env');
});

test('tenantFolderSlug: falls back to ids, then to placeholders, for empty names', () => {
  assert.equal(tenantFolderSlug(ent('', 'ent-123'), ten('', 'tnt-9')), 'ent-123-tnt-9');
  assert.equal(tenantFolderSlug(ent('', ''), ten('***', '')), 'enterprise-tenant');
});
