/**
 * Pure flow-diagram compliance analyzers, grounded in the real Fuuz node model
 * ({@link ./flowTypes}). Each returns a {@link RuleResult} so results render in
 * the shared compliance report. No VS Code/Node imports — fully unit-testable.
 *
 * Single-flow rules:
 *  - entry points surfaced (multiple `request` nodes = separate paths)
 *  - fork/collect balance (forks need NOT always recombine; collect batchCount
 *    should match its fork's branch count; orphan collects flagged)
 *  - saved script/query has a payload contract (validate node or shaping
 *    requestTransform — not a `$` pass-through into an input-schema'd transform)
 *  - query scoping (unfiltered non-setup queries → filter or paginate) and
 *    page-size / nested-result warnings (`first: > 500`)
 *  - node naming + descriptions + uniqueness, long inline scripts → saved script,
 *    `$integrate` in scripts → http node, hard-coded credentials, error handling,
 *    flow naming + release-notes (devops) gaps
 * Cross-flow: repeated inline queries → saved query; repeated inline scripts →
 * saved script.
 */
import { ComplianceReport, Finding, RuleResult, SEVERITY_ORDER } from './complianceTypes';
import { FlowGraph, FlowNode, FlowAnalysisContext } from './flowTypes';
import { lookupModel } from './modelContext';
import { judgeName } from './naming';

const rule = (ruleId: string, title: string, checks: number, passed: number, findings: Finding[]): RuleResult =>
  ({ ruleId, title, checks, passed, findings });

const where = (n: FlowNode) => n.name || n.id;
const byKind = (g: FlowGraph, k: FlowNode['kind']) => g.nodes.filter(n => n.kind === k);
/** Inline scripts whose body we can inspect (JS + JSONata). */
const inlineScripts = (g: FlowGraph) => g.nodes.filter(n => (n.kind === 'inlineScript' || n.kind === 'jsonata') && typeof n.script === 'string' && n.script.trim());

