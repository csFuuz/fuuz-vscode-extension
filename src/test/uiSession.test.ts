import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUiSessionLaunch, chromeArgs, screenRunUrl, UI_DIR } from '../qa/uiSession';

const launch = buildUiSessionLaunch({
  uiDirFsPath: '/work/.fuuz/ui',
  mcpConfigPath: '.fuuz/ui/mcp.ui.json',
  appUrl: 'https://build.mfgx.fuuz.app',
  cdpPort: 9222,
  brief: 'the Asset Intake screen loads and saves',
  autonomous: false,
});

test('chromeArgs: the port is useless on Chrome 136+ without --remote-allow-origins', () => {
  const args = chromeArgs({ userDataDir: '/work/.fuuz/ui/profile', port: 9222, url: 'https://x.fuuz.app' });
  assert.ok(args.includes('--remote-debugging-port=9222'));
  assert.ok(args.includes('--user-data-dir=/work/.fuuz/ui/profile'));
  assert.ok(args.includes('--remote-allow-origins=*'), 'mandatory or every CDP connection is refused');
  assert.equal(args[args.length - 1], 'https://x.fuuz.app', 'the URL must be the positional arg');
});

test('screenRunUrl: the runner route, tolerant of a trailing slash', () => {
  assert.equal(
    screenRunUrl('https://build.mfgx.fuuz.app/', 'ver-1'),
    'https://build.mfgx.fuuz.app/system/configuration/screens/ver-1/run');
});

test('buildUiSessionLaunch: Playwright ATTACHES over CDP and never launches its own browser', () => {
  const pw = launch.mcpConfig.mcpServers.playwright as { command: string; args: string[] };
  assert.equal(pw.command, 'npx');
  assert.ok(pw.args.includes('--cdp-endpoint'));
  assert.ok(pw.args.includes('http://127.0.0.1:9222'));
  // A second browser would come up signed OUT, and the agent would report the
  // login page as a broken screen.
  assert.ok(!pw.args.includes('--user-data-dir'), 'must not launch a second profile');
  assert.ok(!pw.args.includes('--isolated'));
  // Reading a Monaco editor back needs a clipboard round-trip.
  assert.ok(pw.args.includes('--grant-permissions'));
  assert.ok(pw.args.includes('clipboard-read') && pw.args.includes('clipboard-write'));
  assert.ok(pw.args.includes('/work/.fuuz/ui/shots'));
});

test('buildUiSessionLaunch: the prompt loads the skill, forbids a re-login, and aborts on one', () => {
  assert.match(launch.prompt, /fuuz-ui-validation skill/);
  assert.match(launch.prompt, /ALREADY SIGNED IN/);
  assert.match(launch.prompt, /do not ask me to log in again/);
  assert.match(launch.prompt, /login form renders, STOP/);
  assert.match(launch.prompt, /the Asset Intake screen loads and saves/);
  assert.ok(launch.prompt.includes(`${UI_DIR}/shots`));
});

test('buildUiSessionLaunch: a screen version id starts on the runner route, with the redirect warning', () => {
  const withScreen = buildUiSessionLaunch({
    uiDirFsPath: '/work/.fuuz/ui', mcpConfigPath: '.fuuz/ui/mcp.ui.json',
    appUrl: 'https://build.mfgx.fuuz.app', cdpPort: 9222, brief: 'check it', autonomous: false,
    screenVersionId: 'ver-9',
  });
  assert.match(withScreen.prompt, /screens\/ver-9\/run/);
  assert.match(withScreen.prompt, /SECOND navigation/);
});

test('buildUiSessionLaunch: prompt precedes the variadic --mcp-config; manual does not bypass permissions', () => {
  assert.match(launch.shellCommand, /^claude '.*' --mcp-config \.fuuz\/ui\/mcp\.ui\.json --strict-mcp-config$/);
  assert.ok(launch.shellCommand.indexOf("'") < launch.shellCommand.indexOf('--mcp-config'));
  assert.ok(!launch.shellCommand.includes('--permission-mode'));
  assert.match(launch.prompt, /Confirm with me before any action that writes/);
});

test('buildUiSessionLaunch: autonomous bypasses prompts and claims full authority', () => {
  const auto = buildUiSessionLaunch({
    uiDirFsPath: '/work/.fuuz/ui', mcpConfigPath: '.fuuz/ui/mcp.ui.json',
    appUrl: 'https://build.mfgx.fuuz.app', cdpPort: 9222, brief: 'sweep it', autonomous: true,
  });
  assert.match(auto.shellCommand, /--permission-mode bypassPermissions$/);
  assert.match(auto.prompt, /complete authority/);
});

test('buildUiSessionLaunch: the Fuuz MCP token is referenced by env var, never inlined', () => {
  const withFuuz = buildUiSessionLaunch({
    uiDirFsPath: '/work/.fuuz/ui', mcpConfigPath: '.fuuz/ui/mcp.ui.json',
    appUrl: 'https://build.mfgx.fuuz.app', cdpPort: 9222, brief: 'check it', autonomous: false,
    fuuz: { url: 'https://api.build.mfgx.fuuz.app/mcp', tenantId: 'tnt-1', tokenEnvVar: 'FUUZ_UI_TOKEN' },
  });
  const fuuz = withFuuz.mcpConfig.mcpServers.fuuz as { type: string; headers: Record<string, string> };
  assert.equal(fuuz.type, 'http');
  assert.equal(fuuz.headers.Authorization, 'Bearer ${FUUZ_UI_TOKEN}');
  assert.equal(fuuz.headers['X-Fuuz-Tenant'], 'tnt-1');
  assert.ok(!JSON.stringify(withFuuz.mcpConfig).includes('Bearer ey'), 'no raw token on disk');
  // With the tenant MCP available, verification must be a read-back.
  assert.match(withFuuz.prompt, /reading the record back over the Fuuz MCP/);
});

test('buildUiSessionLaunch: a single-quoted brief cannot break out of the shell command', () => {
  const quoted = buildUiSessionLaunch({
    uiDirFsPath: '/work/.fuuz/ui', mcpConfigPath: '.fuuz/ui/mcp.ui.json',
    appUrl: 'https://build.mfgx.fuuz.app', cdpPort: 9222, autonomous: false,
    brief: "the operator's queue; rm -rf /",
  });
  assert.ok(quoted.shellCommand.includes("operator'\\''s"), 'apostrophe must be escaped');
  assert.match(quoted.shellCommand, /--mcp-config \.fuuz\/ui\/mcp\.ui\.json --strict-mcp-config$/);
});
