import * as vscode from 'vscode';
import { LmStudioClient } from './lmStudioClient';
import { LmStudioManager, OrchestrationRole } from './lmStudioManager';
import { TranscriptEntry, buildSeedPreamble, seedInput } from '../util/orchestratorTranscript';

interface PersistedContext {
  transcript: TranscriptEntry[];
  /** model id → its latest LM Studio stateful-chat response id. */
  responseIds: Record<string, string>;
}

const STATE_KEY = 'fuuz.orchestrator.context';

export interface OrchestratorSendResult {
  role: OrchestrationRole;
  model: string;
  text: string;
  /** True when the model had no prior thread and was seeded from the shared transcript. */
  seeded: boolean;
}

/**
 * Coordinates several LM Studio models as one conversation.
 *
 * The orchestrator holds the **canonical transcript** (the source of truth). Each
 * model keeps its own server-side stateful thread, tracked here as a per-model
 * `response_id` and used purely as a cache — LM Studio threads are bound to a
 * `model_instance_id` and can't be reused across models. So when a step is routed
 * to a model that has no thread yet, we seed it with a preamble built from the
 * shared transcript; thereafter that model continues via `previous_response_id`.
 */
export class OrchestratorContext {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly client: LmStudioClient,
    private readonly manager: LmStudioManager
  ) {}

  private state(): PersistedContext {
    return this.context.workspaceState.get<PersistedContext>(STATE_KEY, { transcript: [], responseIds: {} });
  }

  private async save(next: PersistedContext): Promise<void> {
    await this.context.workspaceState.update(STATE_KEY, next);
    this._onDidChange.fire();
  }

  transcript(): TranscriptEntry[] {
    return this.state().transcript;
  }

  /** Clear the shared conversation and every model's cached thread. */
  async reset(): Promise<void> {
    await this.save({ transcript: [], responseIds: {} });
  }

  /**
   * Route a message to the model assigned to `role`, sharing the orchestrator's
   * context. Continues the model's existing thread when possible; otherwise seeds
   * it from the shared transcript. Appends both turns to the shared transcript.
   */
  async send(role: OrchestrationRole, input: string, signal?: AbortSignal): Promise<OrchestratorSendResult> {
    const model = this.manager.modelForRole(role);
    if (!model) {
      throw new Error(`No LM Studio model is assigned to the "${role}" role. Assign one in Fuuz: Assign LM Studio Roles.`);
    }

    const s = this.state();
    const previousResponseId = s.responseIds[model];
    // A model with no thread yet gets seeded from the shared transcript.
    const seeded = !previousResponseId && s.transcript.length > 0;
    const preamble = seeded ? buildSeedPreamble(s.transcript) : '';
    const sentInput = seedInput(input, preamble);

    const result = await this.client.chat({ model, input: sentInput, previousResponseId, signal });

    const now = new Date().toISOString();
    const transcript: TranscriptEntry[] = [
      ...s.transcript,
      { role: 'user', content: input, at: now, model: role },
      { role: 'assistant', content: result.text, at: now, model },
    ];
    const responseIds = { ...s.responseIds };
    if (result.responseId) responseIds[model] = result.responseId;

    await this.save({ transcript, responseIds });
    return { role, model, text: result.text, seeded };
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
