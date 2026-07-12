/**
 * Run an async mapper over `items` with at most `limit` calls in flight at once.
 * Results are returned in input order. Use this instead of a serial `for…await`
 * when each item is an independent network round-trip — bounded concurrency cuts
 * wall-clock without hammering a throttle-sensitive server.
 *
 * `fn` is responsible for its own error handling (e.g. `.catch(() => null)`); a
 * throw from any call rejects the whole batch, matching `Promise.all`.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
