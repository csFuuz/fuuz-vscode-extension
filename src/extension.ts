import * as vscode from 'vscode';
import { TenantConfigurationManager } from './services/tenantConfigurationManager';
import { TokenStore } from './services/tokenStore';
import { TenantSelectorProvider } from './providers/tenantSelectorProvider';
import { ResourceTreeProvider } from './providers/resourceTreeProvider';
import { FuuzMcpClient } from './services/fuuzMcpClient';
import { TenantDataService } from './services/tenantDataService';
import { FuuzMcpServerProvider } from './services/mcpServerProvider';
import { McpJsonWriter } from './services/mcpJsonWriter';
import { ClaudeMcpWriter, ClaudeTarget } from './services/claudeMcpWriter';
import { ContextDocWriter } from './services/contextDocWriter';
import { FuuzApiClient } from './services/fuuzApiClient';
import { ConnectionImporter } from './services/connectionImporter';
import { ConnectionHealth } from './services/connectionHealth';
import { EndpointProbe } from './services/fuuzMcpClient';
import { ConfigPanel } from './ui/configPanel';
import { FuuzStatusBar } from './ui/statusBar';
import { registerRuntimeCommands } from './ui/runtimeCommands';
import { ErdPanel } from './ui/erdPanel';
import { buildModelGraph, buildSetGraph } from './util/fuuzParse';
import type { ErdService } from './util/erdTypes';
import { fuuzLog } from './services/logger';
import { isAbortError } from './util/abort';

