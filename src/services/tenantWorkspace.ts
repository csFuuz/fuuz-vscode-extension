import * as vscode from 'vscode';
import { Enterprise, Tenant } from '../types';
import { tenantFolderSlug } from '../util/syncFreshness';

// Re-export the pure freshness/slug helpers so existing call sites can keep
// importing them from here (their logic lives in util/ for unit testing).
export { SYNC_STALE_MS, syncAgeMs, isSyncStale, describeSyncAge, tenantFolderSlug } from '../util/syncFreshness';

/**
 * Manages the per-tenant repo folder under `.fuuz/` in the user's workspace.
 * Each connected tenant gets its own folder (`.fuuz/<enterprise>-<tenant>/`) so
 * the copilot's generated files and context for one tenant never collide with
 * another's. The folder is created on demand if it doesn't exist yet.
 */
export class TenantWorkspace {
  /** The workspace root, or null when no folder is open. */
  root(): vscode.Uri | null {
    return vscode.workspace.workspaceFolders?.[0]?.uri ?? null;
  }

  /** The `.fuuz/` base dir, or null when no folder is open. */
  baseDir(): vscode.Uri | null {
    const root = this.root();
    return root ? vscode.Uri.joinPath(root, '.fuuz') : null;
  }

  /** The folder URI for a tenant (does not create it). */
  tenantDirUri(enterprise: Enterprise, tenant: Tenant): vscode.Uri | null {
    const base = this.baseDir();
    return base ? vscode.Uri.joinPath(base, tenantFolderSlug(enterprise, tenant)) : null;
  }

  /** Whether the tenant's folder already exists. */
  async exists(enterprise: Enterprise, tenant: Tenant): Promise<boolean> {
    const uri = this.tenantDirUri(enterprise, tenant);
    if (!uri) return false;
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure the tenant's repo folder exists, creating it (and `.fuuz/`) if not.
   * Returns the folder URI, or null when no workspace folder is open.
   */
  async ensureTenantDir(enterprise: Enterprise, tenant: Tenant): Promise<vscode.Uri | null> {
    const uri = this.tenantDirUri(enterprise, tenant);
    if (!uri) return null;
    await vscode.workspace.fs.createDirectory(uri);
    return uri;
  }
}
