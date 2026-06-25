import * as vscode from 'vscode';
import { TenantConfigurationManager } from '../services/tenantConfigurationManager';

/** Filesystem-safe folder name for a tenant's QA runs. */
export function tenantQaSlug(tenantId: string): string {
  return tenantId.replace(/[^A-Za-z0-9_-]/g, '_');
}

/** The active tenant's QA directory (`.fuuz/qa/<tenant>`), or undefined. */
export function activeTenantQaDir(configManager: TenantConfigurationManager): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const tenant = configManager.getActiveTenant();
  if (!folder || !tenant) return undefined;
  return vscode.Uri.joinPath(folder.uri, '.fuuz', 'qa', tenantQaSlug(tenant.id));
}

/**
 * Lists QA runs for the **active tenant** from `.fuuz/qa/<tenant>/<run>/` and
 * their artifacts (brief, plan, collected logs, report). Clicking a file opens
 * it. Refreshes when the active tenant changes.
 */
export class QaRunsProvider implements vscode.TreeDataProvider<QaItem> {
  private readonly _onDidChange = new vscode.EventEmitter<QaItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly configManager: TenantConfigurationManager) {}

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(e: QaItem): vscode.TreeItem {
    return e;
  }

  async getChildren(element?: QaItem): Promise<QaItem[]> {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      return [new QaItem('Open a folder to see QA runs', vscode.TreeItemCollapsibleState.None, 'info')];
    }
    if (!this.configManager.getActiveTenant()) {
      return [new QaItem('Select a tenant to see its QA runs', vscode.TreeItemCollapsibleState.None, 'info')];
    }
    const root = activeTenantQaDir(this.configManager)!;

    if (!element) {
      const entries = await safeReadDir(root);
      const runs = entries.filter(([, t]) => t === vscode.FileType.Directory).map(([n]) => n).sort().reverse();
      if (runs.length === 0) return [new QaItem('No QA runs yet — run "QA this Screen/App"', vscode.TreeItemCollapsibleState.None, 'info')];
      return runs.map(name => {
        const it = new QaItem(name, vscode.TreeItemCollapsibleState.Collapsed, 'run');
        it.resourceUri = vscode.Uri.joinPath(root, name);
        it.iconPath = new vscode.ThemeIcon('beaker');
        return it;
      });
    }

    if (element.contextValue === 'run' && element.resourceUri) {
      const files = await safeReadDir(element.resourceUri);
      return files
        .filter(([, t]) => t === vscode.FileType.File)
        .map(([n]) => n)
        .sort()
        .map(name => {
          const uri = vscode.Uri.joinPath(element.resourceUri!, name);
          const it = new QaItem(name, vscode.TreeItemCollapsibleState.None, 'file');
          it.resourceUri = uri;
          it.command = { command: 'vscode.open', title: 'Open', arguments: [uri] };
          it.iconPath = new vscode.ThemeIcon(name.endsWith('.md') ? 'markdown' : name.endsWith('.json') ? 'json' : 'file');
          return it;
        });
    }
    return [];
  }
}

async function safeReadDir(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
  try {
    return await vscode.workspace.fs.readDirectory(uri);
  } catch {
    return [];
  }
}

export class QaItem extends vscode.TreeItem {
  constructor(label: string, state: vscode.TreeItemCollapsibleState, public contextValue: string) {
    super(label, state);
  }
}