export async function activate(context: vscode.ExtensionContext) {
  try {
    const tokenStore = new TokenStore(context.secrets);
    const configManager = new TenantConfigurationManager(context, tokenStore);
    // Legacy-key migration only does work when enterprises exist; skip the await
    // entirely for the common "installed but unconfigured" case.
    const hasConfig = configManager.hasEnterprises();
    if (hasConfig) await configManager.migrateLegacyKeys();

    const health = new ConnectionHealth();
    const mcpClient = new FuuzMcpClient();
    const resourceService = new TenantDataService(mcpClient, configManager, tokenStore, health);
    const connectionImporter = new ConnectionImporter(configManager, tokenStore, mcpClient);

    const tenantSelectorProvider = new TenantSelectorProvider(configManager, health);
    const resourceTreeProvider = new ResourceTreeProvider(configManager, resourceService);
    const statusBar = new FuuzStatusBar(configManager, health);
    const mcpJsonWriter = new McpJsonWriter(configManager);
    const claudeMcpWriter = new ClaudeMcpWriter(configManager, tokenStore, context.extensionUri);
    const contextDocWriter = new ContextDocWriter(configManager, resourceService);

    // Register the Fuuz MCP servers with VS Code (guarded for older hosts).
    const mcpServerProvider = new FuuzMcpServerProvider(configManager, tokenStore, context.extensionUri);
    if (typeof vscode.lm?.registerMcpServerDefinitionProvider === 'function') {
      context.subscriptions.push(
        vscode.lm.registerMcpServerDefinitionProvider(FuuzMcpServerProvider.PROVIDER_ID, mcpServerProvider)
      );
    } else {
      fuuzLog('this VS Code build lacks the MCP API; falling back to .vscode/mcp.json only.');
    }

    vscode.window.registerTreeDataProvider('fuuzTenantSelector', tenantSelectorProvider);
    const resourceView = vscode.window.createTreeView('fuuzResourceTree', { treeDataProvider: resourceTreeProvider });
    context.subscriptions.push(resourceView);

    const updateResourceMessage = () => {
      const t = configManager.getActiveTenant();
      const snap = t ? configManager.getCachedResources(t.id) : null;
      resourceView.message = snap?.lastSyncedAt
        ? `${snap.source === 'mcp' ? 'MCP' : 'manual'} · last synced ${new Date(snap.lastSyncedAt).toLocaleString()}`
        : undefined;
    };

    // A single place to react to any connection/selection/token change.
    const onChanged = () => {
      tenantSelectorProvider.refresh();
      resourceTreeProvider.refresh();
      statusBar.update();
      mcpServerProvider.refresh();
      claudeMcpWriter.scheduleAutoSync();
      ConfigPanel.refreshIfOpen();
      updateResourceMessage();
      void updateContextFlags(configManager);
    };

    registerCommands(context, {
      configManager,
      resourceService,
      resourceTreeProvider,
      mcpJsonWriter,
      claudeMcpWriter,
      contextDocWriter,
      tokenStore,
      mcpClient,
      connectionImporter,
      health,
      onChanged,
    });

    // Runtime endpoint commands: execute flow, send webhook.
    registerRuntimeCommands(context, { configManager, tokenStore, apiClient: new FuuzApiClient(), health });

    await updateContextFlags(configManager);
    updateResourceMessage();

    // Startup IO only matters when connections exist. For an installed-but-
    // unconfigured workspace, skip the Claude auto-register file reads and the
    // stale-cache network refresh entirely.
    if (hasConfig) {
      // Register existing connections with Claude on startup (per fuuz.claudeAutoRegister).
      claudeMcpWriter.scheduleAutoSync();

      // Auto-refresh the active tenant on startup if its cache is stale (>30 min).
      void (async () => {
        const t = configManager.getActiveTenant();
        if (!t) return;
        const snap = configManager.getCachedResources(t.id);
        const ageMs = snap?.lastSyncedAt ? Date.now() - new Date(snap.lastSyncedAt).getTime() : Infinity;
        if (ageMs > 30 * 60 * 1000) {
          await resourceService.syncTenantResources(t).catch(err => fuuzLog(`startup refresh failed: ${errMsg(err)}`));
          onChanged();
        }
      })();
    }

    context.subscriptions.push(
      configManager.onDidChangeActiveTenant(onChanged),
      tokenStore.onDidChange(() => mcpServerProvider.refresh()),
      health.onDidChange(() => {
        tenantSelectorProvider.refresh();
        statusBar.update();
      }),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('fuuz')) onChanged();
      }),
      statusBar,
      tokenStore,
      configManager,
      mcpServerProvider,
      claudeMcpWriter,
      health
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Fuuz extension failed to activate: ${message}`);
    fuuzLog(`activation failed: ${message}`);
  }
}

interface CommandDeps {
  configManager: TenantConfigurationManager;
  resourceService: TenantDataService;
  resourceTreeProvider: ResourceTreeProvider;
  mcpJsonWriter: McpJsonWriter;
  claudeMcpWriter: ClaudeMcpWriter;
  contextDocWriter: ContextDocWriter;
  tokenStore: TokenStore;
  mcpClient: FuuzMcpClient;
  connectionImporter: ConnectionImporter;
  health: ConnectionHealth;
  onChanged: () => void;
}

function registerCommands(context: vscode.ExtensionContext, deps: CommandDeps) {
  const { configManager, resourceService, resourceTreeProvider, mcpJsonWriter, claudeMcpWriter, contextDocWriter, connectionImporter, tokenStore, mcpClient, health } = deps;

  const register = (id: string, fn: (...args: any[]) => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  register('fuuz.openConfigPanel', () => {
    ConfigPanel.createOrShow(context, {
      configManager: deps.configManager,
      tokenStore: deps.tokenStore,
      mcpClient: deps.mcpClient,
      connectionImporter: deps.connectionImporter,
      resourceService: deps.resourceService,
      health: deps.health,
      onChanged: deps.onChanged,
    });
  });

  // Reusable re-auth: replace a tenant's API key, re-validate, re-sync.
  register('fuuz.replaceKey', async (arg1?: any, arg2?: string) => {
    // Accept (enterpriseId, tenantId), a tree item, or fall back to the active tenant.
    let enterpriseId: string | undefined = typeof arg1 === 'string' ? arg1 : arg1?.parentId;
    let tenantId: string | undefined = typeof arg1 === 'string' ? arg2 : arg1?.id;
    if (!enterpriseId || !tenantId) {
      enterpriseId = configManager.getActiveEnterprise()?.id;
      tenantId = configManager.getActiveTenant()?.id;
    }
    const enterprise = enterpriseId ? configManager.getEnterprise(enterpriseId) : null;
    const tenant = enterprise && tenantId ? configManager.getTenant(enterprise.id, tenantId) : null;
    if (!enterprise || !tenant) {
      vscode.window.showErrorMessage('Fuuz: no tenant to replace a key for.');
      return;
    }
    const newKey = await vscode.window.showInputBox({
      title: `Replace API key — ${tenant.name}`,
      prompt: 'Paste the new Fuuz API key for this tenant',
      password: true,
      ignoreFocusOut: true,
      validateInput: v => (v.trim() ? undefined : 'An API key is required'),
    });
    if (!newKey) return;
    await tokenStore.setToken(enterprise.id, tenant.id, newKey.trim());
    const probe = await mcpClient.initializeMcp(configManager.endpointsFor(enterprise).mcp, newKey.trim());
    health.set(enterprise.id, tenant.id, probe.ok ? 'ok' : 'unauthorized', probe.ok ? undefined : probe.message);
    resourceService.forgetUnauthorizedWarning(tenant.id); // new key → re-check perms
    await resourceService.syncTenantResources(tenant).catch(err => fuuzLog(`sync after key replace failed: ${errMsg(err)}`));
    deps.onChanged();
    if (probe.ok) vscode.window.showInformationMessage(`Fuuz: key updated — ${tenant.name} connected.`);
    else vscode.window.showWarningMessage(`Fuuz: key updated but validation failed — ${probe.message}`);
  });

  register('fuuz.addConnectionByKey', async () => {
    const token = await vscode.window.showInputBox({
      title: 'Add Fuuz Connection',
      prompt: 'Paste a Fuuz API key — the tenant, enterprise and environment are detected from it',
      password: true,
      ignoreFocusOut: true,
      validateInput: v => (v.trim() ? undefined : 'An API key is required'),
    });
    if (!token) return;

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Fuuz: validating API key…', cancellable: false },
      async () => {
        try {
          const result = await connectionImporter.importByToken(token.trim());
          await configManager.setActiveTenant(result.enterpriseId, result.tenantId);
          // Auto-pull resources from MCP so the Resources view populates.
          const tenant = configManager.getTenant(result.enterpriseId, result.tenantId);
          if (tenant) {
            await resourceService.syncTenantResources(tenant).catch(err => fuuzLog(`initial sync failed: ${errMsg(err)}`));
          }
          deps.onChanged();
          const summary = summarizeProbes(result.probes);
          const verb = result.createdEnterprise ? 'Added enterprise &' : 'Added';
          const headline = `Fuuz: ${verb} tenant ${result.enterpriseName} › ${result.tenantName}. ${summary}`;
          if (result.probes.some(p => p.state !== 'available')) {
            void vscode.window.showWarningMessage(headline);
          } else {
            void vscode.window.showInformationMessage(headline);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Fuuz: ${errMsg(error)}`);
        }
      }
    );
  });

  // Back-compat alias for the existing "Configure Tenants" command.
  register('fuuz.configureTenants', () => vscode.commands.executeCommand('fuuz.openConfigPanel'));

  register('fuuz.selectTenant', async (enterpriseId?: string, tenantId?: string) => {
    try {
      if (enterpriseId && tenantId) {
        await configManager.setActiveTenant(enterpriseId, tenantId);
      } else {
        await configManager.selectTenant();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to select tenant: ${errMsg(error)}`);
    }
  });

  register('fuuz.syncTenantData', async () => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) {
      vscode.window.showErrorMessage('No tenant selected');
      return;
    }
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Syncing ${tenant.name} data…`, cancellable: false },
      async () => {
        try {
          resourceService.forgetUnauthorizedWarning(tenant.id); // explicit sync → re-check perms
          await resourceService.syncTenantResources(tenant);
          resourceTreeProvider.refresh();
          vscode.window.showInformationMessage(`Synced ${tenant.name} data`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to sync tenant data: ${errMsg(error)}`);
        }
      }
    );
  });

  register('fuuz.writeMcpJson', async () => {
    if (!mcpJsonWriter.canWrite) {
      vscode.window.showWarningMessage('Open a folder to write .vscode/mcp.json');
      return;
    }
    const uri = await mcpJsonWriter.sync();
    if (uri) {
      const open = await vscode.window.showInformationMessage(
        'Wrote Fuuz servers to .vscode/mcp.json',
        'Open'
      );
      if (open) await vscode.window.showTextDocument(uri);
    }
  });

  register('fuuz.registerWithClaude', async () => {
    const planned = claudeMcpWriter.plannedServers();
    if (planned.length === 0) {
      vscode.window.showWarningMessage(
        'No enabled Fuuz connections to register. Add a connection by API key first.'
      );
      return;
    }

    type TargetPick = vscode.QuickPickItem & { target: ClaudeTarget };
    const choices: TargetPick[] = [
      {
        target: 'user',
        label: 'Claude Code — all projects (user)',
        detail: '~/.claude.json · token embedded (private, not committed) · just restart Claude',
        picked: true,
      },
      {
        target: 'desktop',
        label: 'Claude Desktop',
        detail: 'claude_desktop_config.json · token embedded · just restart Claude',
        picked: true,
      },
      {
        target: 'project',
        label: 'Claude Code — this project (shareable)',
        detail: '.mcp.json at the workspace root · token NOT embedded (env var) · safe to commit',
        picked: false,
      },
    ];
    const selection = await vscode.window.showQuickPick(choices, {
      canPickMany: true,
      title: 'Register Fuuz MCP server with Claude',
      placeHolder: 'User + Desktop embed the token; project uses an env var so it can be committed',
    });
    if (!selection || selection.length === 0) return;

    const results = await claudeMcpWriter.sync(selection.map(s => s.target));
    const wrote = results.filter(r => r.path);
    const skipped = results.filter(r => r.skipped);

    if (wrote.length === 0) {
      vscode.window.showWarningMessage(
        `Couldn't write any Claude config: ${skipped.map(s => `${s.target} (${s.skipped})`).join('; ')}`
      );
      return;
    }

    const missing = [...new Set(wrote.flatMap(r => r.missingToken))];
    const wroteProject = wrote.some(r => r.tokenMode === 'envref');

    let summary = `Registered ${planned.length} Fuuz server(s) with ${wrote.map(r => r.target).join(', ')}. Restart Claude to load them.`;
    if (missing.length) summary += ` Skipped (no stored token): ${missing.join(', ')}.`;
    if (skipped.length) summary += ` ${skipped.map(s => `${s.target} skipped (${s.skipped})`).join('; ')}.`;

    const COPY = 'Copy export commands';
    const OPEN = 'Open a config file';
    // Only the project target uses env vars; embed targets need no copy step.
    const actions = wroteProject ? [COPY, OPEN] : [OPEN];
    const choice = await vscode.window.showInformationMessage(
      wroteProject
        ? `${summary} The project .mcp.json references FUUZ_TOKEN_* env vars — export them for it to connect.`
        : summary,
      ...actions
    );

    if (choice === COPY) {
      const lines: string[] = [];
      for (const s of planned) {
        const token = await tokenStore.getToken(s.enterpriseId, s.tenantId);
        lines.push(
          token
            ? `export ${s.envVar}='${token}'`
            : `# ${s.envVar}: no stored token for ${s.enterpriseName} › ${s.tenantName} — add the connection's API key`
        );
      }
      await vscode.env.clipboard.writeText(lines.join('\n') + '\n');
      vscode.window.showInformationMessage(
        'Export commands copied. Paste them into your shell profile (e.g. ~/.zshrc), then restart Claude.'
      );
    } else if (choice === OPEN) {
      const target = wrote[0];
      if (target.path) await vscode.window.showTextDocument(vscode.Uri.file(target.path));
    }
  });

  register('fuuz.generateContextDoc', async () => {
    const uri = await contextDocWriter.write();
    if (uri) {
      const open = await vscode.window.showInformationMessage('Generated .fuuz/AVAILABLE.md', 'Open');
      if (open) await vscode.window.showTextDocument(uri);
    }
  });

  register('fuuz.openTenantSettings', () =>
    vscode.commands.executeCommand('workbench.action.openSettings', 'fuuz')
  );

  register('fuuz.findResource', async () => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    const snap = configManager.getCachedResources(tenant.id);
    if (!snap?.mcp) { vscode.window.showWarningMessage('No resources synced yet. Run Sync Tenant Data.'); return; }
    const items: { label: string; description: string; model: string; service: 'system' | 'application' }[] = [];
    for (const mg of snap.mcp.application ?? []) {
      for (const m of mg.modules ?? []) {
        for (const dm of m.dataModels ?? []) items.push({ label: dm.name, description: `${mg.name} › ${m.name}`, model: dm.name, service: 'application' });
      }
    }
    for (const dm of snap.mcp.systemDataModels ?? []) items.push({ label: dm.name, description: 'system', model: dm.name, service: 'system' });
    const pick = await vscode.window.showQuickPick(items, { title: 'Find Data Model', placeHolder: 'Type to filter; select to open its ERD', matchOnDescription: true });
    if (pick) await vscode.commands.executeCommand('fuuz.showErd', { node: { name: pick.model, service: pick.service } });
  });

  register('fuuz.queryModel', async (arg?: unknown) => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    const node = nodeArg(arg);
    let modelName: string | undefined = node?.name || (typeof arg === 'string' ? arg : undefined);
    const service: ErdService = node?.service ?? 'application';
    if (!modelName) {
      modelName = await vscode.window.showInputBox({ title: 'Query Data Model', prompt: 'Data model name (e.g. Area)', ignoreFocusOut: true });
    }
    if (!modelName) return;

    await withCancellable(`Fuuz: querying ${modelName}…`, async signal => {
        // Default to the model's scalar fields; let the user pick a subset.
        const graph = await resourceService.getModelGraph(tenant, modelName!.trim(), service, signal);
        const allFields = (graph?.fields ?? []).map(f => f.name);
        let fields = allFields.slice(0, 12);
        if (allFields.length) {
          const picked = await vscode.window.showQuickPick(allFields, {
            canPickMany: true, title: `Fields to return — ${modelName}`, placeHolder: 'Default: first 12 scalar fields',
          });
          if (picked && picked.length) fields = picked;
        }
        if (fields.length === 0) fields = ['id', 'name'];
        const where = await vscode.window.showInputBox({
          title: 'Filter (JSON)', value: '{}', ignoreFocusOut: true,
          validateInput: v => { try { JSON.parse(v || '{}'); return undefined; } catch { return 'Must be valid JSON'; } },
        });
        if (where === undefined) return;

        const result = await resourceService.queryModel(tenant, modelName!.trim(), fields, where, service, signal);
        if (!result) { vscode.window.showWarningMessage(`Fuuz: query failed for "${modelName}".`); return; }
        const content =
          `// ${modelName} — ${result.records.length} record(s)\n` +
          `// fields: ${fields.join(', ')} | where: ${where || '{}'}\n` +
          JSON.stringify(result.records, null, 2);
        const doc = await vscode.workspace.openTextDocument({ language: 'json', content });
        await vscode.window.showTextDocument(doc, { preview: true });
      }
    );
  });

  register('fuuz.deployComponent', async () => {
    if (!vscode.workspace.getConfiguration('fuuz').get<boolean>('enableDeploy', false)) {
      const pick = await vscode.window.showWarningMessage(
        'Fuuz: deploys are disabled. They write to the tenant (data-model deploys can be destructive).',
        'Enable in Settings'
      );
      if (pick) await vscode.commands.executeCommand('workbench.action.openSettings', 'fuuz.enableDeploy');
      return;
    }
    const tenant = configManager.getActiveTenant();
    if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    const componentType = await vscode.window.showQuickPick(['screen', 'dataFlow', 'dataModel', 'savedTransform'], {
      title: 'Deploy — component type', ignoreFocusOut: true,
    });
    if (!componentType) return;
    const versionId = await pickVersionId(resourceService, tenant, componentType);
    if (!versionId) return;

    const warn = componentType === 'dataModel'
      ? 'Data model deploys are ASYNCHRONOUS and can be DESTRUCTIVE (they can alter existing records).'
      : 'This deploys a new version to the active tenant.';
    const confirm = await vscode.window.showWarningMessage(
      `Deploy ${componentType} version "${versionId}" to ${tenant.name}?\n\n${warn}`,
      { modal: true },
      'Deploy'
    );
    if (confirm !== 'Deploy') return;

    let forceStop = false;
    if (componentType === 'dataFlow') {
      const fs = await vscode.window.showQuickPick(['No', 'Yes'], { title: 'Force-stop previously deployed versions of this data flow?', ignoreFocusOut: true });
      forceStop = fs === 'Yes';
    }

    await withCancellable(`Fuuz: deploying ${componentType}…`, async signal => {
        const out = await resourceService.deployComponent(tenant, componentType, versionId.trim(), { forceStopPreviousVersions: forceStop }, signal);
        const content = `// deploy ${componentType} version ${versionId}\n${out || '(no response)'}`;
        const doc = await vscode.workspace.openTextDocument({ language: 'json', content });
        await vscode.window.showTextDocument(doc, { preview: true });
        vscode.window.showInformationMessage(`Fuuz: deploy requested for ${componentType}. ${componentType === 'dataModel' ? 'Data-model deploys run asynchronously — check status in Fuuz.' : ''}`);
    });
  });

  register('fuuz.openInFuuz', async () => {
    const enterprise = configManager.getActiveEnterprise();
    if (!enterprise) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    // The app host is the environment slug (aud/iss host), e.g. build.mfgx.fuuz.app.
    const env = enterprise.environment?.trim();
    const host = env ? `https://${env}.fuuz.app` : enterprise.mcpEndpoint.replace(/\/$/, '').replace(/^https?:\/\/api\./, 'https://');
    await vscode.env.openExternal(vscode.Uri.parse(host));
  });

  // ERD commands (single model / module / whole application) live in their own
  // registrar to keep this function focused — mirrors registerRuntimeCommands.
  registerErdCommands(context, configManager, resourceService);

  register('fuuz.createTool', async () => {
    const enterprise = configManager.getActiveEnterprise();
    const tenant = configManager.getActiveTenant();
    if (!enterprise || !tenant) {
      const pick = await vscode.window.showWarningMessage('Select an active Fuuz tenant first.', 'Select Tenant');
      if (pick) await vscode.commands.executeCommand('fuuz.selectTenant');
      return;
    }
    const snapshot = configManager.getCachedResources(tenant.id);
    const serverName = snapshot?.mcp?.serverName || `Fuuz: ${enterprise.name} / ${tenant.name}`;
    const prompt = buildCreateToolPrompt(enterprise.name, tenant.name, enterprise.environment, serverName);

    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt, mode: 'agent' });
    } catch {
      try {
        await vscode.commands.executeCommand('workbench.action.chat.open', prompt);
      } catch {
        await vscode.env.clipboard.writeText(prompt);
        vscode.window.showInformationMessage('Fuuz: copied a "build a new tool" prompt to the clipboard — paste it into Copilot Chat (agent mode).');
      }
    }
  });
}

