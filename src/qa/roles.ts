/**
 * Tenant-role planning for the QA harness. Instead of manual "persona" entry,
 * each concurrent Playwright test runs as its own tenant role using a pre-saved
 * test user (credentials live in VS Code SecretStorage, wired elsewhere). Here
 * we only compute stable storage keys, sandbox paths, and the per-run plan.
 * Pure + dependency-free (no `vscode` import) so it's unit-testable.
 */

/** A tenant role selectable for a QA run. */
export interface TenantRole {
  id: string;
  name: string;
}

/** One role's slot in a run: its credential key and isolated sandbox. */
export interface RoleSession {
  roleId: string;
  roleName: string;
  credentialKey: string;
  sandboxDir: string;
}

/** Max roles (hence concurrent sandboxed logins) allowed in a single run. */
export const MAX_CONCURRENT_ROLES = 5;

/** Replace filesystem-unsafe chars so a role id can be used as a dir name. */
function safe(seg: string): string {
  return seg.replace(/[^A-Za-z0-9._-]/g, '-');
}

/**
 * Stable SecretStorage key for a role's pre-saved test-user credential.
 * Throws if either identifier is empty — a blank key would collide across
 * tenants/roles and leak the wrong login into a test.
 */
export function roleTestUserKey(tenantId: string, roleId: string): string {
  if (!tenantId?.trim()) throw new Error('tenantId is required');
  if (!roleId?.trim()) throw new Error('roleId is required');
  return `fuuz-qa-user:${tenantId}:${roleId}`;
}

/** Filesystem-safe sandbox subdir for a role under a run's working dir. */
export function roleSandboxDir(runDir: string, roleId: string): string {
  return `${runDir}/roles/${safe(roleId)}`;
}

/**
 * Plan a run: one {@link RoleSession} per selected role (1 role per test),
 * deduped by id and capped at {@link MAX_CONCURRENT_ROLES}. When the selection
 * exceeds the cap we keep only the first MAX and flag `capped` with a note.
 */
export function planRoleRun(
  tenantId: string,
  runDir: string,
  selected: TenantRole[]
): { sessions: RoleSession[]; capped: boolean; note?: string } {
  const seen = new Set<string>();
  const unique: TenantRole[] = [];
  for (const role of selected ?? []) {
    if (!role?.id || seen.has(role.id)) continue;
    seen.add(role.id);
    unique.push(role);
  }

  const capped = unique.length > MAX_CONCURRENT_ROLES;
  const total = unique.length;
  const chosen = capped ? unique.slice(0, MAX_CONCURRENT_ROLES) : unique;

  const sessions: RoleSession[] = chosen.map((role) => ({
    roleId: role.id,
    roleName: role.name || role.id,
    credentialKey: roleTestUserKey(tenantId, role.id),
    sandboxDir: roleSandboxDir(runDir, role.id),
  }));

  if (capped) {
    return {
      sessions,
      capped: true,
      note: `limited to ${MAX_CONCURRENT_ROLES} of ${total} roles for this run`,
    };
  }
  return { sessions, capped: false };
}

/**
 * Map decoded `Role` model rows to {@link TenantRole}[]. Rows without an id are
 * skipped; `name` falls back to the id when absent.
 */
export function rolesFromRecords(records: Array<Record<string, any>>): TenantRole[] {
  const roles: TenantRole[] = [];
  for (const row of records ?? []) {
    const id = row?.id;
    if (!id) continue;
    roles.push({ id: String(id), name: row.name ? String(row.name) : String(id) });
  }
  return roles;
}
