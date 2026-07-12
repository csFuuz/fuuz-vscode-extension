import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUatModel, renderUatMarkdown, renderUatWordHtml, UatInput } from '../qa/uatDoc';

const input: UatInput = {
  appName: 'Work Orders',
  tenantName: 'Acme',
  roleName: 'Operator',
  targetUrl: 'https://app.fuuz.com',
  generatedAt: '2026-07-01T00:00:00.000Z',
  steps: [
    {
      title: 'Create a work order',
      action: 'Click "New" on the Work Orders screen',
      data: 'Name: WO-1001',
      expected: 'A new work order is saved and appears in the list',
    },
  ],
};

test('buildUatModel: prepends a login step as step 1 and lists login in prerequisites', () => {
  const m = buildUatModel(input);
  assert.equal(m.steps[0].title, 'Log in to Fuuz');
  assert.match(m.steps[0].action, /https:\/\/app\.fuuz\.com/);
  assert.match(m.steps[0].action, /Operator/);
  assert.match(m.steps[0].expected, /Operator/);
  assert.equal(m.steps.length, input.steps.length + 1);
  assert.match(m.prerequisites[0], /Log in to Fuuz at https:\/\/app\.fuuz\.com as a Operator user/);
  assert.ok(m.signoff.statement.length > 0);
});

test('renderUatMarkdown: contains the step table, sign-off and signature lines', () => {
  const md = renderUatMarkdown(buildUatModel(input));
  assert.match(md, /\| Step \| Action \| Data \| Expected \| Pass\/Fail \| Notes \|/);
  assert.match(md, /Create a work order/);
  assert.match(md, /## Sign-off/);
  assert.match(md, /Tester/);
  assert.match(md, /Approver/);
  assert.match(md, /Signature: _+/);
});

test('renderUatWordHtml: is a Word-openable doc with a table and both signature blocks', () => {
  const html = renderUatWordHtml(buildUatModel(input));
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.match(html, /<table/);
  assert.match(html, />Tester</);
  assert.match(html, />Approver</);
  assert.match(html, /Name:/);
  assert.match(html, /Signature:/);
  assert.match(html, /Date:/);
});

test('renderUatWordHtml: escapes HTML in user-provided step titles', () => {
  const m = buildUatModel({
    ...input,
    steps: [
      {
        title: '<script>alert(1)</script>',
        action: 'do a thing',
        expected: 'ok',
      },
    ],
  });
  const html = renderUatWordHtml(m);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('renderUatWordHtml: embeds an <img> when a screenshot is provided', () => {
  const m = buildUatModel({
    ...input,
    steps: [
      {
        title: 'Open dashboard',
        action: 'Click Dashboard',
        expected: 'Dashboard loads',
        screenshot: 'data:image/png;base64,AAAA',
      },
    ],
  });
  const html = renderUatWordHtml(m);
  assert.match(html, /<img src="data:image\/png;base64,AAAA"/);
});