/** Component type → the data model that holds its deployable versions. */
const VERSION_MODELS: Record<string, string> = {
  screen: 'ScreenVersion',
  dataFlow: 'DataFlowVersion',
  dataModel: 'DataModelVersion',
  savedTransform: 'SavedTransformVersion',
};

/**
 * Resolve a version id to deploy: offer a quick-pick of the component's recent
 * versions (queried from its `*Version` model), with a manual-entry fallback.
 * Degrades gracefully to a plain input box if the lookup finds nothing or fails
 * (e.g. the model name/fields differ for this tenant).
 */
async function pickVersionId(
  resourceService: TenantDataService,
  tenant: import('./types').Tenant,
  componentType: string
): Promise<string | undefined> {
  const model = VERSION_MODELS[componentType];
  let items: vscode.QuickPickItem[] = [];
  if (model) {
    const res = await resourceService.queryModel(tenant, model, ['id', 'name'], '{}', 'application').catch(() => null);
    items = (res?.records ?? [])
      .map(r => (r.name ? { label: r.name, description: r.id } : { label: r.id }))
      .filter(i => i.label);
  }

  const MANUAL = '$(edit) Enter a version id manually…';
  if (items.length) {
    const pick = await vscode.window.showQuickPick([...items, { label: MANUAL }], {
      title: `Deploy ${componentType} — choose a version`,
      placeHolder: 'Select a version, or enter an id manually',
      matchOnDescription: true,
      ignoreFocusOut: true,
    });
    if (!pick) return undefined;
    if (pick.label !== MANUAL) return (pick.description || pick.label).trim() || undefined;
  }

  const manual = await vscode.window.showInputBox({
    title: `Deploy ${componentType}`,
    prompt: 'Version id to deploy (look it up via Query Data Model)',
    ignoreFocusOut: true,
    validateInput: v => (v.trim() ? undefined : 'A version id is required'),
  });
  return manual?.trim() || undefined;
}

