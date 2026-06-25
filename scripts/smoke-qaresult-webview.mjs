// Headless smoke test for the QA result webview. Loads the real built
// media/qaresult/qaresult.js into jsdom, feeds it a payload, and asserts the
// result + logs render and evidence links post {openFile}.
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(dir, '..', 'media', 'qaresult', 'qaresult.js'), 'utf8');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

const dom = new JSDOM(`<!DOCTYPE html><html class="vscode-dark"><body><div id="root"></div></body></html>`, {
  runScripts: 'dangerously', pretendToBeVisual: true,
});
const { window } = dom;
const posted = [];
window.acquireVsCodeApi = () => ({ postMessage: m => posted.push(m) });

const PAYLOAD = {
  runId: 'qa-1', scopeName: 'Work Orders', target: { url: 'https://build.mfgx.fuuz.app', envSlug: 'build.mfgx' },
  hasResult: true, hasLogs: true,
  result: {
    summary: 'Mostly works; create flow has a bug.',
    personas: [{ name: 'Operator', steps: [
      { title: 'Landing', status: 'pass' },
      { title: 'Create', status: 'fail', notes: 'save 500', evidence: 'artifacts/create.png' },
    ] }],
    defects: [{ severity: 'high', title: 'Create returns 500', fix: 'handle null status', evidence: 'artifacts/create.png' }],
    uxNotes: [{ area: 'navigation', note: 'too deep', recommendation: 'flatten to 2 levels' }],
  },
  logs: [{ source: 'integration-log', severity: 'error', message: 'ERP timeout', where: 'postOrder', at: 't1' }],
};

let failures = 0;
const check = (label, fn) => { try { fn(); console.log(`  ✓ ${label}`); } catch (e) { failures++; console.error(`  ✗ ${label}\n      ${e.message}`); } };

async function main() {
  const s = window.document.createElement('script');
  s.textContent = code;
  window.document.body.appendChild(s);
  await tick();
  check('posts {ready}', () => assert.ok(posted.some(m => m.type === 'ready')));

  window.dispatchEvent(new window.MessageEvent('message', { data: { type: 'data', payload: PAYLOAD } }));
  await tick();
  const text = window.document.body.textContent;

  check('renders header + totals', () => {
    assert.ok(text.includes('Work Orders'), 'scope missing');
    assert.ok(text.includes('build.mfgx'), 'env missing');
    assert.ok(text.includes('passed'), 'totals missing');
  });
  check('renders steps, defects, ux notes', () => {
    assert.ok(text.includes('Create'), 'step missing');
    assert.ok(text.includes('Create returns 500'), 'defect missing');
    assert.ok(text.includes('flatten to 2 levels'), 'ux note missing');
  });
  check('renders Fuuz logs', () => {
    assert.ok(text.includes('ERP timeout'), 'log missing');
    assert.ok(text.includes('integration-log'), 'log source missing');
  });
  check('evidence link posts {openFile}', () => {
    const link = [...window.document.querySelectorAll('a.link')].find(a => a.textContent.includes('artifacts/create.png'));
    assert.ok(link, 'evidence link missing');
    link.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const msg = posted.find(m => m.type === 'openFile');
    assert.ok(msg && msg.path === 'artifacts/create.png', 'openFile not posted');
  });

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
