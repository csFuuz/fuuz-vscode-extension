/**
 * Lightweight textual similarity for finding *highly similar* (not just identical)
 * scripts/queries embedded across flows — so near-duplicates that drifted apart
 * still get surfaced for extraction into a Saved Script / Saved Query.
 *
 * Approach: normalize → tokenize → k-shingle → Jaccard similarity, then cluster
 * with union-find (transitively similar items group together). Pure + testable.
 */

/** Lowercase tokens of identifiers/operators; comments/whitespace dropped. */
export function tokenize(src: string): string[] {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, ' "str" ') // collapse string literals
    .toLowerCase()
    .split(/[^a-z0-9_$]+/)
    .filter(t => t.length > 0);
}

/** Set of k-token shingles (sliding window) — captures local structure. */
export function shingles(tokens: string[], k = 3): Set<string> {
  const out = new Set<string>();
  if (tokens.length < k) { if (tokens.length) out.add(tokens.join(' ')); return out; }
  for (let i = 0; i + k <= tokens.length; i++) out.add(tokens.slice(i, i + k).join(' '));
  return out;
}

/** Jaccard similarity |A∩B| / |A∪B| of two sets (0..1). */
export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface SimMember<T> { id: string; text: string; meta: T; }
export interface SimCluster<T> { members: SimMember<T>[]; similarity: number; }

/** Default cap on members compared, bounding the O(n²) pairwise scan. */
const DEFAULT_MAX_MEMBERS = 500;

export interface ClusterOptions {
  /** Max members compared before truncating (default 500). */
  maxMembers?: number;
  /** Called with a one-line note when truncation occurs (no silent drops). */
  note?: (msg: string) => void;
}

/**
 * Group members whose pairwise shingle-Jaccard ≥ `threshold` (transitive).
 * Returns only clusters of 2+ members spanning 2+ distinct `groupOf` values
 * (e.g. 2+ flows), with the cluster's minimum observed pairwise similarity.
 *
 * The pairwise scan is O(n²); above `maxMembers` it compares only the first
 * `maxMembers` and reports the truncation via `note` (callers log it).
 */
export function clusterBySimilarity<T>(
  members: SimMember<T>[],
  groupOf: (m: SimMember<T>) => string,
  threshold = 0.8,
  k = 3,
  opts: ClusterOptions = {},
): SimCluster<T>[] {
  const maxMembers = opts.maxMembers ?? DEFAULT_MAX_MEMBERS;
  let used = members;
  if (members.length > maxMembers) {
    used = members.slice(0, maxMembers);
    opts.note?.(`similarity: compared the first ${maxMembers} of ${members.length} snippets to bound the O(n²) scan — ${members.length - maxMembers} not compared.`);
  }

  const n = used.length;
  const shs = used.map(m => shingles(tokenize(m.text), k));
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => { parent[find(a)] = find(b); };

  // Cache every pairwise score so the per-cluster min-similarity pass below
  // reuses them instead of recomputing Jaccard a second time.
  const pairSim = new Map<number, number>();
  const pairKey = (i: number, j: number) => i * n + j; // i < j
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = jaccard(shs[i], shs[j]);
      pairSim.set(pairKey(i, j), s);
      if (s >= threshold) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }

  const clusters: SimCluster<T>[] = [];
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    const mem = idxs.map(i => used[i]);
    if (new Set(mem.map(groupOf)).size < 2) continue; // must span ≥2 flows
    // min pairwise similarity within the cluster (lower bound on "how similar"),
    // reusing the first-pass scores.
    let minSim = 1;
    for (let a = 0; a < idxs.length; a++) for (let b = a + 1; b < idxs.length; b++) {
      const [lo, hi] = idxs[a] < idxs[b] ? [idxs[a], idxs[b]] : [idxs[b], idxs[a]];
      minSim = Math.min(minSim, pairSim.get(pairKey(lo, hi)) ?? 1);
    }
    clusters.push({ members: mem, similarity: Math.round(minSim * 100) / 100 });
  }
  return clusters.sort((a, b) => b.members.length - a.members.length);
}
