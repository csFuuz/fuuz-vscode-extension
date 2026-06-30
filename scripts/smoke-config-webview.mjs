// Headless smoke test for the config-panel webview. Loads the REAL built
// media/config/config.js into jsdom, mocks acquireVsCodeApi, and drives the
// message protocol the extension host uses — verifying the React migration
// renders state and posts the right inbound messages on interaction.
//
// Run: node scripts/smoke-config-webview.mjs   (after `npm run build:webview`)
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.join(dir, '..', 'media', 'config', 'config.js');
const code = fs.readFileSync(bundle, 'utf8');

const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

const dom = new JSDOM(
  `<!DOCTYPE html><html class="vscode-dark"><body><div id="root" data-logo="https://logo.png"></div></body></html>`,
  { runScripts: 'dangerously', pretendToBeVisual: true }
);
const { window } = dom;
const { document } = window;

const posted = [];
window.acquireVsCodeApi = () => ({ postMessage: m => posted.push(m) });

// React's synthetic onChange needs the native value setter + a bubbling input event.
function setInput(el, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
}
const byText = (sel, text) =>
  [...document.querySelectorAll(sel)].find(el => el.textContent.trim() === text);
const send = data => window.dispatchEvent(new window.MessageEvent('message', { data }));

let failures = 0;
function check(label, fn) {
  try { fn(); console.log(`  ✓ ${label}`); }
  catch (e) { failures++; console.error(`  ✗ ${label}\n      ${e.message}`); }
}

const SAMPLE = {
  type: 'state',
  state: {
    enterprises: [
      {
        id: 'ent-acme', name: 'ACME', environment: 'build.mfgx', mcpEndpoint: 'https://api.build.mfgx.fuuz.app',
        overrides: { mcpServerUrl: '', flowExecutionUrl: '', webhookUrl: '' },
        endpoints: { apiBase: 'https://api.build.mfgx.fuuz.app', mcp: 'https://api.build.mfgx.fuuz.app/mcp', flowExecution: 'https://api.build.mfgx.fuuz.app/orchestration/executeFlow', webhook: 'https://api.build.mfgx.fuuz.app/webhook/post/' },
        tenants: [{ id: 'tnt-prod', name: 'Production', hasToken: true, active: false, disabled: false }],
      },
    ],
    providers: [
      { id: 'copilot', label: 'GitHub Copilot (VS Code)', description: 'Surfaced to Copilot.', enabled: true, usesOAuth: false, signedIn: false },
      { id: 'claude-code', label: 'Claude Code', description: 'Writes ~/.claude.json.', enabled: false, usesOAuth: true, signedIn: false },
    ],
    activeTools: {
      enterpriseId: 'ent-acme', tenantId: 'tnt-prod', tenantName: 'Production',
      items: [{ name: 'system_query_model', description: 'Query a model', kind: 'system', enabled: true }],
    },
  },
};