/** Register the ERD diagram commands (single model, module, whole application). */
function registerErdCommands(
  context: vscode.ExtensionContext,
  configManager: TenantConfigurationManager,
  resourceService: TenantDataService
) {
  const register = (id: string, fn: (...args: any[]) => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  register('fuuz.showErd', async (arg?: unknown) => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) {
      vscode.window.showWarningMessage('Select an active Fuuz tenant first.');
      return;
    }
    const node = nodeArg(arg);
    let modelName: string | undefined = node?.name || (typeof arg === 'string' ? arg : undefined);
    if (!modelName) {
      modelName = await vscode.window.showInputBox({
        title: 'Show ERD',
        prompt: 'Data model name (e.g. Area)',
        ignoreFocusOut: true,
        validateInput: v => (v.trim() ? undefined : 'A model name is required'),
      });
    }
    if (!modelName) return;

    const service: ErdService = node?.service ?? 'application';
    await withCancellable(`Fuuz: building ERD for ${modelName}…`, async signal => {
      const [graph, refs] = await Promise.all([
        resourceService.getModelGraph(tenant, modelName!.trim(), service, signal),
        resourceService.getReferences(tenant, service, signal),
      ]);
      if (!graph) {
        vscode.window.showWarningMessage(`Fuuz: couldn't load model "${modelName}".`);
        return;
      }
      ErdPanel.show(context, {
        title: graph.name,
        graph: buildModelGraph(graph, refs, service),
        layoutKey: `${tenant.id}:model:${graph.name}`,
        ...erdLoaders(resourceService, tenant),
      });
    });
  });

  // ERD for a whole module (the data models within it).
  register('fuuz.showModuleErd', async (arg?: unknown) => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    const node = nodeArg(arg);
    const models: string[] = (node?.dataModels ?? []).map(d => d.name).filter((n): n is string => !!n);
    const moduleName: string = node?.name ?? 'Module';
    if (models.length === 0) { vscode.window.showInformationMessage(`Fuuz: "${moduleName}" has no data models.`); return; }
    await withCancellable(`Fuuz: building ERD for ${moduleName}…`, async signal => {
      const refs = await resourceService.getReferences(tenant, 'application', signal);
      ErdPanel.show(context, {
        title: moduleName,
        graph: buildSetGraph(models, refs, 'application'),
        layoutKey: `${tenant.id}:module:${moduleName}`,
        ...erdLoaders(resourceService, tenant),
      });
    });
  });

  // ERD for the whole application (all app data models; relationships among them).
  register('fuuz.showAppErd', async () => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    await withCancellable('Fuuz: building application ERD…', async signal => {
      const resources = await resourceService.getTenantResources(tenant);
      const models: string[] = [];
      for (const mg of resources?.mcp?.application ?? []) {
        for (const m of mg.modules ?? []) {
          for (const dm of m.dataModels ?? []) if (dm.name) models.push(dm.name);
        }
      }
      if (models.length === 0) { vscode.window.showInformationMessage('Fuuz: no application data models to diagram.'); return; }
      const refs = await resourceService.getReferences(tenant, 'application', signal);
      ErdPanel.show(context, {
        title: `${tenant.name} — Application`,
        graph: buildSetGraph(models, refs, 'application'),
        layoutKey: `${tenant.id}:app`,
        ...erdLoaders(resourceService, tenant),
      });
    });
  });
}

