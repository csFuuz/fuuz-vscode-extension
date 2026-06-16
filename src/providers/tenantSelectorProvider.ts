import * as vscode from 'vscode';
import { TenantConfigurationManager } from '../services/tenantConfigurationManager';
import { ConnectionHealth } from '../services/connectionHealth';

/**
 * Provides the tenant selector tree view in the sidebar
 */
export class TenantSelectorProvider implements vscode.TreeDataProvider<TenantItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TenantItem | undefined | null | void> =
    new vscode.EventEmitter<TenantItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TenantItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(
    private readonly configManager: TenantConfigurationManager,
    private readonly health: ConnectionHealth
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TenantItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TenantItem): Promise<TenantItem[]> {
    if (!element) {
      // Root level - show enterprises. Return empty when none so the view's
      // welcome content (with setup buttons) is shown instead.
      const enterprises = this.configManager.getEnterprises();
      return enterprises.map(e => new TenantItem(e.name, vscode.TreeItemCollapsibleState.Collapsed, 'enterprise', e.id));
    }

    // Child level - show tenants within enterprise
    if (element.contextValue === 'enterprise') {
      const enterprise = this.configManager.getEnterprise(element.id!);
      if (!enterprise) return [];

      return enterprise.tenants.map(t => {
        const isActive = 
          this.configManager.getActiveTenant()?.id === t.id &&
          this.configManager.getActiveEnterprise()?.id === enterprise.id;

        const item = new TenantItem(
          t.name,
          vscode.TreeItemCollapsibleState.None,
          'tenant',
          t.id,
          enterprise.id
        );

        const state = this.health.get(enterprise.id, t.id);
        if (state === 'unauthorized') {
          item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
          item.description = isActive ? '(active · key expired)' : 'key expired';
          item.tooltip = `${t.name}: the API key was rejected — run "Replace API Key".`;
          item.contextValue = 'tenant.unauthorized';
        } else if (state === 'unreachable') {
          item.iconPath = new vscode.ThemeIcon('debug-disconnect');
          item.description = isActive ? '(active · unreachable)' : 'unreachable';
        } else if (isActive) {
          item.iconPath = new vscode.ThemeIcon('check');
          item.description = '(active)';
        }

        item.command = {
          title: 'Select Tenant',
          command: 'fuuz.selectTenant',
          arguments: [enterprise.id, t.id],
        };

        return item;
      });
    }

    return [];
  }
}

class TenantItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public contextValue: string,
    public id?: string,
    public parentId?: string,
    public command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = label;
  }
}

export { TenantItem };
