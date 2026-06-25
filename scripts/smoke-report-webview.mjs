// Headless smoke test for the QA report webview. Loads the real built
// media/report/report.js into jsdom, feeds it a ComplianceReport, and asserts
// the gauge, findings, and rule table render.
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(dir, '..', 'media', 'report', 'report.js'), 'utf8');
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

const dom = new JSDOM(`<!DOCTYPE html><html class="vscode-dark"><body><div id="root"></div></body></html>`, {
  runScripts: 'dangerously', pretendToBeVisual: true,
});
const { window } = dom;
const posted = [];
window.acquireVsCodeApi = () => ({ postMessage: m => posted.push(m) });

const REPORT = {
  kind: 'dataModel', name: 'WorkOrder', score: 86, checks: 50, passed: 43,
  rules: [
    { ruleId: 'id-primary-key', title: 'Has an `id: ID!` primary key', checks: 1, passed: 1, findings: [] },
    { ruleId: 'fk-relation-pairing', title: 'Foreign keys pair with object relations', checks: 4, passed: 2, findings: [] },
  ],
  findings: [
    { ruleId: 'fk-relation-pairing', severity: 'warn', message: 'Foreign key `ownerId` has no object relation `owner`', where: 'ownerId', fix: 'Add an object relation `owner`.' },
    { ruleId: 'field-descriptions', severity: 'info', message: 'Field `note` has no description', where: 'note' },
  ],
};

let failures = 0;
const check = (label, fn) => { try { fn(); console.log(`  ✓ ${label}`); } catch (e) { failures++; console.error(`  ✗ ${label}\n      ${e.message}`); } };

async function main() {
  const s = window.document.createElement('script');
  s.textContent = code;
  window.document.body.appendChild(s);
  await tick();

  check('posts {ready} on mount', () => assert.ok(posted.some(m => m.type === 'ready')));

  window.dispatchEvent(new window.MessageEvent('message', { data: { type: 'report', report: REPORT } }));
  await tick();
  const text = window.document.body.textContent;

  check('renders score + verdict', () => {
    assert.ok(text.includes('86%'), 'score missing');
    assert.ok(text.includes('WorkOrder'), 'name missing');
    assert.ok(text.includes('43/50 checks passed'), 'check counts missing');
  });
  check('renders findings with fix', () => {
    assert.ok(text.includes('has no object relation'), 'finding missing');
    assert.ok(text.includes('Fix:'), 'fix missing');
  });
  check('renders rule table', () => {
    assert.ok(text.includes('Foreign keys pair with object relations'), 'rule row missing');
  });
  check('Re-check button posts {recheck}', () => {
    const btn = [...window.document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Re-check');
    assert.ok(btn, 'Re-check button missing');
    btn.click();
    assert.ok(posted.some(m => m.type === 'recheck'), 'no recheck posted');
  });

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
