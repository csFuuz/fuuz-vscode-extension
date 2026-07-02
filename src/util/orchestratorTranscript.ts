/**
 * Pure helpers for the orchestrator's shared conversation. No VS Code
 * dependency, so they unit-test in plain Node (see test/orchestratorTranscript.test.ts).
 *
 * The orchestrator owns the canonical transcript; each LM Studio model keeps its
 * own server-side stateful thread (a per-model cache keyed by response id). Those
 * threads are NOT reusable across models, so when a step is routed to a model
 * that has no thread yet, we seed it with a preamble built from the shared
 * transcript — that is what {@link buildSeedPreamble} produces.
 */

export type TranscriptRole = 'user' | 'assistant' | 'system';

export interface TranscriptEntry {
  role: TranscriptRole;
  content: string;
  /** ISO timestamp. */
  at: string;
  /** For assistant turns: which model produced it. For user turns: the target role. */
  model?: string;
}

/**
 * Build a text preamble that seeds a fresh model with the shared conversation so
 * far. Used only when routing to a model that has no existing thread — a model
 * with a live `previous_response_id` already has this context server-side.
 *
 * `maxEntries` bounds how much history is replayed; `maxChars` caps total size
 * (older entries are dropped first). Returns '' when there is nothing to seed.
 */
export function buildSeedPreamble(
  entries: TranscriptEntry[],
  opts: { maxEntries?: number; maxChars?: number } = {}
): string {
  const maxEntries = opts.maxEntries ?? 20;
  const maxChars = opts.maxChars ?? 8000;
  if (!entries.length) return '';

  // Take the most recent `maxEntries`, then trim from the front to fit maxChars.
  let slice = entries.slice(-maxEntries);
  const format = (e: TranscriptEntry) => {
    const who = e.role === 'assistant' ? `Assistant${e.model ? ` (${e.model})` : ''}` : e.role === 'user' ? 'User' : 'System';
    return `${who}: ${e.content}`;
  };
  let body = slice.map(format).join('\n\n');
  while (body.length > maxChars && slice.length > 1) {
    slice = slice.slice(1);
    body = slice.map(format).join('\n\n');
  }
  return (
    'The following is prior conversation context from other assistants working on this task. ' +
    'Use it as background; do not repeat it back.\n\n' +
    '--- shared context ---\n' +
    body +
    '\n--- end shared context ---'
  );
}

/** Prepend the seed preamble to an input when one is needed (else return input unchanged). */
export function seedInput(input: string, preamble: string): string {
  return preamble ? `${preamble}\n\n${input}` : input;
}
