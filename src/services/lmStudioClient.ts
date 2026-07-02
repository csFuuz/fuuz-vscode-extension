import * as vscode from 'vscode';

/**
 * Thin client for a local LM Studio server's REST API.
 *
 * Two endpoints are used:
 * - `GET /api/v0/models` — the native model listing, richer than the OpenAI-
 *   compatible `/v1/models`: it reports each model's load `state`, `type`
 *   (llm/vlm/embeddings), context length and quantization. Used to auto-discover
 *   what's installed so the user doesn't hand-enter model names.
 * - `POST /api/v1/chat` — the **stateful** chat endpoint. It stores the thread
 *   server-side and returns a `response_id`; a follow-up passes
 *   `previous_response_id` to continue without resending history. State is bound
 *   to a `model_instance_id` (a specific loaded model), so a thread is a per-model
 *   cache — it is not reused across different models (see {@link OrchestratorContext}).
 *
 * Base URL and optional bearer token come from settings (`fuuz.lmStudio.*`).
 */

export interface LmStudioModel {
  id: string;
  /** "loaded" | "not-loaded" (LM Studio reports load state per model). */
  state?: string;
  /** "llm" | "vlm" | "embeddings". */
  type?: string;
  maxContextLength?: number;
  quantization?: string;
  arch?: string;
  publisher?: string;
}

export interface LmStudioChatResult {
  responseId?: string;
  modelInstanceId?: string;
  /** Flattened assistant text from the `output` array. */
  text: string;
  /** The raw response, for callers that need more than the flattened text. */
  raw: any;
}

export class LmStudioClient {
  private cfg() {
    const c = vscode.workspace.getConfiguration('fuuz.lmStudio');
    return {
      baseUrl: (c.get<string>('baseUrl', 'http://localhost:1234') || 'http://localhost:1234').replace(/\/+$/, ''),
      token: (c.get<string>('apiToken', '') || '').trim(),
    };
  }

  private headers(json = false): Record<string, string> {
    const { token } = this.cfg();
    const h: Record<string, string> = { accept: 'application/json' };
    if (json) h['content-type'] = 'application/json';
    if (token) h['authorization'] = `Bearer ${token}`;
    return h;
  }

  /** True when the LM Studio server answers the model listing. */
  async ping(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }

  /** Discover installed models via `GET /api/v0/models`. */
  async listModels(): Promise<LmStudioModel[]> {
    const { baseUrl } = this.cfg();
    const res = await fetch(`${baseUrl}/api/v0/models`, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(`LM Studio ${baseUrl} returned HTTP ${res.status} for /api/v0/models. Is the local server running?`);
    }
    const json: any = await res.json().catch(() => ({}));
    const rows: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    return rows.map(r => ({
      id: String(r.id ?? r.key ?? ''),
      state: r.state,
      type: r.type,
      maxContextLength: r.max_context_length ?? r.loaded_context_length,
      quantization: r.quantization,
      arch: r.arch,
      publisher: r.publisher,
    })).filter(m => m.id);
  }

  /**
   * Send a message to a model via the stateful chat endpoint. Pass
   * `previousResponseId` to continue that model's existing thread; omit it to
   * start a new one. `store:false` makes a one-off stateless call.
   */
  async chat(opts: {
    model: string;
    input: string;
    previousResponseId?: string;
    store?: boolean;
    signal?: AbortSignal;
  }): Promise<LmStudioChatResult> {
    const { baseUrl } = this.cfg();
    const body: Record<string, unknown> = { model: opts.model, input: opts.input };
    if (opts.previousResponseId) body.previous_response_id = opts.previousResponseId;
    if (opts.store === false) body.store = false;

    const res = await fetch(`${baseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`LM Studio chat failed (HTTP ${res.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`);
    }
    const json: any = await res.json().catch(() => ({}));
    return {
      responseId: json.response_id,
      modelInstanceId: json.model_instance_id,
      text: flattenOutput(json.output),
      raw: json,
    };
  }
}

/** Flatten LM Studio's `output` array into plain assistant text. */
function flattenOutput(output: any): string {
  if (typeof output === 'string') return output;
  if (!Array.isArray(output)) return '';
  const parts: string[] = [];
  for (const item of output) {
    if (typeof item === 'string') parts.push(item);
    else if (typeof item?.content === 'string') parts.push(item.content);
    else if (Array.isArray(item?.content)) {
      for (const c of item.content) {
        if (typeof c === 'string') parts.push(c);
        else if (typeof c?.text === 'string') parts.push(c.text);
      }
    } else if (typeof item?.text === 'string') parts.push(item.text);
  }
  return parts.join('').trim();
}
