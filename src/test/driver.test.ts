import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeadedDriver } from '../qa/driver';

const launch = buildHeadedDriver({
  runDirFsPath: '/work/.fuuz/qa/qa-1',
  briefPath: '.fuuz/qa/qa-1/brief.md',
  mcpConfigPath: '.fuuz/qa/qa-1/mcp.qa.json',
  artifactsPath: '.fuuz/qa/qa-1/artifacts',
  targetUrl: 'https://build.mfgx.fuuz.app',
});

test('buildHeadedDriver: wires the Playwright MCP with output + profile dirs', () => {
  const pw = launch.mcpConfig.mcpServers.playwright as { command: string; args: string[] };
  assert.equal(pw.command, 'npx');
  assert.ok(pw.args.includes('@playwright/mcp@latest'));
  assert.ok(pw.args.includes('--output-dir'));
  assert.ok(pw.args.includes('/work/.fuuz/qa/qa-1/artifacts'));
  assert.ok(pw.args.includes('/work/.fuuz/qa/qa-1/profile'));
  // Headed (must NOT force headless) so the developer can log personas in.
  assert.ok(!pw.args.includes('--headless'));
});

test('buildHeadedDriver: prompt targets the URL, run-relative brief, and manual login', () => {
  assert.match(launch.prompt, /https:\/\/build\.mfgx\.fuuz\.app/);
  assert.match(launch.prompt, /\.fuuz\/qa\/qa-1\/brief\.md/);
  assert.match(launch.prompt, /log in/i);
  assert.match(launch.prompt, /\.fuuz\/qa\/qa-1\/artifacts/);
});

test('buildHeadedDriver: shell command puts the prompt before the variadic --mcp-config (run-relative)', () => {
  // prompt must precede --mcp-config (variadic) or it gets swallowed as a config path
  assert.match(launch.shellCommand, /^claude '.*' --mcp-config \.fuuz\/qa\/qa-1\/mcp\.qa\.json --strict-mcp-config$/);
  assert.ok(launch.shellCommand.indexOf("'") < launch.shellCommand.indexOf('--mcp-config'), 'prompt comes first');
  assert.ok(!launch.shellCommand.includes('"'), 'prompt should be single-quoted without inner double quotes');
});

test('buildHeadedDriver: optional Fuuz MCP uses an env-var token (never inline)', () => {
  const withFuuz = buildHeadedDriver({
    runDirFsPath: '/work/.fuuz/qa/qa-1',
    briefPath: '.fuuz/qa/qa-1/brief.md', mcpConfigPath: '.fuuz/qa/qa-1/mcp.qa.json', artifactsPath: '.fuuz/qa/qa-1/artifacts',
    targetUrl: 'https://build.mfgx.fuuz.app',
    fuuz: { url: 'https://api.build.mfgx.fuuz.app/mcp', tenantId: 'tnt-1', tokenEnvVar: 'FUUZ_QA_TOKEN' },
  });
  const fuuz = withFuuz.mcpConfig.mcpServers.fuuz as { type: string; url: string; headers: Record<string, string> };
  assert.equal(fuuz.type, 'http');
  assert.equal(fuuz.url, 'https://api.build.mfgx.fuuz.app/mcp');
  assert.equal(fuuz.headers.Authorization, 'Bearer ${FUUZ_QA_TOKEN}');
  assert.equal(fuuz.headers['X-Fuuz-Tenant'], 'tnt-1');
  assert.match(withFuuz.prompt, /Fuuz MCP server for this tenant/);
  // No mcpServers entry should contain a raw token.
  assert.ok(!JSON.stringify(withFuuz.mcpConfig).includes('Bearer ey'), 'token must not be inlined');
});
