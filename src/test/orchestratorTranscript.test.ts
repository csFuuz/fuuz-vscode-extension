import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeedPreamble, seedInput, TranscriptEntry } from '../util/orchestratorTranscript';

const e = (role: TranscriptEntry['role'], content: string, model?: string): TranscriptEntry =>
  ({ role, content, at: '2026-07-02T00:00:00.000Z', model });

test('buildSeedPreamble: empty transcript yields empty string', () => {
  assert.equal(buildSeedPreamble([]), '');
});

test('buildSeedPreamble: includes recent turns with role labels', () => {
  const out = buildSeedPreamble([e('user', 'plan the flow', 'orchestrator'), e('assistant', 'here is the plan', 'qwen-coder')]);
  assert.match(out, /shared context/);
  assert.match(out, /User: plan the flow/);
  assert.match(out, /Assistant \(qwen-coder\): here is the plan/);
});

test('buildSeedPreamble: caps to maxEntries (keeps most recent)', () => {
  const entries = Array.from({ length: 30 }, (_, i) => e('user', `msg${i}`));
  const out = buildSeedPreamble(entries, { maxEntries: 3 });
  assert.ok(out.includes('msg29') && out.includes('msg27'), 'keeps last 3');
  assert.ok(!out.includes('msg26'), 'drops older');
});

test('buildSeedPreamble: trims from the front to fit maxChars', () => {
  const entries = [e('user', 'A'.repeat(100)), e('user', 'B'.repeat(100)), e('user', 'KEEP')];
  const out = buildSeedPreamble(entries, { maxEntries: 10, maxChars: 60 });
  assert.ok(out.includes('KEEP'), 'keeps the newest entry even under a tight char budget');
  assert.ok(!out.includes('A'.repeat(100)), 'drops the oldest oversized entry');
});

test('seedInput: prepends preamble only when present', () => {
  assert.equal(seedInput('hello', ''), 'hello');
  assert.equal(seedInput('hello', 'CONTEXT'), 'CONTEXT\n\nhello');
});