/** Prompt that kicks off a guided, agentic data-flow build via the Fuuz MCP server. */
function buildCreateToolPrompt(enterpriseName: string, tenantName: string, environment: string | undefined, serverName: string): string {
  return [
    `I want to create a new Fuuz **tool**, which is implemented as a **data flow** in my Fuuz app and exposed to agents over MCP.`,
    ``,
    `Context:`,
    `- Enterprise: ${enterpriseName}${environment ? ` (environment \`${environment}\`)` : ''}`,
    `- Tenant: ${tenantName}`,
    `- The Fuuz MCP server "${serverName}" is connected in this workspace. Use its tools.`,
    ``,
    `Please walk me through building this tool step by step. Specifically:`,
    `1. Ask me what the tool should do, its inputs, and its outputs.`,
    `2. Use the Fuuz MCP tools to gather the context you need — e.g. \`system_list_models\` and \`system_query_model\` to find relevant data models, \`system_list_model_fields\` (and \`system_list_model_references\`) for schemas and relationships, and \`data_flow_data_flow_details\` / \`data_flow_dataflow_diagram_flow\` to learn from existing data flows.`,
    `2. Propose a data-flow design (nodes, inputs, transforms, outputs) and confirm it with me before making changes.`,
    `3. Create or update the data flow using \`system_data_flow_mutations\`, then summarize what was created and how to deploy/test it.`,
    ``,
    `Ask me clarifying questions first — don't make changes until I confirm the design.`,
  ].join('\n');
}

