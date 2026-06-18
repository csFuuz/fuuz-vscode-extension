import * as vscode from 'vscode';
import { TenantResources } from '../types';
import { TenantConfigurationManager } from '../services/tenantConfigurationManager';
import { TenantDataService } from '../services/tenantDataService';
import { isWebflowType } from '../util/fuuzParse';

/** A grouping folder carrying the items it should render and how. */
interface Category {
  items: any[];
  childKind: string;
}

/**
 * Resource tree for the active tenant, following the Fuuz application hierarchy:
 *
 *   moduleGroup → { Modules → module → (Screens, Flows, Data Models),
 *                   Documents, Scripts, GraphQL }
 */
export class ResourceTreeProvider implements vscode.TreeDataProvider<ResourceItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ResourceItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private resources: TenantResources | null = null;

  constructor(
    private readonly configManager: TenantConfigurationManager,
    private readonly dataService: TenantDataService
  ) {}

  refresh(): void {
    this.resources = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ResourceItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ResourceItem): Promise<ResourceItem[]> {
    const tenant = this.configManager.getActiveTenant();
    if (!tenant) {
      return [new ResourceItem('Select a tenant to view resources', vscode.TreeItemCollapsibleState.None, 'info')];
    }

    if (!element) {
      const resources = await this.dataService.getTenantResources(tenant);
      if (!resources) {
        return [new ResourceItem('Failed to load resources', vscode.TreeItemCollapsibleState.None, 'error')];
      }
      this.resources = resources;

      const roots: ResourceItem[] = [];
      const mcp = resources.mcp;
      if (mcp?.issues?.length) {
        roots.push(node(`Couldn't load some resources (${mcp.issues.length})`, 'issuesRoot', mcp.issues));
      }
      if (mcp?.application?.length) {
        roots.push(node('Application', 'appRoot', mcp.application));
      }
      if (mcp?.systemDataModels?.length) {
        roots.push(node('System Data Models', 'sysModelsRoot', mcp.systemDataModels));
      }
      if (mcp?.environment && Object.keys(mcp.environment).length) {
        roots.push(node('Environment', 'envRoot', mcp.environment));
      }
      if (mcp?.tools?.length) {
        roots.push(node('MCP Tools', 'toolsRoot', mcp.tools));
      }
      // Any flow-configured (non-MCP) module groups.
      for (const mg of resources.moduleGroups) {
        roots.push(node(mg.name, 'moduleGroup', mg, mg.description));
      }

      if (roots.length === 0) {
        const msg =
          resources.source === 'manual'
            ? 'No resources from MCP. Configure flows to provide resource details, or enable MCP for this key.'
            : 'No resources yet. Run Sync Tenant Data.';
        return [new ResourceItem(msg, vscode.TreeItemCollapsibleState.None, 'info')];
      }
      return roots;
    }

    if (element.contextValue === 'envRoot') {
      return Object.entries(element.node as Record<string, any>).map(
        ([k, v]) => new ResourceItem(`${k}: ${stringifyValue(v)}`, vscode.TreeItemCollapsibleState.None, 'envField', { k, v })
      );
    }

    if (element.contextValue === 'issuesRoot') {
      return (element.node as string[]).map(msg => new ResourceItem(msg, vscode.TreeItemCollapsibleState.None, 'issue'));
    }

    if (element.contextValue === 'appRoot') {
      return (element.node as any[]).map(mg => node(mg.name, 'moduleGroup', mg, mg.description));
    }

    if (element.contextValue === 'sysModelsRoot') {
      return (element.node as any[]).map(dm => node(dm.name, 'datamodel', dm, dm.description));
    }

    if (element.contextValue === 'toolsRoot') {
      const tools = element.node as any[];
      const dataflow = tools.filter(t => t.kind === 'dataflow');
      const system = tools.filter(t => t.kind !== 'dataflow');
      const out: ResourceItem[] = [];
      if (dataflow.length) out.push(folder('Custom (Data Flows)', dataflow, 'dataflowTool'));
      if (system.length) out.push(folder('System', system, 'mcpTool'));
      return out;
    }

    switch (element.contextValue) {
      case 'moduleGroup': {
        const mg = element.node;
        return [
          folder('Modules', mg.modules, 'module'),
          folder('Documents', mg.documents, 'document'),
          folder('Scripts', mg.scripts, 'script'),
          folder('GraphQL', mg.graphql, 'graphqlOp'),
        ];
      }
      case 'module': {
        const m = element.node;
        return [
          folder('Screens', m.screens, 'screen'),
          folder('Flows', m.flows, 'flow'),
          folder('Data Models', m.dataModels, 'datamodel'),
        ];
      }
      case 'flowGroup':
        return (element.node.flows as any[]).map(flowLeaf);
      case 'category': {
        const cat = element.category!;
        // Flows are grouped by type (Edge / Webflow / Backend) when types are known.
        if (cat.childKind === 'flow') return flowCategoryChildren(cat.items);
        const isToolKind = cat.childKind === 'mcpTool' || cat.childKind === 'dataflowTool';
        const ent = this.configManager.getActiveEnterprise();
        const disabled = isToolKind && ent && tenant
          ? new Set(this.configManager.disabledTools(ent.id, tenant.id))
          : null;
        return cat.items.map(it => {
          const item = node(labelFor(cat.childKind, it), cat.childKind, it, descFor(cat.childKind, it));
          if (disabled?.has(it.name)) {
            item.description = `${item.description ? item.description + ' • ' : ''}disabled`;
            item.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'));
          }
          return item;
        });
      }
      case 'datamodel': {
        let fields = element.node.fields;
        if ((!fields || fields.length === 0) && tenant && element.node.name) {
          fields = await this.dataService.getModelFields(tenant, element.node.name, element.node.service);
          element.node.fields = fields; // cache on the node for this session
        }
        return (fields ?? []).map((f: any) =>
          new ResourceItem(`${f.name} (${f.type})`, vscode.TreeItemCollapsibleState.None, 'field', f)
        );
      }
      default:
        return [];
    }
  }
}

