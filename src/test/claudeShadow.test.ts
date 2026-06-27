import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEnvRefServer, isEmbeddedServer, shadowingFuuzServers } from '../util/claudeConfig';

const embedded = { type: 'http', url: 'u', headers: { Authorization: 'Bearer eyJrealtoken' } };
const envref = { type: 'http', url: 'u', headers: { Authorization: 'Bearer ${FUUZ_TOKEN_X}' } };

test('isEnvRefServer / isEmbeddedServer classify auth modes', () => {
  assert.equal(isEnvRefServer(envref), true);
  assert.equal(isEnvRefServer(embedded), false);
  assert.equal(isEmbeddedServer(embedded), true);
  assert.equal(isEmbeddedServer(envref), false);
  // stdio proxy variants
  assert.equal(isEnvRefServer({ command: 'node', env: { FUUZ_TOKEN_ENV: 'FUUZ_TOKEN_X' } }), true);
  assert.equal(isEmbeddedServer({ command: 'node', env: { FUUZ_TOKEN: 'eyJabc' } }), true);
});

test('shadowingFuuzServers: env-ref project entries that are embedded in user config', () => {
  const project = { mcpServers: { 'fuuz-a-b': envref, 'fuuz-c-d': envref, 'other': {} } };
  const user = { mcpServers: { 'fuuz-a-b': embedded, 'fuuz-c-d': embedded } };
  assert.deepEqual(shadowingFuuzServers(project, user).sort(), ['fuuz-a-b', 'fuuz-c-d']);
});

test('shadowingFuuzServers: no shadow when project is embedded or user lacks the key', () => {
  assert.deepEqual(shadowingFuuzServers({ mcpServers: { 'fuuz-a-b': embedded } }, { mcpServers: { 'fuuz-a-b': embedded } }), []);
  assert.deepEqual(shadowingFuuzServers({ mcpServers: { 'fuuz-a-b': envref } }, { mcpServers: {} }), []);
  assert.deepEqual(shadowingFuuzServers({}, {}), []);
});