/** Hard-coded credential assignment, e.g. `apiKey = "abc123"`. */
const CRED_LITERAL = /\b(api[_-]?key|secret|client[_-]?secret|password|passwd|pwd|passphrase|token|bearer|private[_-]?key|access[_-]?key|authorization)\b\s*[:=]\s*['"`][^'"`]{4,}['"`]/i;

const PASS_THROUGH = (t: string | undefined) => { const s = (t ?? '').trim(); return s === '' || s === '$'; };

const LARGE_RECORD_COUNT = 5000;
const BIG_PAGE = 500;

// --- single-flow rules ----------------------------------------------------

/** Surface entry points. Multiple `request` nodes = separate entry paths. */
function entryPoints(g: FlowGraph): RuleResult {
  const entries = byKind(g, 'entry');
  const requests = entries.filter(n => n.entryType === 'request');
  const findings: Finding[] = [];
  if (requests.length > 1) {
    findings.push({
      ruleId: 'flow-entry-points', severity: 'info',
      message: `${requests.length} request entry points (separate paths): ${requests.map(where).join(', ')} — confirm each path is intended`,
    });
  }
  for (const e of entries.filter(n => n.entryType && n.entryType !== 'request')) {
    findings.push({ ruleId: 'flow-entry-points', severity: 'info', message: `Trigger entry "${where(e)}" (${e.entryType})`, where: where(e) });
  }
  return rule('flow-entry-points', 'Entry points surfaced', 1, 1, findings);
}

/**
 * Forks fan out to parallel paths; they need NOT always recombine. We surface
 * forks, flag a collect whose declared batch count doesn't match its fork's
 * branch count, and flag orphan collects (a collect with no fork).
 */
function forkCollectBalance(g: FlowGraph): RuleResult {
  const forks = byKind(g, 'fork');
  const collects = byKind(g, 'collect');
  const findings: Finding[] = [];
  let checks = 0, passed = 0;

  for (const f of forks) {
    findings.push({ ruleId: 'flow-fork-collect', severity: 'info', message: `Fork "${where(f)}" fans out to ${f.branchCount ?? '?'} parallel path(s)`, where: where(f) });
  }

  // Orphan collect: a collect with no fork in the flow.
  if (collects.length && forks.length === 0) {
    checks++;
    findings.push({ ruleId: 'flow-fork-collect', severity: 'warn', message: `${collects.length} collect node(s) but no fork — a collect joins forked paths`, fix: 'Remove the orphan collect or add the fork it should join.' });
  } else if (collects.length || forks.length) {
    checks++; passed++;
  }

  // When there's a single fork+collect pair, the join count should match the fan-out.
  if (forks.length === 1 && collects.length === 1) {
    checks++;
    const fan = forks[0].branchCount ?? 0;
    const join = collects[0].collectBatchCount ?? 0;
    if (fan && join && fan !== join) {
      findings.push({
        ruleId: 'flow-fork-collect', severity: 'warn',
        message: `Fork "${where(forks[0])}" fans out ${fan} branch(es) but collect "${where(collects[0])}" expects ${join}`,
        where: where(collects[0]), fix: 'Make the collect batch count match the number of forked branches.',
      });
    } else passed++;
  }
  return rule('flow-fork-collect', 'Fork/collect balance (parallel paths may stay separate)', checks || 1, checks ? passed : 1, findings);
}

/** Every node has a meaningful (non-default) name. */
function nodeNaming(g: FlowGraph): RuleResult {
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of g.nodes) {
    const v = judgeName(n.name, 'Node');
    if (!v.ambiguous) passed++;
    else findings.push({ ruleId: 'flow-node-naming', severity: 'warn', message: v.reason!, where: where(n), fix: 'Rename to describe what the node does (use “Rename Flow Nodes”).' });
  }
  return rule('flow-node-naming', 'Nodes are clearly named', g.nodes.length || 1, g.nodes.length ? passed : 1, findings);
}

/** Every node has a description. */
function nodeDescriptions(g: FlowGraph): RuleResult {
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of g.nodes) {
    if ((n.description ?? '').trim()) passed++;
    else findings.push({ ruleId: 'flow-node-descriptions', severity: 'info', message: `Node "${where(n)}" has no description`, where: where(n), fix: 'Add a short description (use “Add Node Descriptions”).' });
  }
  return rule('flow-node-descriptions', 'Nodes have descriptions', g.nodes.length || 1, g.nodes.length ? passed : 1, findings);
}

/** Node names are unique within the flow. */
function duplicateNames(g: FlowGraph): RuleResult {
  const seen = new Map<string, number>();
  for (const n of g.nodes) {
    const k = (n.name ?? '').trim().toLowerCase();
    if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k);
  return rule('flow-duplicate-names', 'Node names are unique', 1, dups.length ? 0 : 1,
    dups.map(d => ({ ruleId: 'flow-duplicate-names', severity: 'warn', message: `Duplicate node name "${d}"`, fix: 'Give each node a distinct name.' })));
}

/** Long inline scripts (>100 lines) should become saved scripts. */
function longScripts(g: FlowGraph): RuleResult {
  const ss = byKind(g, 'inlineScript').filter(n => typeof n.script === 'string');
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of ss) {
    const lines = n.script!.split('\n').length;
    if (lines <= 100) passed++;
    else findings.push({ ruleId: 'flow-long-scripts', severity: 'warn', message: `Script node "${where(n)}" is ${lines} lines`, where: where(n), fix: 'Convert to a Saved Script and reference it (reuse + testability + a declared input schema).' });
  }
  return rule('flow-long-scripts', 'Inline scripts are reasonably sized', ss.length || 1, ss.length ? passed : 1, findings);
}

/**
 * A saved script/query should be fed a payload contract. A `savedTransformV2`
 * whose requestTransform is a `$` pass-through (no shaping) AND whose flow has no
 * `validate` node is a risk — escalated when the referenced saved transform
 * declares an input schema.
 */
function savedContract(g: FlowGraph, ctx?: FlowAnalysisContext): RuleResult {
  const saved = byKind(g, 'savedTransform');
  const hasValidate = byKind(g, 'validate').length > 0;
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of saved) {
    const passthrough = PASS_THROUGH(n.requestTransform);
    const info = n.savedRef?.id ? ctx?.savedTransforms?.get(n.savedRef.id) : undefined;
    const declaresContract = info?.hasInputSchema === true;
    if (!passthrough || hasValidate) { passed++; continue; }
    findings.push({
      ruleId: 'flow-saved-contract',
      severity: declaresContract ? 'warn' : 'info',
      message: declaresContract
        ? `Saved script "${n.savedRef?.name ?? where(n)}" receives the whole context ($) but declares an input schema — no payload contract`
        : `Saved script/query "${where(n)}" receives the whole context ($) with no validation`,
      where: where(n),
      fix: 'Add a Validate (payload-contract) node before it, or a request transform that maps to the saved transform’s input schema.',
    });
  }
  return rule('flow-saved-contract', 'Saved scripts/queries get a payload contract', saved.length || 1, saved.length ? passed : 1, findings);
}

/** Root model field tokens selected at the top level of a GraphQL query. */
export function rootModelsOf(query: string): string[] {
  const out: string[] = [];
  let depth = 0, i = 0;
  const open = query.indexOf('{');
  if (open < 0) return out;
  i = open;
  for (; i < query.length; i++) {
    const ch = query[i];
    if (ch === '{') { depth++; continue; }
    if (ch === '}') { depth--; continue; }
    if (depth === 1 && /[A-Za-z_]/.test(ch)) {
      // read an identifier; it may be `alias: model` or `model`
      let j = i; let first = '';
      while (j < query.length && /[A-Za-z0-9_]/.test(query[j])) first += query[j++];
      let k = j; while (k < query.length && /\s/.test(query[k])) k++;
      let model = first;
      if (query[k] === ':') {
        k++; while (k < query.length && /\s/.test(query[k])) k++;
        let second = ''; while (k < query.length && /[A-Za-z0-9_]/.test(query[k])) second += query[k++];
        model = second || first;
        while (k < query.length && /\s/.test(query[k])) k++;
        j = k;
      }
      // only a root selection if followed by `(` (args) or `{` (subselection)
      let m = j; while (m < query.length && /\s/.test(query[m])) m++;
      if ((query[m] === '(' || query[m] === '{') && model) out.push(model);
      i = j - 1;
    }
  }
  return [...new Set(out)];
}

/**
 * Query scoping: a query with no variable transform and no `where:` filter
 * returns everything. That's fine for `setup` models (limited records) but a
 * risk for master/transactional models — recommend a filter or a pagination
 * cycle, escalated when the model is known to be large.
 */
function queryScoping(g: FlowGraph, ctx?: FlowAnalysisContext): RuleResult {
  const queries = byKind(g, 'query');
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of queries) {
    const q = n.query ?? '';
    const hasVarTransform = !PASS_THROUGH(n.variablesTransform);
    const hasWhere = /\bwhere\s*:/.test(q) && !/\bwhere\s*:\s*\{\s*\}/.test(q);
    if (hasWhere || hasVarTransform) { passed++; continue; }

    const roots = rootModelsOf(q);
    const infos = roots.map(r => lookupModel(ctx, r)).filter(Boolean) as { type?: string; recordCount?: number; name: string }[];
    const allSetup = infos.length > 0 && infos.every(m => m.type === 'setup');
    if (allSetup) { passed++; continue; } // limited records — unfiltered is acceptable

    const large = infos.find(m => (m.recordCount ?? 0) > LARGE_RECORD_COUNT);
    const target = roots.length ? roots.join(', ') : 'a model';
    findings.push({
      ruleId: 'flow-query-scoping',
      severity: large ? 'error' : 'warn',
      message: large
        ? `Unfiltered query "${where(n)}" on ${large.name} (~${large.recordCount} records) — will return everything`
        : `Unfiltered query "${where(n)}" (no where filter / variable transform) on ${target}`,
      where: where(n),
      fix: 'Add a where filter scoped to the request, or implement a pagination cycle (store each page in context, track nextPage, loop until exhausted). Exception: setup-type models.',
    });
  }
  return rule('flow-query-scoping', 'Queries are scoped (or paginated) on non-setup models', queries.length || 1, queries.length ? passed : 1, findings);
}

/** Large page sizes / nested result sets make long-running queries. */
function queryPageSize(g: FlowGraph): RuleResult {
  const queries = byKind(g, 'query');
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of queries) {
    const q = n.query ?? '';
    const firsts = [...q.matchAll(/\bfirst\s*:\s*(\d+)/g)].map(m => Number(m[1]));
    const maxFirst = firsts.length ? Math.max(...firsts) : 0;
    const nested = (q.match(/edges\s*\{/g)?.length ?? 0) > 1;
    if (maxFirst <= BIG_PAGE) { passed++; continue; }
    findings.push({
      ruleId: 'flow-query-pagesize', severity: 'warn',
      message: `Query "${where(n)}" requests first: ${maxFirst} (>${BIG_PAGE})${nested ? ' with nested result sets' : ''} — potential long-running query`,
      where: where(n),
      fix: nested ? 'Narrow the page size and/or paginate; avoid deep nested edges in one pull.' : 'Lower the page size or paginate the results.',
    });
  }
  return rule('flow-query-pagesize', 'Queries avoid oversized result sets', queries.length || 1, queries.length ? passed : 1, findings);
}

/** Flow has error handling: a try/catch node, or try/catch in an inline script. */
function errorHandling(g: FlowGraph): RuleResult {
  const hasTryCatchNode = byKind(g, 'tryCatch').length > 0;
  const hasScriptTryCatch = inlineScripts(g).some(n => /\btry\b[\s\S]*\bcatch\b/.test(n.script!));
  const ok = hasTryCatchNode || hasScriptTryCatch;
  return rule('flow-error-handling', 'Has error handling (try/catch node or in-script try/catch)', 1, ok ? 1 : 0,
    ok ? [] : [{ ruleId: 'flow-error-handling', severity: 'warn', message: 'No try/catch node and no in-script try/catch', fix: 'Wrap risky logic in a Try/Catch node and return an error response.' }]);
}

/** Inline scripts must not call `$integrate` — use an http node + Connection. */
function integrateInScript(g: FlowGraph): RuleResult {
  const ss = inlineScripts(g);
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of ss) {
    if (!/\$integrate\b/.test(n.script!)) passed++;
    else findings.push({ ruleId: 'flow-integrate-in-script', severity: 'error', message: `Script node "${where(n)}" calls $integrate`, where: where(n), fix: 'Replace in-script $integrate with an HTTP (integration) node + Connection.' });
  }
  return rule('flow-integrate-in-script', 'Scripts do not call $integrate', ss.length || 1, ss.length ? passed : 1, findings);
}

/** Hard-coded credentials in inline scripts are a security risk. */
function credentialsInScript(g: FlowGraph): RuleResult {
  const ss = inlineScripts(g);
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of ss) {
    if (!CRED_LITERAL.test(n.script!)) passed++;
    else findings.push({ ruleId: 'flow-credentials', severity: 'error', message: `Script node "${where(n)}" appears to hard-code a credential (key/token/password)`, where: where(n), fix: 'Move secrets to a Connection; never embed api keys/tokens/passwords in scripts.' });
  }
  return rule('flow-credentials', 'No hard-coded credentials in scripts', ss.length || 1, ss.length ? passed : 1, findings);
}

/** Misc inline-script anti-patterns: hard-coded URLs and leftover console logging. */
function scriptAntiPatterns(g: FlowGraph): RuleResult {
  const ss = inlineScripts(g);
  const findings: Finding[] = [];
  let checks = 0, passed = 0;
  for (const n of ss) {
    checks++;
    const url = /https?:\/\/[^\s'"`)]+/.test(n.script!);
    const log = /console\.(log|debug|info|warn|error)\s*\(/.test(n.script!);
    if (!url && !log) { passed++; continue; }
    if (url) findings.push({ ruleId: 'flow-script-antipatterns', severity: 'warn', message: `Script node "${where(n)}" hard-codes a URL`, where: where(n), fix: 'Use a Connection / config value instead of a literal URL.' });
    if (log) findings.push({ ruleId: 'flow-script-antipatterns', severity: 'info', message: `Script node "${where(n)}" leaves console logging in`, where: where(n), fix: 'Remove console.* or use flow logging.' });
  }
  return rule('flow-script-antipatterns', 'Scripts avoid hard-coded URLs / stray logging', checks || 1, checks ? passed : 1, findings);
}

