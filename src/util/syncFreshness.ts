/**
 * Pure helpers for reasoning about how fresh a tenant's synced data is, and for
 * naming a tenant's repo folder. No VS Code dependency, so they unit-test in
 * plain Node (see test/syncFreshness.test.ts).
 */
import { Enterprise, Tenant, TenantResources } from '../types';

/** A connection's sync is considered stale once it is older than this (24h). */
export const SYNC_STALE_MS = 24 * 60 * 60 * 1000;

/** Milliseconds since a tenant's resources were last synced (Infinity if never). */
export function syncAgeMs(resources: TenantResources | null | undefined, now: number = Date.now()): number {
  const ts = resources?.lastSyncedAt ? Date.parse(resources.lastSyncedAt) : NaN;
  return Number.isFinite(ts) ? now - ts : Infinity;
}

/** True when a tenant has never synced or its last sync is older than 24h. */
export function isSyncStale(resources: TenantResources | null | undefined, now: number = Date.now()): boolean {
  return syncAgeMs(resources, now) > SYNC_STALE_MS;
}

/** Human-readable age, e.g. "3 hours ago", "2 days ago", or "never". */
export function describeSyncAge(resources: TenantResources | null | undefined, now: number = Date.now()): string {
  const ms = syncAgeMs(resources, now);
  if (!Number.isFinite(ms)) return 'never';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Filesystem-safe slug for a connection's repo folder, stable and readable. */
export function tenantFolderSlug(enterprise: Enterprise, tenant: Tenant): string {
  const clean = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  const ent = clean(enterprise.name || enterprise.id) || 'enterprise';
  const ten = clean(tenant.name || tenant.id) || 'tenant';
  return `${ent}-${ten}`;
}
