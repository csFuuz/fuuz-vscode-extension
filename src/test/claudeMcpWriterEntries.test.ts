import './helpers/vscodeMock';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeMcpWriter } from '../services/claudeMcpWriter';

/**
 * Security-critical contract: the live token is embedded only into the private
 * home-dir configs (user `~/.claude.json`, Claude Desktop) and NEVER into the
 * shareable project `.mcp.json` (which references an env var instead).
 */

const enterprises = [
  {
    id: 'mfgx', name: 'MFGx', environment: 'build.mfgx',
    mcpEndpoint: 'https://api.build.mfgx.fuuz.app',
    tenants: [
      { id: 'plant1', name: 'Plant One' },
      { id: 'plant2', name: 'Plant Two', disabled: true },
      { id: 'plant3', name: 'Plant Three', disabledTools: ['system_deploy_app_component_version'] },
    ],
  },
];

function makeWriter() {
  const configManager: any = {
    getEnterprises: () => enterprises,
    getMcpServerUrl: () => 'https://api.build.mfgx.fuuz.app/mcp',
  };
  const tokenStore: any = { getToken: async () => 'TOKEN_ABC' };
  return new ClaudeMcpWriter(configManager, tokenStore);
}

test('tokenModeFor: project is env-ref; user + desktop embed', () => {
  const w = makeWriter() as any;
  assert.equal(w.tokenModeFor('project'), 'envref');
  assert.equal(w.tokenModeFor('user'), 'embed');
  assert.equal(w.tokenModeFor('desktop'), 'embed');
});

test('plannedServers: skips disabled tenants, derives keys + env vars', () => {
  const planned = makeWriter().plannedServers();
  // plant2 is disabled → excluded.
  assert.deepEqual(planned.map(p => p.tenantId), ['plant1', 'plant3']);
  assert.equal(planned[0].serverKey, 'fuuz-mfgx-plant1');
  assert.equal(planned[0].envVar, 'FUUZ_TOKEN_MFGX_PLANT1');
});

test('envVarFor: uppercases and sanitizes non-alphanumerics', () => {
  const w = makeWriter();
  assert.equal(w.envVarFor({ id: 'mf-gx' } as any, { id: 'plant.1' } as any), 'FUUZ_TOKEN_MF_GX_PLANT_1');
});

test('httpEntry: embeds the token when given, else references the env var', () => {
  const w = makeWriter() as any;
  const s = w.plannedServers()[0];
  const embedded = w.httpEntry(s, 'TOKEN_ABC');
  assert.equal(embedded.type, 'http');
  assert.equal(embedded.headers.Authorization, 'Bearer TOKEN_ABC');
  assert.equal(embedded.headers['X-Fuuz-Tenant'], 'plant1');

  const ref = w.httpEntry(s, undefined);
  assert.equal(ref.headers.Authorization, 'Bearer ${FUUZ_TOKEN_MFGX_PLANT1}');
  assert.ok(!ref.headers.Authorization.includes('TOKEN_ABC'), 'env-ref entry must not embed the token');
});