async function main() {
  // Execute the bundle inside the jsdom window.
  const script = document.createElement('script');
  script.textContent = code;
  document.body.appendChild(script);
  await tick();

  check('webview posts {ready} on mount', () => {
    assert.ok(posted.some(m => m.type === 'ready'), `posted: ${JSON.stringify(posted)}`);
  });

  // Render state.
  send(SAMPLE);
  await tick();

  check('renders enterprise + tenant from state', () => {
    const html = document.body.textContent;
    assert.ok(html.includes('ACME'), 'enterprise name missing');
    assert.ok(html.includes('Production'), 'tenant name missing');
    assert.ok(html.includes('env: build.mfgx'), 'environment missing');
  });

  check('renders endpoints table', () => {
    assert.ok(document.body.textContent.includes('/orchestration/executeFlow'), 'flow endpoint missing');
  });

  check('renders agent tools card with the tool', () => {
    assert.ok(document.body.textContent.includes('system_query_model'), 'tool name missing');
    assert.ok(document.body.textContent.includes('Agent Tools — Production'), 'tools header missing');
  });

  check('renders AI providers card', () => {
    const html = document.body.textContent;
    assert.ok(html.includes('AI providers'), 'providers header missing');
    assert.ok(html.includes('GitHub Copilot (VS Code)'), 'copilot provider missing');
    assert.ok(html.includes('Claude Code'), 'claude provider missing');
  });

  check('Claude provider Sign in posts {signInProvider}', () => {
    const btn = byText('button', 'Sign in');
    assert.ok(btn, 'Sign in button not found');
    btn.click();
    assert.ok(posted.some(m => m.type === 'signInProvider' && m.id === 'claude-code'), `posted: ${JSON.stringify(posted)}`);
  });

  check('Provider Enable posts {setProviderEnabled}', () => {
    const btn = byText('button', 'Enable');
    assert.ok(btn, 'Enable button not found');
    btn.click();
    assert.ok(posted.some(m => m.type === 'setProviderEnabled'), `posted: ${JSON.stringify(posted)}`);
  });

  // Interaction: add-by-key.
  check('Add & test posts {addByToken} with the typed token', () => {
    const tokenInput = document.querySelector('input[type="password"]');
    assert.ok(tokenInput, 'token input not found');
    setInput(tokenInput, 'eyJTOKEN');
    const btn = byText('button', 'Add & test');
    assert.ok(btn, 'Add & test button not found');
    btn.click();
    const msg = posted.find(m => m.type === 'addByToken');
    assert.ok(msg, 'no addByToken posted');
    assert.equal(msg.token, 'eyJTOKEN');
  });

  // Interaction: tenant Test button.
  check('tenant Test posts {test} with enterprise + tenant ids', () => {
    const btn = byText('button', 'Test');
    assert.ok(btn, 'Test button not found');
    btn.click();
    const msg = posted.find(m => m.type === 'test');
    assert.ok(msg, 'no test posted');
    assert.equal(msg.enterpriseId, 'ent-acme');
    assert.equal(msg.tenantId, 'tnt-prod');
  });

  // Interaction: Set active.
  check('Set active posts {setActive}', () => {
    const btn = byText('button', 'Set active');
    assert.ok(btn, 'Set active button not found');
    btn.click();
    assert.ok(posted.some(m => m.type === 'setActive' && m.tenantId === 'tnt-prod'), 'no setActive posted');
  });

  // Interaction: toggle a tool off. Both a tenant row and the tool row carry a
  // "Disable" button, so scope to the Agent Tools card.
  check('tool Disable posts {setToolEnabled enabled:false}', () => {
    const toolsCard = [...document.querySelectorAll('.card')].find(c => c.textContent.includes('Agent Tools'));
    assert.ok(toolsCard, 'Agent Tools card not found');
    const btn = [...toolsCard.querySelectorAll('button')].find(b => b.textContent.trim() === 'Disable');
    assert.ok(btn, 'tool Disable button not found');
    btn.click();
    const msg = posted.find(m => m.type === 'setToolEnabled');
    assert.ok(msg, 'no setToolEnabled posted');
    assert.equal(msg.enabled, false);
    assert.equal(msg.name, 'system_query_model');
  });

  // Inbound probeResult renders badges.
  send({ type: 'probeResult', tenantId: 'tnt-prod', probes: [
    { key: 'mcp', label: 'MCP', url: 'u', state: 'available' },
    { key: 'flow', label: 'Flow', url: 'u', state: 'unauthorized' },
  ] });
  await tick();
  check('probeResult renders ✓/✗ endpoint badges', () => {
    const t = document.body.textContent;
    assert.ok(t.includes('MCP ✓'), 'MCP ok badge missing');
    assert.ok(t.includes('Flow ✗'), 'Flow fail badge missing');
  });

  // Inbound importResult success.
  send({ type: 'importResult', ok: true, result: { enterpriseName: 'ACME', tenantName: 'Staging', tenantId: 'tnt-stg', probes: [] } });
  await tick();
  check('importResult success renders confirmation', () => {
    assert.ok(document.body.textContent.includes('Added ACME › Staging'), 'import confirmation missing');
  });

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
