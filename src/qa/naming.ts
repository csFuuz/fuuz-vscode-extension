/**
 * Shared naming-convention heuristics for flows, screens, scripts and queries.
 * Ambiguous or placeholder names are a maintenance risk — they make a tenant
 * hard to navigate and review. Pure + dependency-free so analyzers and tests can
 * use it directly.
 */

/** Placeholder/scaffold names the Fuuz editor leaves behind. */
const PLACEHOLDER = /^(new\s+(screen|flow|data\s*flow|node|element|form|table|query|script)|untitled|test|temp|tmp|copy(\s+of)?|draft|sample|example|foo|bar|baz|asdf|xxx|todo|wip|change\s*me|placeholder)\b/i;

/** Default node labels the editor assigns by node type (clear intent NOT conveyed). */
const DEFAULT_NODE = /^(node|element|step|script|query|branch|collect|broadcast|fork|response|request|route|transform|jsonata|if\s*else|switch|http|saved\s+script|log|mutate|set\s*context|merge\s*context)[\s_-]*\d*$/i;

/** Words that on their own convey nothing about purpose. */
const VAGUE_WORDS = new Set(['data', 'info', 'stuff', 'thing', 'misc', 'general', 'main', 'new', 'old', 'final', 'final2', 'v1', 'v2', 'test', 'temp', 'do', 'handler', 'process', 'logic', 'helper', 'util']);

export type NameRisk = 'placeholder' | 'too-short' | 'vague' | 'numbered-copy' | 'non-descriptive';

export interface NameVerdict {
  ambiguous: boolean;
  risk?: NameRisk;
  reason?: string;
}

/**
 * Judge a human-facing name. `kind` only tweaks the message. We flag names that
 * are empty/very short, scaffold placeholders, trailing-number copies
 * ("Flow 2", "Form Copy"), or a single vague word.
 */
export function judgeName(raw: string | undefined, kind = 'item'): NameVerdict {
  const name = (raw ?? '').trim();
  if (!name) return { ambiguous: true, risk: 'placeholder', reason: `${kind} has no name` };
  if (PLACEHOLDER.test(name)) return { ambiguous: true, risk: 'placeholder', reason: `"${name}" looks like a scaffold/placeholder name` };
  if (DEFAULT_NODE.test(name)) return { ambiguous: true, risk: 'non-descriptive', reason: `"${name}" is a default node label — describe what it does` };
  if (name.replace(/[^a-z0-9]/gi, '').length < 3) return { ambiguous: true, risk: 'too-short', reason: `"${name}" is too short to be descriptive` };
  if (/\b(copy|copy\s*\d+|\(\d+\)|\bv?\d+)$/i.test(name) && name.split(/\s+/).length <= 2) {
    return { ambiguous: true, risk: 'numbered-copy', reason: `"${name}" looks like a duplicated/versioned copy` };
  }
  const words = name.split(/[\s_-]+/).filter(Boolean);
  if (words.length === 1 && VAGUE_WORDS.has(words[0].toLowerCase())) {
    return { ambiguous: true, risk: 'vague', reason: `"${name}" is a single vague word` };
  }
  return { ambiguous: false };
}

/** True when a name should be flagged. */
export function isAmbiguousName(raw: string | undefined, kind = 'item'): boolean {
  return judgeName(raw, kind).ambiguous;
}
