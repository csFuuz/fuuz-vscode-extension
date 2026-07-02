import * as vscode from 'vscode';
import { LmStudioClient, LmStudioModel } from './lmStudioClient';

/** Orchestration roles a discovered model can be assigned to. */
export const ORCHESTRATION_ROLES = ['orchestrator', 'coder', 'reviewer', 'embeddings'] as const;
export type OrchestrationRole = (typeof ORCHESTRATION_ROLES)[number];

export const ROLE_LABELS: Record<OrchestrationRole, string> = {
  orchestrator: 'Orchestrator',
  coder: 'Coder',
  reviewer: 'Reviewer',
  embeddings: 'Embeddings',
};

interface StoredState {
  /** Last-discovered models (cached so the UI needn't re-query on every render). */
  models: LmStudioModel[];
  /** role → model id. */
  roles: Partial<Record<OrchestrationRole, string>>;
  discoveredAt?: string;
}

const STATE_KEY = 'fuuz.lmStudio.state';

/**
 * Owns the LM Studio integration state: the discovered model catalogue and the
 * role→model assignments. Discovery is explicit (the user connects LM Studio and
 * refreshes); assignments drive {@link OrchestratorContext} routing.
 */
export class LmStudioManager {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly client: LmStudioClient
  ) {}

  private state(): StoredState {
    return this.context.globalState.get<StoredState>(STATE_KEY, { models: [], roles: {} });
  }

  private async save(next: StoredState): Promise<void> {
    await this.context.globalState.update(STATE_KEY, next);
    this._onDidChange.fire();
  }

  models(): LmStudioModel[] {
    return this.state().models;
  }

  roleAssignments(): Partial<Record<OrchestrationRole, string>> {
    return this.state().roles;
  }

  discoveredAt(): string | undefined {
    return this.state().discoveredAt;
  }

  modelForRole(role: OrchestrationRole): string | undefined {
    return this.state().roles[role];
  }

  /** Query the LM Studio server and cache the installed models. */
  async discover(): Promise<LmStudioModel[]> {
    const models = await this.client.listModels();
    const prev = this.state();
    // Drop role assignments whose model no longer exists.
    const ids = new Set(models.map(m => m.id));
    const roles: StoredState['roles'] = {};
    for (const [role, id] of Object.entries(prev.roles)) {
      if (id && ids.has(id)) roles[role as OrchestrationRole] = id;
    }
    await this.save({ models, roles, discoveredAt: new Date().toISOString() });
    return models;
  }

  /** Assign (or clear, with undefined) the model used for a role. */
  async assignRole(role: OrchestrationRole, modelId: string | undefined): Promise<void> {
    const s = this.state();
    const roles = { ...s.roles };
    if (modelId) roles[role] = modelId;
    else delete roles[role];
    await this.save({ ...s, roles });
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