/** Flow name is clear (not a placeholder / ambiguous). */
function flowNaming(g: FlowGraph): RuleResult {
  const v = judgeName(g.name, 'Flow');
  return rule('flow-naming', 'Flow is clearly named', 1, v.ambiguous ? 0 : 1,
    v.ambiguous ? [{ ruleId: 'flow-naming', severity: 'warn', message: v.reason!, fix: 'Rename the flow to describe its purpose.' }] : []);
}

/** Latest deployed version should carry release/version notes (devops). */
function versionNotes(g: FlowGraph): RuleResult {
  const versions = g.versions ?? [];
  if (versions.length === 0) return rule('flow-version-notes', 'Has release/version notes', 0, 0, []);
  const deployed = versions.filter(v => v.deployed);
  const pool = deployed.length ? deployed : versions;
  const withNotes = pool.filter(v => (v.description ?? '').trim()).length;
  const ok = withNotes > 0;
  return rule('flow-version-notes', 'Has release/version notes', 1, ok ? 1 : 0,
    ok ? [] : [{ ruleId: 'flow-version-notes', severity: 'info', message: `No release/version notes across ${pool.length} version(s) — a devops/process gap`, fix: 'Add a description to each deployed version describing what changed.' }]);
}

/** All single-flow rules. */
export function analyzeFlow(g: FlowGraph, ctx?: FlowAnalysisContext): RuleResult[] {
  return [
    entryPoints(g),
    forkCollectBalance(g),
    savedContract(g, ctx),
    queryScoping(g, ctx),
    queryPageSize(g),
    nodeNaming(g),
    nodeDescriptions(g),
    duplicateNames(g),
    longScripts(g),
    errorHandling(g),
    integrateInScript(g),
    credentialsInScript(g),
    scriptAntiPatterns(g),
    flowNaming(g),
    versionNotes(g),
  ];
}

