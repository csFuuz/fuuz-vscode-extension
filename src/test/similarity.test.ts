import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, shingles, jaccard, clusterBySimilarity, SimMember } from '../qa/similarity';

test('tokenize drops comments and collapses string literals', () => {
  const toks = tokenize('var x = "hello world"; // a comment\n/* block */ return x;');
  assert.ok(toks.includes('var'));
  assert.ok(toks.includes('str')); // string literal collapsed
  assert.ok(!toks.includes('comment'));
  assert.ok(!toks.includes('block'));
});

test('jaccard: identical = 1, disjoint = 0', () => {
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['a', 'b'])), 1);
  assert.equal(jaccard(new Set(['a']), new Set(['b'])), 0);
  assert.ok(jaccard(shingles(tokenize('a b c d e')), shingles(tokenize('a b c d x'))) > 0.3);
});

test('clusterBySimilarity groups near-duplicate scripts spanning ≥2 flows', () => {
  const base = 'var items = input.items.map(function(i){ return { id: i.id, qty: i.qty }; }); return { items: items, count: items.length };';
  const drift = 'var items = input.items.map(function(i){ return { id: i.id, qty: i.qty }; }); return { items: items, total: items.length };';
  const members: SimMember<{ flow: string }>[] = [
    { id: 'A::1', text: base, meta: { flow: 'A' } },
    { id: 'B::1', text: drift, meta: { flow: 'B' } },
    { id: 'C::1', text: 'return 42;', meta: { flow: 'C' } },
  ];
  const clusters = clusterBySimilarity(members, m => m.meta.flow, 0.7, 3);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].members.length, 2);
  assert.ok(clusters[0].similarity >= 0.7);
});

test('clusterBySimilarity ignores duplicates within a single flow', () => {
  const text = 'var a = 1; var b = 2; return a + b;';
  const members: SimMember<{ flow: string }>[] = [
    { id: 'A::1', text, meta: { flow: 'A' } },
    { id: 'A::2', text, meta: { flow: 'A' } },
  ];
  assert.equal(clusterBySimilarity(members, m => m.meta.flow, 0.8, 3).length, 0);
});
