import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_SYSTEM_VERSION, renderDesignSystemDoc } from '../util/designSystem';

test('renderDesignSystemDoc: states the apply-by-default rule with the escape hatch', () => {
  const doc = renderDesignSystemDoc();
  assert.match(doc, /by default/i);
  assert.match(doc, /unless the user explicitly\s+>?\s*asks for something unique/i);
});

test('renderDesignSystemDoc: pins the canonical tokens and forbids the old ones', () => {
  const doc = renderDesignSystemDoc();
  // Required identity
  assert.match(doc, /DM Sans/);
  assert.match(doc, /DM Mono/);
  assert.match(doc, /#5B30DF/); // violet accent
  assert.match(doc, /#2A2A2E/i); // neutral-gray base
  // Anti-patterns called out by name
  assert.match(doc, /Never Roboto/i);
  assert.match(doc, /not slate-blue/i);
  assert.match(doc, /old blue `#3B82F6`/);
});

test('renderDesignSystemDoc: ships the paste-ready helper that reads live tokens', () => {
  const doc = renderDesignSystemDoc();
  assert.match(doc, /function fuuzTheme\(isDark\)/);
  assert.match(doc, /\$appConfig\.designSystem/);
  // Sandbox constraints honored: no const/let/optional-chaining in the helper.
  const helper = doc.slice(doc.indexOf('function fuuzTheme'));
  const fenceEnd = helper.indexOf('```');
  const code = helper.slice(0, fenceEnd);
  assert.doesNotMatch(code, /\bconst\b|\blet\b/);
  assert.doesNotMatch(code, /\?\./);
});

test('DESIGN_SYSTEM_VERSION is a semver string', () => {
  assert.match(DESIGN_SYSTEM_VERSION, /^\d+\.\d+\.\d+$/);
});
