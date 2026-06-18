/**
 * Abort/timeout plumbing shared by the HTTP clients. No VS Code dependency so it
 * stays unit-testable in plain Node.
 */

/**
 * Build a `fetch` signal that aborts when EITHER a timeout elapses OR an external
 * signal (e.g. from a VS Code `CancellationToken`) fires. Call `dispose()` in a
 * `finally` to clear the timer and detach the listener.
 */
export function timeoutSignal(
  timeoutMs: number,
  external?: AbortSignal
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
  const onAbort = () => controller.abort((external as any)?.reason);
  if (external) {
    if (external.aborted) controller.abort((external as any).reason);
    else external.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
  };
}

/** True when an error was raised by an aborted request (timeout or cancellation). */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message));
}
