import { EnterpriseEndpoints } from '../types';
import { timeoutSignal } from '../util/abort';

const REQUEST_TIMEOUT_MS = 30000;

/** Outcome of a Fuuz API call — status plus parsed body (JSON or raw text). */
export interface ApiResult {
  ok: boolean;
  status: number;
  body: unknown;
}

/**
 * Authenticated POST client for the Fuuz runtime endpoints derived per
 * enterprise: flow execution, webhooks, and GraphQL. Uses the global `fetch`
 * (no bundled HTTP dependency); the Bearer token is supplied by the caller from
 * SecretStorage.
 */
export class FuuzApiClient {
  private async post(url: string, token: string, body: unknown, signal?: AbortSignal): Promise<ApiResult> {
    const t = timeoutSignal(REQUEST_TIMEOUT_MS, signal);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body ?? {}),
        signal: t.signal,
      });
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) : '';
      } catch {
        /* keep raw text */
      }
      return { ok: res.ok, status: res.status, body: parsed };
    } finally {
      t.dispose();
    }
  }

  /**
   * Execute a data flow: `POST {flowExecution}` with `{ flowId, payload }`.
   */
  executeFlow(
    endpoints: EnterpriseEndpoints,
    token: string,
    flowId: string,
    payload: unknown,
    signal?: AbortSignal
  ): Promise<ApiResult> {
    return this.post(endpoints.flowExecution, token, { flowId, payload: payload ?? {} }, signal);
  }

  /**
   * Fire a webhook: `POST {webhook}{topic}` with an arbitrary JSON body.
   * `topic` is appended to the `/webhook/post/` base (e.g. `robot.update`).
   */
  sendWebhook(
    endpoints: EnterpriseEndpoints,
    token: string,
    topic: string,
    body: unknown,
    signal?: AbortSignal
  ): Promise<ApiResult> {
    const base = endpoints.webhook.replace(/\/$/, '');
    const url = `${base}/${topic.replace(/^\//, '')}`;
    return this.post(url, token, body ?? {}, signal);
  }
}
