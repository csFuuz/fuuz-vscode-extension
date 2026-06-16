import * as vscode from 'vscode';
import { TenantConfigurationManager } from '../services/tenantConfigurationManager';
import { ConnectionHealth } from '../services/connectionHealth';

/**
 * Status bar item showing the active Fuuz tenant. Clicking it opens the tenant
 * picker, giving a one-click way to switch the connection the MCP servers and
 * resource tree resolve against.
 */
export class FuuzStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor(
    private readonly configManager: TenantConfigurationManager,
    private readonly health: ConnectionHealth
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'fuuz.selectTenant';
    this.update();
    this.item.show();
  }

  update(): void {
    const enterprise = this.configManager.getActiveEnterprise();
    const tenant = this.configManager.getActiveTenant();

    if (enterprise && tenant) {
      const state = this.health.get(enterprise.id, tenant.id);
      if (state === 'unauthorized') {
        this.item.text = `$(warning) Fuuz: ${tenant.name} — key expired`;
        this.item.tooltip = `Fuuz ${enterprise.name} › ${tenant.name}: the API key was rejected.\nClick to switch tenant, or run "Fuuz: Replace API Key".`;
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this.item.command = 'fuuz.replaceKey';
        return;
      }
      this.item.text = `$(plug) Fuuz: ${enterprise.name} › ${tenant.name}`;
      this.item.tooltip = `Active Fuuz tenant — ${enterprise.name} › ${tenant.name}\nClick to switch tenant`;
      this.item.backgroundColor = undefined;
      this.item.command = 'fuuz.selectTenant';
    } else if (this.configManager.hasEnterprises()) {
      this.item.text = '$(plug) Fuuz: select tenant';
      this.item.tooltip = 'No active Fuuz tenant — click to select one';
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.item.text = '$(plug) Fuuz: configure';
      this.item.tooltip = 'No Fuuz connections configured — click to set one up';
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
