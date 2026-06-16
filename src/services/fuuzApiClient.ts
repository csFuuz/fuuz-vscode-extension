import { EnterpriseEndpoints } from '../types';

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
  private async post(url: string, token: string, body: unknown): Promise<ApiResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
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
      clearTimeout(timer);
    }
  }

  /**
   * Execute a data flow: `POST {flowExecution}` with `{ flowId, payload }`.
   */
  executeFlow(
    endpoints: EnterpriseEndpoints,
    token: string,
    flowId: string,
    payload: unknown
  ): Promise<ApiResult> {
    return this.post(endpoints.flowExecution, token, { flowId, payload: payload ?? {} });
  }

  /**
   * Fire a webhook: `POST {webhook}{topic}` with an arbitrary JSON body.
   * `topic` is appended to the `/webhook/post/` base (e.g. `robot.update`).
   */
  sendWebhook(
    endpoints: EnterpriseEndpoints,
    token: string,
    topic: string,
    body: unknown
  ): Promise<ApiResult> {
    const base = endpoints.webhook.replace(/\/$/, '');
    const url = `${base}/${topic.replace(/^\//, '')}`;
    return this.post(url, token, body ?? {});
  }
}