async function updateContextFlags(configManager: TenantConfigurationManager) {
  await vscode.commands.executeCommand('setContext', 'fuuz.hasConfig', configManager.hasEnterprises());
  await vscode.commands.executeCommand('setContext', 'fuuz.tenantSelected', configManager.getActiveTenant() !== null);
  await vscode.commands.executeCommand('setContext', 'fuuz.extensionReady', true);
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The argument the resource tree (and `findResource`) hand to ERD/query commands:
 * either a `ResourceItem` (whose `.node` holds the underlying record) or a
 * synthetic `{ node: { name, service } }`. Typed so commands stop reaching into
 * `any`.
 */
interface ResourceCommandArg {
  node?: {
    name?: string;
    service?: ErdService;
    id?: string;
    type?: string;
    dataModels?: Array<{ name?: string }>;
  };
}

/** Narrow an unknown command arg to the tree's node shape. */
function nodeArg(arg: unknown): ResourceCommandArg['node'] {
  return arg && typeof arg === 'object' ? (arg as ResourceCommandArg).node : undefined;
}

/**
 * Build the lazy `loadFields` / `loadNeighbors` callbacks every ERD command needs
 * (expand a node's fields; grow the graph by a model's neighbors). Centralized so
 * the three ERD commands don't each repeat the same two closures.
 */
function erdLoaders(resourceService: TenantDataService, tenant: import('./types').Tenant): {
  loadFields: (name: string, svc: ErdService) => Promise<import('./util/erdTypes').ErdField[]>;
  loadNeighbors: (name: string, svc: ErdService) => Promise<import('./util/erdTypes').ErdGraph>;
} {
  return {
    loadFields: async (name, svc) => (await resourceService.getModelGraph(tenant, name, svc))?.fields ?? [],
    loadNeighbors: async (name, svc) => {
      const [g, r] = await Promise.all([
        resourceService.getModelGraph(tenant, name, svc),
        resourceService.getReferences(tenant, svc),
      ]);
      return g ? buildModelGraph(g, r, svc) : { nodes: [], edges: [] };
    },
  };
}

/**
 * Run work inside a cancellable progress notification, exposing an AbortSignal
 * wired to the cancel button. Returns the work's result, or `undefined` when the
 * user cancels (callers treat that as a quiet no-op).
 */
function withCancellable<T>(title: string, fn: (signal: AbortSignal) => Promise<T>): Thenable<T | undefined> {
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title, cancellable: true },
    async (_progress, token) => {
      const controller = new AbortController();
      token.onCancellationRequested(() => controller.abort());
      try {
        return await fn(controller.signal);
      } catch (err) {
        if (isAbortError(err)) {
          fuuzLog(`${title} — cancelled`);
          return undefined;
        }
        throw err;
      }
    }
  );
}

/** One-line per-endpoint availability summary, e.g. "MCP ✓ · Flow ✗ · Webhook ✗". */
function summarizeProbes(probes: EndpointProbe[]): string {
  return probes.map(p => `${p.label} ${p.state === 'available' ? '✓' : '✗'}`).join(' · ');
}

export function deactivate() {
  // Disposables are cleaned up via context.subscriptions.
}
