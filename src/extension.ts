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
import { ResourceContentProvider, FUUZ_SCHEME, resourceContentUri } from './ui/resourceContentProvider';
import { buildModelGraph, buildSetGraph } from './util/fuuzParse';
import type { ErdService } from './util/erdTypes';
import { fuuzLog } from './services/logger';
import { isAbortError } from './util/abort';
import { runCompliance } from './qa/complianceChecker';
import { runFlowGraphCompliance, analyzeFlowsCrossCutting } from './qa/flowAnalysis';
import { adaptFlow, FLOW_ELEMENT_FIELDS } from './qa/flowDescriptor';
import type { FlowGraph, FlowAnalysisContext, FlowVersionInfo } from './qa/flowTypes';
import { buildModelIndex, buildSavedTransformIndex } from './qa/modelContext';
import { decodeTronPayload } from './util/tron';
import { runScreenCompliance } from './qa/screenAnalysis';
import { buildScreenModel } from './qa/screenDescriptor';
import { runTenantAudit } from './qa/tenantAudit';
import { scaffoldFor } from './qa/scaffolds';
import { parseOutline, kindFromFileName, OutlineParseError } from './qa/outline';
import { ReportPanel } from './qa/reportPanel';
import { buildQaPlan, planToBrief } from './qa/planGenerator';
import { deriveTarget } from './qa/qaTarget';
import type { Persona, RunScope } from './qa/runTypes';
import { collectFuuzLogs, type LogQueryFn, type CollectedLog } from './qa/logCollector';
import { QaRunsProvider, QaItem, activeTenantQaDir } from './qa/qaRunsProvider';
import { buildHeadedDriver } from './qa/driver';
import { QaResultPanel } from './qa/qaResultPanel';
import type { ArtifactKind, ComplianceReport, DataModelDescriptor } from './qa/complianceTypes';

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

    // QA runs view + its commands (list runs, refresh, collect Fuuz logs for a run).
    const qaRunsProvider = new QaRunsProvider(configManager);
    context.subscriptions.push(
      vscode.window.createTreeView('fuuzQaRuns', { treeDataProvider: qaRunsProvider }),
      vscode.commands.registerCommand('fuuz.refreshQaRuns', () => qaRunsProvider.refresh()),
      vscode.commands.registerCommand('fuuz.collectQaLogs', (arg?: unknown) =>
        collectQaLogs(configManager, resourceService, qaRunsProvider, arg)
      ),
      vscode.commands.registerCommand('fuuz.runQaInBrowser', (arg?: unknown) =>
        runQaInBrowser(configManager, tokenStore, arg)
      ),
      vscode.commands.registerCommand('fuuz.deleteQaRun', (arg?: unknown) =>
        deleteQaRun(configManager, qaRunsProvider, arg)
      ),
      vscode.commands.registerCommand('fuuz.openQaResult', (arg?: unknown) =>
        openQaResult(context, configManager, arg)
      )
    );

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
      qaRunsProvider.refresh();
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

      // Warn if a project .mcp.json shadows the working user-scoped Fuuz servers
      // (env-var token refs that fail in Claude unless exported → /mcp auth errors).
      void (async () => {
        const shadows = await claudeMcpWriter.projectShadowedServers().catch(() => []);
        if (shadows.length === 0) return;
        const FIX = 'Remove from .mcp.json';
        const choice = await vscode.window.showWarningMessage(
          `Fuuz: your project .mcp.json defines ${shadows.length} Fuuz server(s) with env-var tokens that override the working user-scoped ones — Claude will fail to authenticate them unless you export those vars. Remove them so Claude uses the embedded servers?`,
          FIX, 'Keep'
        );
        if (choice === FIX) await vscode.commands.executeCommand('fuuz.fixClaudeMcpConflicts');
      })();

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

  // Remove project-scope .mcp.json fuuz servers that shadow the working
  // embedded user-scope servers (the cause of Claude /mcp auth errors).
  register('fuuz.fixClaudeMcpConflicts', async () => {
    const shadows = await claudeMcpWriter.projectShadowedServers();
    if (shadows.length === 0) {
      vscode.window.showInformationMessage('Fuuz: no conflicting project .mcp.json servers — Claude uses the working user-scoped Fuuz servers.');
      return;
    }
    const { removed, path: p } = await claudeMcpWriter.clearProjectFuuzServers();
    if (removed.length) {
      vscode.window.showInformationMessage(
        `Fuuz: removed ${removed.length} shadowing Fuuz server(s) from ${p}. Claude now uses the embedded user-scoped servers — restart Claude / run /mcp.`
      );
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

  // Schema Doctor: score an existing data model against learned platform
  // conventions, locally, before any push to Fuuz.
  register('fuuz.checkModelCompliance', async (arg?: unknown) => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    const node = nodeArg(arg);
    let modelName: string | undefined = node?.name || (typeof arg === 'string' ? arg : undefined);
    if (!modelName) {
      modelName = await vscode.window.showInputBox({
        title: 'Check Schema Compliance', prompt: 'Data model name (e.g. WorkOrder)', ignoreFocusOut: true,
        validateInput: v => (v.trim() ? undefined : 'A model name is required'),
      });
    }
    if (!modelName) return;
    const service: ErdService = node?.service ?? 'application';

    const model = modelName.trim();
    // Build a fresh report by sampling the model over MCP, then scoring locally.
    const buildReport = async (signal?: AbortSignal): Promise<ComplianceReport | undefined> => {
      const graph = await resourceService.getModelGraph(tenant, model, service, signal);
      if (!graph) return undefined;
      const descriptor: DataModelDescriptor = {
        kind: 'dataModel',
        name: graph.name,
        fields: graph.fields.map(f => ({ name: f.name, type: f.type })),
        relations: graph.relations.map(r => ({ field: r.field, target: r.target, many: r.many })),
      };
      return runCompliance(descriptor);
    };

    await withCancellable(`Fuuz: checking ${model}…`, async signal => {
      const report = await buildReport(signal);
      if (!report) { vscode.window.showWarningMessage(`Fuuz: couldn't load model "${model}".`); return; }
      ReportPanel.show(context, report, () => buildReport());
      const msg = `Fuuz: ${report.name} — ${report.score}% compliant (${report.passed}/${report.checks} checks).`;
      if (report.score >= 90) vscode.window.showInformationMessage(msg);
      else vscode.window.showWarningMessage(msg);
    });
  });

  // Schema Doctor: score a local outline file (scaffolded or hand-authored)
  // against the platform conventions BEFORE it is pushed to Fuuz.
  register('fuuz.checkOutlineCompliance', async (arg?: unknown) => {
    const uri = arg instanceof vscode.Uri ? arg : vscode.window.activeTextEditor?.document.uri;
    if (!uri) { vscode.window.showWarningMessage('Open a Fuuz outline file to check (e.g. *.model.jsonc).'); return; }
    const fileName = uri.path.split('/').pop() ?? '';
    const kind = kindFromFileName(fileName);
    if (!kind) {
      vscode.window.showWarningMessage('Not a recognized Fuuz outline. Expected *.model.jsonc, *.query.jsonc, *.flow.jsonc, *.screen.jsonc, or *.script.js.');
      return;
    }
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString('utf8');
      const descriptor = parseOutline(kind, text, fileName.replace(/\.[^.]+\.\w+$/, ''));
      const report = runCompliance(descriptor);
      ReportPanel.show(context, report);
      const msg = `Fuuz: ${report.name} — ${report.score}% compliant (${report.passed}/${report.checks} checks).`;
      if (report.score >= 90) vscode.window.showInformationMessage(msg);
      else vscode.window.showWarningMessage(msg);
    } catch (err) {
      if (err instanceof OutlineParseError) vscode.window.showErrorMessage(`Fuuz: ${err.message}`);
      else vscode.window.showErrorMessage(`Fuuz: couldn't check outline — ${errMsg(err)}`);
    }
  });

  // QA harness: generate a test brief for a screen/app and hand it to the agent.
  register('fuuz.qaScreen', async (arg?: unknown) => {
    const node = nodeArg(arg);
    const name = node?.name || (await vscode.window.showInputBox({ title: 'QA a Screen', prompt: 'Screen name', ignoreFocusOut: true }));
    if (!name) return;
    await startQaRun(configManager, tokenStore, { kind: 'screen', name });
  });

  register('fuuz.qaApp', async () => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    const snap = configManager.getCachedResources(tenant.id);
    const screens: string[] = [];
    for (const mg of snap?.mcp?.application ?? []) {
      for (const m of mg.modules ?? []) {
        for (const s of m.screens ?? []) if (s.name) screens.push(s.name);
      }
    }
    await startQaRun(configManager, tokenStore, { kind: 'app', name: tenant.name, screens });
  });

  // Flow compliance: analyze a real deployed flow's nodes over MCP.
  register('fuuz.checkFlowCompliance', async (arg?: unknown) => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    const node = nodeArg(arg);
    const flowId = node?.id;
    if (!flowId) { vscode.window.showWarningMessage('Run this on a flow node.'); return; }
    const flow = { id: flowId, name: node?.name ?? 'Flow', type: node?.type };

    await withCancellable(`Fuuz: analyzing ${flow.name}…`, async signal => {
      const cache: FlowFetchCache = {};
      const graph = await fetchFlowGraph(resourceService, tenant, flow, cache, signal);
      if (!graph) {
        vscode.window.showWarningMessage("Fuuz: couldn't read this flow's nodes over MCP (DataFlowElement). Confirm the tenant connection and try again.");
        return;
      }
      const ctx = await buildFlowContext(resourceService, tenant, signal);
      const report = runFlowGraphCompliance(graph, ctx);
      ReportPanel.show(context, report);
      const msg = `Fuuz: ${flow.name} — ${report.score}% (${report.passed}/${report.checks} checks, ${graph.nodes.length} nodes).`;
      if (report.score >= 90) vscode.window.showInformationMessage(msg);
      else vscode.window.showWarningMessage(msg);
    });
  });

  // Screen compliance: analyze a real screen's elements over MCP.
  register('fuuz.checkScreenCompliance', async (arg?: unknown) => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    const node = nodeArg(arg);
    const screenId = node?.id;
    if (!screenId) { vscode.window.showWarningMessage('Run this on a screen node.'); return; }
    const screen = { id: screenId, name: node?.name ?? 'Screen' };

    await withCancellable(`Fuuz: analyzing ${screen.name}…`, async signal => {
      const model = await fetchScreenModel(resourceService, tenant, screen, signal);
      if (!model) {
        vscode.window.showWarningMessage("Fuuz: couldn't read this screen's elements over MCP (ScreenElement). Confirm the tenant connection and try again.");
        return;
      }
      const report = runScreenCompliance(model);
      ReportPanel.show(context, report);
      const msg = `Fuuz: ${screen.name} — ${report.score}% (${report.passed}/${report.checks} checks, ${model.elements.length} elements).`;
      if (report.score >= 90) vscode.window.showInformationMessage(msg);
      else vscode.window.showWarningMessage(msg);
    });
  });

  // Flow compliance: cross-cutting analysis across all of the app's flows.
  register('fuuz.checkAllFlows', async () => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    const snap = configManager.getCachedResources(tenant.id);
    const flows: Array<{ id: string; name: string; type?: string }> = [];
    for (const mg of snap?.mcp?.application ?? []) {
      for (const m of mg.modules ?? []) {
        for (const f of m.flows ?? []) if (f.id) flows.push({ id: f.id, name: f.name, type: f.type });
      }
    }
    if (flows.length === 0) { vscode.window.showInformationMessage('Fuuz: no flows to analyze (sync the tenant first).'); return; }
    const MAX = 50;
    const slice = flows.slice(0, MAX);

    await withCancellable(`Fuuz: analyzing ${slice.length} flows…`, async signal => {
      const cache: FlowFetchCache = {};
      const graphs: FlowGraph[] = [];
      for (const f of slice) {
        if (signal?.aborted) return;
        const g = await fetchFlowGraph(resourceService, tenant, f, cache, signal, false).catch(() => null);
        if (g) graphs.push(g);
      }
      if (graphs.length === 0) { vscode.window.showWarningMessage("Fuuz: couldn't read flow nodes over MCP. Confirm the tenant connection."); return; }
      if (flows.length > MAX) fuuzLog(`checkAllFlows: analyzed first ${MAX} of ${flows.length} flows.`);
      const report = analyzeFlowsCrossCutting(graphs);
      ReportPanel.show(context, report);
      vscode.window.showInformationMessage(`Fuuz: analyzed ${graphs.length} flows for shared queries/scripts (${report.findings.length} suggestion(s)).`);
    });
  });

  // Audit the whole tenant: compliance on every model + flow → summary report.
  register('fuuz.checkTenant', async () => {
    const tenant = configManager.getActiveTenant();
    if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    const snap = configManager.getCachedResources(tenant.id);
    const models: string[] = [];
    const flows: Array<{ id: string; name: string; type?: string }> = [];
    const screens: Array<{ id: string; name: string }> = [];
    for (const mg of snap?.mcp?.application ?? []) {
      for (const m of mg.modules ?? []) {
        for (const dm of m.dataModels ?? []) if (dm.name) models.push(dm.name);
        for (const f of m.flows ?? []) if (f.id) flows.push({ id: f.id, name: f.name, type: f.type });
        for (const s of m.screens ?? []) if (s.id) screens.push({ id: s.id, name: s.name });
      }
    }
    if (models.length === 0 && flows.length === 0 && screens.length === 0) {
      vscode.window.showInformationMessage('Fuuz: nothing to audit (sync the tenant first).');
      return;
    }
    const MODEL_CAP = 150, FLOW_CAP = 100, SCREEN_CAP = 100;

    await withCancellable(`Fuuz: auditing ${tenant.name}…`, async signal => {
      const reports: ComplianceReport[] = [];
      const cache: FlowFetchCache = {};
      const flowGraphs: FlowGraph[] = [];
      const ctx = await buildFlowContext(resourceService, tenant, signal);

      for (const name of models.slice(0, MODEL_CAP)) {
        if (signal?.aborted) return;
        const graph = await resourceService.getModelGraph(tenant, name, 'application', signal).catch(() => null);
        if (!graph) continue;
        const descriptor: DataModelDescriptor = {
          kind: 'dataModel', name: graph.name,
          fields: graph.fields.map(f => ({ name: f.name, type: f.type })),
          relations: graph.relations.map(r => ({ field: r.field, target: r.target, many: r.many })),
        };
        reports.push(runCompliance(descriptor));
      }
      for (const f of flows.slice(0, FLOW_CAP)) {
        if (signal?.aborted) return;
        const g = await fetchFlowGraph(resourceService, tenant, f, cache, signal, false).catch(() => null);
        if (g) { flowGraphs.push(g); reports.push(runFlowGraphCompliance(g, ctx)); }
      }
      for (const s of screens.slice(0, SCREEN_CAP)) {
        if (signal?.aborted) return;
        const m = await fetchScreenModel(resourceService, tenant, s, signal).catch(() => null);
        if (m) reports.push(runScreenCompliance(m));
      }
      if (flowGraphs.length > 1) reports.push(analyzeFlowsCrossCutting(flowGraphs));

      if (reports.length === 0) { vscode.window.showWarningMessage('Fuuz: audit produced no results (check the tenant connection).'); return; }
      const audit = runTenantAudit(tenant.name, reports);
      ReportPanel.show(context, audit);
      if (models.length > MODEL_CAP || flows.length > FLOW_CAP || screens.length > SCREEN_CAP) {
        fuuzLog(`tenant audit: capped at ${MODEL_CAP} models / ${FLOW_CAP} flows / ${SCREEN_CAP} screens (tenant has ${models.length}/${flows.length}/${screens.length}).`);
      }
      const msg = `Fuuz: ${tenant.name} — ${audit.score}% across ${reports.length} artifact(s).`;
      if (audit.score >= 90) vscode.window.showInformationMessage(msg);
      else vscode.window.showWarningMessage(msg);
    });
  });

  // Schema Doctor: write a convention-compliant outline for a new artifact.
  register('fuuz.scaffoldArtifact', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { vscode.window.showWarningMessage('Open a folder to scaffold into.'); return; }
    const kinds: Array<vscode.QuickPickItem & { artifactKind: ArtifactKind }> = [
      { label: 'Data Model', artifactKind: 'dataModel' },
      { label: 'Screen', artifactKind: 'screen' },
      { label: 'Flow', artifactKind: 'flow' },
      { label: 'Script', artifactKind: 'script' },
      { label: 'Query', artifactKind: 'query' },
    ];
    const pick = await vscode.window.showQuickPick(kinds, { title: 'Scaffold a compliant Fuuz artifact', placeHolder: 'Artifact kind' });
    if (!pick) return;
    const name = await vscode.window.showInputBox({
      title: `Scaffold ${pick.label}`, prompt: 'Name (PascalCase for models, e.g. WorkOrder)', ignoreFocusOut: true,
      validateInput: v => (v.trim() ? undefined : 'A name is required'),
    });
    if (!name) return;
    const scaffold = scaffoldFor(pick.artifactKind, name.trim());
    const dir = vscode.Uri.joinPath(folder.uri, '.fuuz', 'scaffolds');
    await vscode.workspace.fs.createDirectory(dir);
    const file = vscode.Uri.joinPath(dir, scaffold.fileName);
    await vscode.workspace.fs.writeFile(file, Buffer.from(scaffold.content, 'utf8'));
    const doc = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(`Fuuz: scaffolded ${pick.label} → ${scaffold.fileName}. Fill it in, then check compliance before pushing.`);
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

  // Read-only viewer for saved scripts/queries: open the real content from the tree.
  const contentProvider = new ResourceContentProvider(configManager, resourceService);
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(FUUZ_SCHEME, contentProvider));
  register('fuuz.openResourceContent', async (arg?: unknown) => {
    if (!configManager.getActiveTenant()) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
    const contextValue = (arg as { contextValue?: string })?.contextValue ?? '';
    const data = nodeArg(arg);
    const target = resourceContentUri(contextValue, data);
    if (!target) { vscode.window.showWarningMessage('Fuuz: open this on a saved Script or Query.'); return; }
    try {
      const doc = await vscode.workspace.openTextDocument(target.uri);
      try { await vscode.languages.setTextDocumentLanguage(doc, target.langId); } catch { /* grammar not installed — leave default */ }
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch (err) {
      vscode.window.showWarningMessage(`Fuuz: couldn't open content — ${errMsg(err)}`);
    }
  });

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

/**
 * Build a QA brief for a scope, write the plan + brief under `.fuuz/qa/<run>/`,
 * and hand the brief to the agent chat (the Claude-for-Chrome path). Personas
 * are dev-supplied and logged in manually; destructive steps are hard-gated on a
 * test environment. (Headless Playwright driver + MCP log collection: next slice.)
 */
async function startQaRun(
  configManager: TenantConfigurationManager,
  tokenStore: TokenStore,
  scope: RunScope
): Promise<void> {
  const enterprise = configManager.getActiveEnterprise();
  if (!enterprise) {
    const pick = await vscode.window.showWarningMessage('Select an active Fuuz tenant first.', 'Select Tenant');
    if (pick) await vscode.commands.executeCommand('fuuz.selectTenant');
    return;
  }
  const target = deriveTarget(enterprise.environment ?? '');

  const personaRaw = await vscode.window.showInputBox({
    title: `QA ${scope.name} — personas`,
    prompt: 'Comma-separated personas you will log in as (e.g. Operator, Supervisor)',
    placeHolder: 'Operator, Supervisor',
    ignoreFocusOut: true,
    validateInput: v => (v.trim() ? undefined : 'Enter at least one persona'),
  });
  if (!personaRaw) return;
  const personas: Persona[] = personaRaw.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name }));

  // Authority: full autonomy (no per-action prompts) vs supervised/manual.
  const authPick = await vscode.window.showQuickPick(
    [
      { label: '$(rocket) Autonomous — full authority', detail: 'Claude proceeds without asking after each persona logs in (recommended).', value: 'autonomous' as const },
      { label: '$(person) Manual — supervised', detail: 'Claude pauses to confirm before each major step.', value: 'manual' as const },
    ],
    { title: 'How should Claude run this QA?', placeHolder: 'Autonomous runs end-to-end; you only log each persona in', ignoreFocusOut: true }
  );
  if (!authPick) return;
  const authority = authPick.value;

  // Destructive steps are only ever offered on a test-looking environment.
  let destructiveAllowed = false;
  if (target.isTestEnv) {
    const d = await vscode.window.showQuickPick(['No — navigate & read only', 'Yes — allow create/update/delete + injection probes'], {
      title: `Enable destructive steps on ${target.envSlug}?`, ignoreFocusOut: true,
    });
    if (d === undefined) return;
    destructiveAllowed = d.startsWith('Yes');
  } else {
    await vscode.window.showWarningMessage(
      `Fuuz: "${target.envSlug || 'this environment'}" doesn't look like a test environment — destructive steps are disabled for safety.`
    );
  }

  // The Claude Code run needs a run directory on disk (config + artifacts),
  // scoped to the active tenant so the QA Runs view can filter by tenant.
  const tenantDir = activeTenantQaDir(configManager);
  if (!tenantDir) {
    vscode.window.showWarningMessage('Fuuz: open a folder and select an active tenant to run QA with Claude Code.');
    return;
  }
  const runId = `qa-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
  const dir = vscode.Uri.joinPath(tenantDir, runId);
  const runRel = vscode.workspace.asRelativePath(dir, false);
  const plan = buildQaPlan({ runId, createdAt: new Date().toISOString(), scope, target, personas, destructiveAllowed, authority, runDir: runRel });
  const brief = planToBrief(plan);

  await vscode.workspace.fs.createDirectory(dir);
  await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(dir, 'plan.json'), Buffer.from(JSON.stringify(plan, null, 2), 'utf8'));
  const briefUri = vscode.Uri.joinPath(dir, 'brief.md');
  await vscode.workspace.fs.writeFile(briefUri, Buffer.from(brief, 'utf8'));
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(briefUri), { preview: false });
  await vscode.commands.executeCommand('fuuz.refreshQaRuns');

  // Launch the run in Claude Code (headed browser) — not VS Code Copilot.
  await launchClaudeQa(configManager, tokenStore, dir, plan.target.url);
}

/**
 * Write the Playwright (+ tenant Fuuz) MCP config for a run and launch a
 * supervised `claude` session in a terminal. The Fuuz token is passed via the
 * terminal env (referenced as `${FUUZ_QA_TOKEN}` in the config) so it is never
 * written to disk.
 */
async function launchClaudeQa(
  configManager: TenantConfigurationManager,
  tokenStore: TokenStore,
  runDir: vscode.Uri,
  targetUrl: string
): Promise<void> {
  const enterprise = configManager.getActiveEnterprise();
  const tenant = configManager.getActiveTenant();
  let fuuz: { url: string; tenantId: string; tokenEnvVar: string } | undefined;
  let token: string | undefined;
  if (enterprise && tenant) {
    token = await tokenStore.getToken(enterprise.id, tenant.id);
    if (token) fuuz = { url: configManager.getMcpServerUrl(enterprise), tenantId: tenant.id, tokenEnvVar: 'FUUZ_QA_TOKEN' };
  }

  // Launch from the (already-trusted) workspace root so Claude doesn't prompt to
  // trust each new per-run directory; point everything at the run subfolder.
  const workspace = vscode.workspace.workspaceFolders?.[0];
  const runRel = workspace ? vscode.workspace.asRelativePath(runDir, false) : runDir.fsPath;

  // Authority comes from the run's plan (default: manual/supervised).
  let autonomous = false;
  try {
    const planBuf = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(runDir, 'plan.json'));
    autonomous = JSON.parse(Buffer.from(planBuf).toString('utf8'))?.authority === 'autonomous';
  } catch { /* default manual */ }

  const launch = buildHeadedDriver({
    runDirFsPath: runDir.fsPath,
    briefPath: `${runRel}/brief.md`,
    mcpConfigPath: `${runRel}/mcp.qa.json`,
    artifactsPath: `${runRel}/artifacts`,
    targetUrl,
    fuuz,
    autonomous,
  });
  await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(runDir, 'mcp.qa.json'), Buffer.from(JSON.stringify(launch.mcpConfig, null, 2), 'utf8'));

  const env: Record<string, string> = {};
  if (token) env.FUUZ_QA_TOKEN = token;
  const term = vscode.window.createTerminal({
    name: `Fuuz QA — ${runDir.path.split('/').pop()}`,
    cwd: workspace ? workspace.uri : runDir,
    env,
  });
  term.show();
  term.sendText(launch.shellCommand, true);
  vscode.window.showInformationMessage(
    `Fuuz: launching Claude Code with a headed browser against ${targetUrl}. Log in each persona when prompted; artifacts → ${runRel}/artifacts.`
  );
}

/**
 * Collect Fuuz-side logs over MCP (developer connection) for a run's window and
 * write them to `<run>/logs.json`. Correlation is by time: the plan's createdAt
 * to now. Each log source degrades independently.
 */
async function collectQaLogs(
  configManager: TenantConfigurationManager,
  resourceService: TenantDataService,
  provider: QaRunsProvider,
  arg?: unknown
): Promise<void> {
  const tenant = configManager.getActiveTenant();
  if (!tenant) { vscode.window.showWarningMessage('Select an active Fuuz tenant first.'); return; }
  const qaDir = activeTenantQaDir(configManager);
  if (!qaDir) { vscode.window.showWarningMessage('Open a folder and select an active tenant.'); return; }

  let runDir: vscode.Uri | undefined = arg instanceof QaItem ? arg.resourceUri : undefined;
  if (!runDir) {
    const dirs = (await vscode.workspace.fs.readDirectory(qaDir).then(e => e, () => []))
      .filter(([, t]) => t === vscode.FileType.Directory).map(([n]) => n).sort().reverse();
    if (dirs.length === 0) { vscode.window.showWarningMessage('No QA runs found. Run "QA this Screen/App" first.'); return; }
    const pick = await vscode.window.showQuickPick(dirs, { title: 'Collect logs for which run?' });
    if (!pick) return;
    runDir = vscode.Uri.joinPath(qaDir, pick);
  }

  // Window: from the run's start (plan.createdAt) to its end (result.json mtime if
  // the agent finished, else now) — capped to MAX_WINDOW so collecting days later
  // doesn't sweep in unrelated activity.
  const MAX_WINDOW_MS = 3 * 60 * 60 * 1000; // 3h
  let startMs = Date.now() - 60 * 60 * 1000;
  try {
    const planBuf = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(runDir, 'plan.json'));
    const created = JSON.parse(Buffer.from(planBuf).toString('utf8'))?.createdAt;
    const t = created ? Date.parse(created) : NaN;
    if (!Number.isNaN(t)) startMs = t;
  } catch { /* no plan.json — use the fallback window */ }
  let endMs = Date.now();
  try {
    const stat = await vscode.workspace.fs.stat(vscode.Uri.joinPath(runDir, 'result.json'));
    endMs = stat.mtime; // the run actually finished here
  } catch { /* no result yet — bound below */ }
  if (endMs - startMs > MAX_WINDOW_MS) endMs = startMs + MAX_WINDOW_MS;
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();

  const query: LogQueryFn = (model, fields, where) =>
    resourceService.queryModel(tenant, model, fields, where, 'application').then(r => r?.records ?? []);

  await withCancellable('Fuuz: collecting run logs…', async () => {
    const logs: CollectedLog[] = await collectFuuzLogs(query, { startIso, endIso }, (m, e) =>
      fuuzLog(`QA log source ${m} skipped: ${errMsg(e)}`)
    );
    await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(runDir!, 'logs.json'), Buffer.from(JSON.stringify(logs, null, 2), 'utf8'));
    provider.refresh();
    const errs = logs.filter(l => l.severity === 'error').length;
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(runDir!, 'logs.json'));
    await vscode.window.showTextDocument(doc, { preview: true });
    const msg = `Fuuz: collected ${logs.length} log entr${logs.length === 1 ? 'y' : 'ies'} (${errs} error${errs === 1 ? '' : 's'}) for the run window.`;
    if (errs > 0) vscode.window.showWarningMessage(msg);
    else vscode.window.showInformationMessage(msg);
  });
}

/** Delete a QA run directory (and all its artifacts) after confirmation. */
async function deleteQaRun(configManager: TenantConfigurationManager, provider: QaRunsProvider, arg?: unknown): Promise<void> {
  const qaDir = activeTenantQaDir(configManager);
  if (!qaDir) { vscode.window.showWarningMessage('Open a folder and select an active tenant.'); return; }

  let runDir: vscode.Uri | undefined = arg instanceof QaItem ? arg.resourceUri : undefined;
  if (!runDir) {
    const dirs = (await vscode.workspace.fs.readDirectory(qaDir).then(e => e, () => []))
      .filter(([, t]) => t === vscode.FileType.Directory).map(([n]) => n).sort().reverse();
    if (dirs.length === 0) { vscode.window.showWarningMessage('No QA runs to delete.'); return; }
    const pick = await vscode.window.showQuickPick(dirs, { title: 'Delete which QA run?' });
    if (!pick) return;
    runDir = vscode.Uri.joinPath(qaDir, pick);
  }

  const name = runDir.path.split('/').pop();
  const confirm = await vscode.window.showWarningMessage(
    `Delete QA run "${name}" and all its files (brief, plan, logs, artifacts)?`,
    { modal: true },
    'Delete'
  );
  if (confirm !== 'Delete') return;

  try {
    // Prefer the OS trash (recoverable); fall back to a hard delete if unsupported.
    await vscode.workspace.fs.delete(runDir, { recursive: true, useTrash: true });
  } catch {
    await vscode.workspace.fs.delete(runDir, { recursive: true });
  }
  provider.refresh();
  vscode.window.showInformationMessage(`Fuuz: deleted QA run "${name}".`);
}

/** Open the unified QA result view (agent result + collected Fuuz logs) for a run. */
async function openQaResult(context: vscode.ExtensionContext, configManager: TenantConfigurationManager, arg?: unknown): Promise<void> {
  const qaDir = activeTenantQaDir(configManager);
  if (!qaDir) { vscode.window.showWarningMessage('Open a folder and select an active tenant.'); return; }

  let runDir: vscode.Uri | undefined = arg instanceof QaItem ? arg.resourceUri : undefined;
  if (!runDir) {
    const dirs = (await vscode.workspace.fs.readDirectory(qaDir).then(e => e, () => []))
      .filter(([, t]) => t === vscode.FileType.Directory).map(([n]) => n).sort().reverse();
    if (dirs.length === 0) { vscode.window.showWarningMessage('No QA runs found. Run "QA this Screen/App" first.'); return; }
    const pick = await vscode.window.showQuickPick(dirs, { title: 'Open which QA result?' });
    if (!pick) return;
    runDir = vscode.Uri.joinPath(qaDir, pick);
  }
  await QaResultPanel.show(context, runDir);
}

/**
 * Launch a supervised headed-browser QA session: write the Playwright MCP config
 * into the run dir and run `claude --mcp-config …` in a terminal so Claude drives
 * the app while the developer logs each persona in manually.
 */
async function runQaInBrowser(configManager: TenantConfigurationManager, tokenStore: TokenStore, arg?: unknown): Promise<void> {
  const qaDir = activeTenantQaDir(configManager);
  if (!qaDir) { vscode.window.showWarningMessage('Open a folder and select an active tenant.'); return; }

  let runDir: vscode.Uri | undefined = arg instanceof QaItem ? arg.resourceUri : undefined;
  if (!runDir) {
    const dirs = (await vscode.workspace.fs.readDirectory(qaDir).then(e => e, () => []))
      .filter(([, t]) => t === vscode.FileType.Directory).map(([n]) => n).sort().reverse();
    if (dirs.length === 0) { vscode.window.showWarningMessage('No QA runs found. Run "QA this Screen/App" first.'); return; }
    const pick = await vscode.window.showQuickPick(dirs, { title: 'Run which QA brief in the browser?' });
    if (!pick) return;
    runDir = vscode.Uri.joinPath(qaDir, pick);
  }

  // Target URL from the plan, falling back to the active enterprise's env.
  let targetUrl = '';
  try {
    const planBuf = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(runDir, 'plan.json'));
    targetUrl = JSON.parse(Buffer.from(planBuf).toString('utf8'))?.target?.url ?? '';
  } catch { /* fall back below */ }
  if (!targetUrl) targetUrl = deriveTarget(configManager.getActiveEnterprise()?.environment ?? '').url;
  if (!targetUrl) { vscode.window.showWarningMessage('Fuuz: no target URL — set the enterprise environment first.'); return; }

  await launchClaudeQa(configManager, tokenStore, runDir, targetUrl);
}

/** Per-analysis cache: the cross-referenced tenant context, built once. */
interface FlowFetchCache {
  context?: FlowAnalysisContext;
}

/**
 * Build the tenant facts the flow analyzers cross-reference — a data-model index
 * (type + estimated record count) and a saved-transform index (input-schema
 * presence). Uses ONLY the platform `system_query_model` tool (never user-built
 * `data_flow_*` flows, which can be incomplete/unreliable). Degrades to an empty
 * context on failure so analysis still runs (with weaker heuristics).
 */
async function buildFlowContext(
  resourceService: TenantDataService,
  tenant: import('./types').Tenant,
  signal?: AbortSignal
): Promise<FlowAnalysisContext> {
  const ctx: FlowAnalysisContext = {};
  try {
    const res = await resourceService.queryModel(tenant, 'DataModel', ['id', 'name', 'dataModelTypeId', 'estimatedRecordCount'], '{}', 'application', signal);
    if (res?.raw) ctx.models = buildModelIndex(decodeTronPayload(res.raw));
  } catch { /* no model index — query-scoping rule degrades to a generic warning */ }
  try {
    const res = await resourceService.queryModel(tenant, 'SavedTransform', ['id', 'name', 'inputSchema', 'deprecated'], '{}', 'application', signal);
    if (res?.raw) ctx.savedTransforms = buildSavedTransformIndex(decodeTronPayload(res.raw));
  } catch { /* no saved-transform index — payload-contract rule degrades to info */ }
  return ctx;
}

/** Best-effort fetch of a flow's version history (for the release-notes check). */
async function fetchFlowVersions(
  resourceService: TenantDataService,
  tenant: import('./types').Tenant,
  flowId: string,
  signal?: AbortSignal
): Promise<FlowVersionInfo[] | undefined> {
  try {
    const res = await resourceService.queryModel(
      tenant, 'DataFlow',
      ['id', 'versions.edges.node.number', 'versions.edges.node.description', 'versions.edges.node.deployed'],
      JSON.stringify({ id: { _eq: flowId } }), 'application', signal,
    );
    if (!res?.raw) return undefined;
    const rows = decodeTronPayload(res.raw);
    const edges = (rows[0] as any)?.versions?.edges;
    if (!Array.isArray(edges)) return undefined;
    return edges.map((e: any) => ({ number: e?.node?.number, description: e?.node?.description, deployed: e?.node?.deployed === true || e?.node?.deployed === 'true' }));
  } catch {
    return undefined;
  }
}

/**
 * Read a flow's nodes (`DataFlowElement`) over the platform `system_query_model`
 * tool and adapt them to a FlowGraph. `DataFlowElement` is a stable system model,
 * so the field set is fixed; nested `configuration` is decoded into real objects.
 * Returns null when the nodes can't be read.
 */
async function fetchFlowGraph(
  resourceService: TenantDataService,
  tenant: import('./types').Tenant,
  flow: { id: string; name: string; type?: string },
  _cache: FlowFetchCache,
  signal?: AbortSignal,
  withVersions = true
): Promise<FlowGraph | null> {
  const where = JSON.stringify({ dataFlowId: { _eq: flow.id } });
  const res = await resourceService.queryModel(tenant, 'DataFlowElement', FLOW_ELEMENT_FIELDS, where, 'application', signal).catch(() => null);
  if (!res?.raw) return null;
  const rows = decodeTronPayload(res.raw);
  if (rows.length === 0) return null;
  const versions = withVersions ? await fetchFlowVersions(resourceService, tenant, flow.id, signal) : undefined;
  return adaptFlow({ id: flow.id, name: flow.name, type: flow.type, versions }, rows);
}

/**
 * Read a screen's elements (`ScreenElement`) over `system_query_model` and adapt
 * them to a ScreenModel for compliance analysis. System-tools only.
 */
async function fetchScreenModel(
  resourceService: TenantDataService,
  tenant: import('./types').Tenant,
  screen: { id: string; name: string },
  signal?: AbortSignal
) {
  const where = JSON.stringify({ screenId: { _eq: screen.id } });
  const res = await resourceService.queryModel(tenant, 'ScreenElement', ['id', 'name', 'type', 'componentName', 'label', 'configuration'], where, 'application', signal).catch(() => null);
  if (!res?.raw) return null;
  const rows = decodeTronPayload(res.raw);
  if (rows.length === 0) return null;
  return buildScreenModel(screen.name, rows);
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
    `2. Use the Fuuz MCP tools to gather the context you need. **Prefer the platform \`system_*\` tools** — \`system_list_models\` and \`system_query_model\` to find relevant data models and to read existing flows/screens (query \`DataFlow\`, \`DataFlowElement\`, \`Screen\`, \`ScreenElement\`), and \`system_list_model_fields\` / \`system_list_model_references\` for schemas and relationships. The \`data_flow_*\` tools are themselves user-built flows and may be unreliable or incomplete — don't depend on them.`,
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
