import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  applyFuuzServers,
  readJsonFile,
  serializeConfig,
  writeFileAtomic,
} from '../util/claudeConfig';

let counter = 0;
async function tmpFile(seed: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fuuz-claudecfg-'));
  return path.join(dir, `${seed}-${counter++}.json`);
}

test('applyFuuzServers: preserves foreign servers + top-level keys, replaces fuuz-* entries', () => {
  const config = {
    numCompletedSteps: 7,
    mcpServers: {
      'some-other-server': { type: 'stdio', command: 'x' },
      'fuuz-old-tenant': { type: 'http', url: 'https://stale' },
    },
  };
  const { config: out, hadFuuzEntries } = applyFuuzServers(config, {
    'fuuz-acme-prod': { type: 'http', url: 'https://new' },
  });

  assert.equal(hadFuuzEntries, true);
  // foreign server + unrelated top-level key untouched
  assert.deepEqual(out.mcpServers['some-other-server'], { type: 'stdio', command: 'x' });
  assert.equal(out.numCompletedSteps, 7);
  // stale fuuz entry dropped, new one present
  assert.equal(out.mcpServers['fuuz-old-tenant'], undefined);
  assert.deepEqual(out.mcpServers['fuuz-acme-prod'], { type: 'http', url: 'https://new' });
});

test('applyFuuzServers: reports no prior entries and creates mcpServers when absent', () => {
  const { config, hadFuuzEntries } = applyFuuzServers({ foo: 1 }, { 'fuuz-a-b': { type: 'http' } });
  assert.equal(hadFuuzEntries, false);
  assert.equal((config as any).foo, 1);
  assert.deepEqual(config.mcpServers, { 'fuuz-a-b': { type: 'http' } });
});

test('applyFuuzServers: empty entries strips all fuuz-* but keeps others', () => {
  const { config, hadFuuzEntries } = applyFuuzServers(
    { mcpServers: { 'fuuz-x-y': {}, keep: { a: 1 } } },
    {}
  );
  assert.equal(hadFuuzEntries, true);
  assert.deepEqual(config.mcpServers, { keep: { a: 1 } });
});

test('serializeConfig: 2-space indent with trailing newline', () => {
  assert.equal(serializeConfig({ a: 1 }), '{\n  "a": 1\n}\n');
});

test('writeFileAtomic + readJsonFile: round-trips and overwrites, no temp left behind', async () => {
  const file = await tmpFile('round');
  await writeFileAtomic(file, serializeConfig({ mcpServers: { 'fuuz-a-b': { url: 'u' } } }));
  assert.deepEqual(await readJsonFile(file), { mcpServers: { 'fuuz-a-b': { url: 'u' } } });

  // overwrite
  await writeFileAtomic(file, serializeConfig({ ok: true }));
  assert.deepEqual(await readJsonFile(file), { ok: true });

  // no sibling .tmp files linger
  const siblings = await fs.readdir(path.dirname(file));
  assert.equal(siblings.some(f => f.includes('.tmp')), false);
});

test('readJsonFile: missing → {}, empty → {}, invalid → null', async () => {
  const missing = path.join(os.tmpdir(), `fuuz-does-not-exist-${counter++}.json`);
  assert.deepEqual(await readJsonFile(missing), {});

  const empty = await tmpFile('empty');
  await fs.writeFile(empty, '   ');
  assert.deepEqual(await readJsonFile(empty), {});

  const invalid = await tmpFile('invalid');
  await fs.writeFile(invalid, '{ not json ');
  assert.equal(await readJsonFile(invalid), null);
});

test('readJsonFile: a JSON array (not an object) is treated as invalid', async () => {
  const arr = await tmpFile('arr');
  await fs.writeFile(arr, '[1,2,3]');
  assert.equal(await readJsonFile(arr), null);
});