const COLLAPSIBLE = new Set([
  'moduleGroup', 'module', 'datamodel', 'category', 'flowGroup', 'envRoot', 'appRoot', 'sysModelsRoot', 'toolsRoot', 'issuesRoot',
]);

/**
 * A single flow leaf. Web flows get the `flowWebflow` context (no Execute action,
 * since they can't run from VS Code); everything else is `flow` (executable).
 */
function flowLeaf(f: any): ResourceItem {
  const webflow = isWebflowType(f.type);
  const it = node(labelFor('flow', f), webflow ? 'flowWebflow' : 'flow', f);
  it.description = webflow ? 'web · run in Fuuz' : f.type || undefined;
  return it;
}

/** Render a module's flows: grouped by type when types are known, else flat. */
function flowCategoryChildren(items: any[]): ResourceItem[] {
  if (!items.some(f => f.type)) return items.map(flowLeaf);
  const groups = new Map<string, any[]>();
  for (const f of items) {
    const key = f.type || 'Other';
    const arr = groups.get(key);
    if (arr) arr.push(f);
    else groups.set(key, [f]);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([type, list]) => {
      const it = new ResourceItem(`${type} (${list.length})`, vscode.TreeItemCollapsibleState.Collapsed, 'flowGroup', { type, flows: list });
      return it;
    });
}

/** Render a primitive/object env value compactly for a tree label. */
function stringifyValue(v: any): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function node(label: string, kind: string, data: any, description?: string): ResourceItem {
  const state = COLLAPSIBLE.has(kind)
    ? vscode.TreeItemCollapsibleState.Collapsed
    : vscode.TreeItemCollapsibleState.None;
  const item = new ResourceItem(label, state, kind, data);
  if (description) item.description = description;
  return item;
}

/** Build a grouping folder; collapsed when it has items, with a count badge. */
function folder(label: string, items: any[] | undefined, childKind: string): ResourceItem {
  const list = items ?? [];
  const item = new ResourceItem(
    label,
    list.length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
    'category'
  );
  item.category = { items: list, childKind };
  item.description = String(list.length);
  return item;
}

function labelFor(kind: string, it: any): string {
  return it.name ?? it.id ?? '(unnamed)';
}

function descFor(kind: string, it: any): string | undefined {
  if (kind === 'graphqlOp') return it.kind;
  if (kind === 'script') return it.language;
  if (kind === 'document') return it.type;
  if (kind === 'mcpTool' || kind === 'dataflowTool') return it.description;
  return undefined;
}

class ResourceItem extends vscode.TreeItem {
  category?: Category;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public contextValue: string,
    public node?: any
  ) {
    super(label, collapsibleState);
    this.tooltip =
      contextValue === 'graphqlOp'
        ? `${node?.name ?? label} (${node?.kind ?? 'graphql'}) — execute via a data flow that references this operation`
        : node?.description || label;
    this.iconPath = this.getIcon(contextValue);
  }

  private getIcon(contextValue: string): vscode.ThemeIcon | undefined {
    // Highlight custom data-flow tools with a colored icon.
    if (contextValue === 'dataflowTool') {
      return new vscode.ThemeIcon('zap', new vscode.ThemeColor('charts.yellow'));
    }
    const iconMap: Record<string, string> = {
      category: 'folder',
      appRoot: 'symbol-namespace',
      sysModelsRoot: 'database',
      toolsRoot: 'tools',
      moduleGroup: 'symbol-namespace',
      module: 'symbol-module',
      screen: 'symbol-class',
      flow: 'symbol-method',
      flowWebflow: 'globe',
      flowGroup: 'list-tree',
      datamodel: 'symbol-struct',
      field: 'symbol-field',
      document: 'file',
      script: 'code',
      graphqlOp: 'symbol-interface',
      mcpTool: 'tools',
      envRoot: 'server-environment',
      envField: 'symbol-field',
      issuesRoot: 'warning',
      issue: 'warning',
      info: 'info',
      error: 'error',
    };
    const icon = iconMap[contextValue];
    return icon ? new vscode.ThemeIcon(icon) : undefined;
  }
}

export { ResourceItem };