function toReport(name: string, rules: RuleResult[]): ComplianceReport {
  const checks = rules.reduce((n, r) => n + r.checks, 0);
  const passed = rules.reduce((n, r) => n + r.passed, 0);
  const findings = rules.flatMap(r => r.findings).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { kind: 'flow', name, score: checks === 0 ? 100 : Math.round((passed / checks) * 100), checks, passed, rules, findings };
}

export function runFlowGraphCompliance(g: FlowGraph, ctx?: FlowAnalysisContext): ComplianceReport {
  return toReport(g.name, analyzeFlow(g, ctx));
}

// --- cross-flow rules -----------------------------------------------------

/** Collapse whitespace/comments so equivalent scripts/queries compare equal. */
export function normalizeScript(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look across many flows for repetition worth extracting:
 *  - the same inline query in ≥2 flows → suggest a Saved Query
 *  - the same non-trivial inline script in ≥2 flows → suggest a Saved Script
 */
export function analyzeFlowsCrossCutting(graphs: FlowGraph[]): ComplianceReport {
  const queryFlows = new Map<string, { flows: Set<string>; sample: string }>();
  const scriptFlows = new Map<string, { flows: Set<string>; sample: string }>();

  for (const g of graphs) {
    for (const n of g.nodes) {
      if (n.kind === 'query' && n.query) {
        const norm = normalizeScript(n.query);
        if (norm.length < 40) continue;
        if (!queryFlows.has(norm)) queryFlows.set(norm, { flows: new Set(), sample: where(n) });
        queryFlows.get(norm)!.flows.add(g.name);
      }
      if (n.kind === 'inlineScript' && n.script) {
        const norm = normalizeScript(n.script);
        if (norm.length < 60) continue;
        if (!scriptFlows.has(norm)) scriptFlows.set(norm, { flows: new Set(), sample: where(n) });
        scriptFlows.get(norm)!.flows.add(g.name);
      }
    }
  }

  const qFindings: Finding[] = [];
  for (const [, { flows, sample }] of queryFlows) if (flows.size >= 2) {
    qFindings.push({ ruleId: 'flow-shared-query', severity: 'warn', message: `A query (e.g. "${sample}") appears in ${flows.size} flows (${[...flows].join(', ')})`, fix: 'Convert to a Saved Query and reference it from each flow.' });
  }
  const sFindings: Finding[] = [];
  for (const [, { flows, sample }] of scriptFlows) if (flows.size >= 2) {
    sFindings.push({ ruleId: 'flow-shared-script', severity: 'warn', message: `A script (e.g. "${sample}") is duplicated across ${flows.size} flows (${[...flows].join(', ')})`, fix: 'Convert to a Saved Script and reference it from each flow.' });
  }

  const rules: RuleResult[] = [
    rule('flow-shared-query', 'Repeated queries extracted to Saved Queries', queryFlows.size || 1, (queryFlows.size || 1) - qFindings.length, qFindings),
    rule('flow-shared-script', 'Repeated scripts extracted to Saved Scripts', scriptFlows.size || 1, (scriptFlows.size || 1) - sFindings.length, sFindings),
  ];
  return toReport(`All flows (${graphs.length})`, rules);
}
