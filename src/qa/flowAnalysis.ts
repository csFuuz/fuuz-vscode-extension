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
import { judgeName, humanize, scriptTitle, savedName } from './naming';
import { clusterBySimilarity, SimMember } from './similarity';

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
const LONG_SCRIPT_LINES = 300;
const SIMILARITY_THRESHOLD = 0.8;

/**
 * A heuristic display name for a node, used to seed rename suggestions. Claude
 * refines these against full context in the fix plan.
 */
export function suggestNodeName(n: FlowNode): string {
  switch (n.kind) {
    case 'query': {
      const roots = rootModelsOf(n.query ?? '');
      return roots.length ? `Query ${roots.slice(0, 2).map(humanize).join(' & ')}` : 'Query';
    }
    case 'inlineScript':
    case 'jsonata':
      return scriptTitle(n.script) ?? (n.kind === 'jsonata' ? 'Transform' : 'Script');
    case 'savedTransform':
      return n.savedRef?.name ?? 'Saved Script';
    case 'http':
      return n.connectionName ? `HTTP ${humanize(n.connectionName)}` : 'HTTP Request';
    case 'entry':
      return n.entryType === 'request' ? 'Request' : humanize(n.entryType ?? 'Entry');
    case 'ifElse':
      return 'If/Else';
    case 'switch':
      return 'Route';
    case 'collect':
      return 'Collect';
    case 'fork':
      return 'Fork';
    case 'tryCatch':
      return 'Try/Catch';
    case 'response':
      return 'Response';
    case 'mutate':
      return 'Mutate';
    case 'validate':
      return 'Validate Payload';
    default:
      return humanize(n.rawType || 'Node');
  }
}

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
    else {
      const suggestion = suggestNodeName(n);
      findings.push({
        ruleId: 'flow-node-naming', severity: 'warn', where: where(n), targetId: n.id, suggestion,
        message: `${v.reason!} — suggested: “${suggestion}”`,
        fix: 'Rename to describe what the node does (Claude can refine + apply via system_data_flow_mutations).',
      });
    }
  }
  return rule('flow-node-naming', 'Nodes are clearly named', g.nodes.length || 1, g.nodes.length ? passed : 1, findings);
}

/** Every node has a description. */
function nodeDescriptions(g: FlowGraph): RuleResult {
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of g.nodes) {
    if ((n.description ?? '').trim()) passed++;
    else findings.push({ ruleId: 'flow-node-descriptions', severity: 'info', message: `Node "${where(n)}" has no description`, where: where(n), targetId: n.id, fix: 'Add a short description (Claude can generate + apply via system_data_flow_mutations).' });
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
    if (lines <= LONG_SCRIPT_LINES) passed++;
    else findings.push({
      ruleId: 'flow-long-scripts', severity: 'warn', where: where(n), targetId: n.id,
      suggestion: savedName(scriptTitle(n.script) ?? n.name ?? 'Extracted', 'Script'),
      message: `Script node "${where(n)}" is ${lines} lines (>${LONG_SCRIPT_LINES})`,
      fix: 'Extract to a Saved Script (declares an input schema, reusable + testable) and reference it via a savedTransformV2 node.',
    });
  }
  return rule('flow-long-scripts', `Inline scripts are reasonably sized (≤${LONG_SCRIPT_LINES} lines)`, ss.length || 1, ss.length ? passed : 1, findings);
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
      where: where(n), targetId: n.id,
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
      where: where(n), targetId: n.id,
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
      where: where(n), targetId: n.id,
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

/** Every mutexLock must have a matching mutexUnlock (else the flow can deadlock). */
function mutexBalance(g: FlowGraph): RuleResult {
  const locks = g.nodes.filter(n => n.rawType === 'mutexLock');
  const unlocks = g.nodes.filter(n => n.rawType === 'mutexUnlock');
  if (!locks.length && !unlocks.length) return rule('flow-mutex-balance', 'Mutex locks are balanced', 0, 0, []);
  const findings: Finding[] = [];
  if (locks.length > unlocks.length) {
    findings.push({ ruleId: 'flow-mutex-balance', severity: 'warn', message: `${locks.length} mutexLock but only ${unlocks.length} mutexUnlock — a lock left unreleased can stall the flow`, fix: 'Ensure every mutexLock has a matching mutexUnlock on ALL paths, including error / try-catch branches.' });
  } else if (unlocks.length > locks.length) {
    findings.push({ ruleId: 'flow-mutex-balance', severity: 'info', message: `${unlocks.length} mutexUnlock but only ${locks.length} mutexLock`, fix: 'Remove the extra unlock or add the matching lock.' });
  }
  return rule('flow-mutex-balance', 'Mutex locks are balanced', 1, findings.length ? 0 : 1, findings);
}

/** Multi-write flows should wrap their mutations in a transaction boundary. */
function transactionBoundary(g: FlowGraph): RuleResult {
  const mutates = byKind(g, 'mutate');
  if (mutates.length < 2) return rule('flow-transaction-boundary', 'Multi-write flows have a transaction boundary', 0, 0, []);
  const guarded = byKind(g, 'tryCatch').length > 0;
  return rule('flow-transaction-boundary', 'Multi-write flows have a transaction boundary', 1, guarded ? 1 : 0,
    guarded ? [] : [{ ruleId: 'flow-transaction-boundary', severity: 'warn', message: `Flow has ${mutates.length} mutation nodes but no Try/Catch boundary — a mid-flow failure can leave partial writes`, fix: 'Wrap the writes in a Try/Catch (and a mutex if they must be atomic) and return an error response on failure.' }]);
}

/** Saved-transform references should not point at a deprecated transform. */
function deprecatedRefs(g: FlowGraph, ctx?: FlowAnalysisContext): RuleResult {
  const saved = byKind(g, 'savedTransform');
  if (!saved.length || !ctx?.savedTransforms) return rule('flow-deprecated-ref', 'No deprecated saved-transform references', 0, 0, []);
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of saved) {
    const info = n.savedRef?.id ? ctx.savedTransforms.get(n.savedRef.id) : undefined;
    if (info?.deprecated) findings.push({ ruleId: 'flow-deprecated-ref', severity: 'warn', where: where(n), targetId: n.id, message: `Node "${where(n)}" references a deprecated saved transform "${n.savedRef?.name ?? n.savedRef?.id}"`, fix: 'Point this at the current saved transform (or its replacement) and redeploy.' });
    else passed++;
  }
  return rule('flow-deprecated-ref', 'No deprecated saved-transform references', saved.length, passed, findings);
}

/**
 * Building `create` mutation payloads (setting field values) in a script is a
 * data-import/integration risk — it bypasses trigger defaults and data-change
 * rules. Prefer defaults in triggers, or data-change-triggered flows.
 */
function createInScript(g: FlowGraph): RuleResult {
  const mutates = byKind(g, 'mutate');
  if (!mutates.length) return rule('flow-create-in-script', 'Create values come from triggers, not scripts', 0, 0, []);
  const ss = byKind(g, 'inlineScript').filter(n => typeof n.script === 'string');
  if (!ss.length) return rule('flow-create-in-script', 'Create values come from triggers, not scripts', 1, 1, []);
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of ss) {
    if (/\bcreate\s*:|\bwrapCreate\b|\{\s*create\b/.test(n.script!)) {
      findings.push({ ruleId: 'flow-create-in-script', severity: 'warn', where: where(n), targetId: n.id, message: `Script "${where(n)}" builds create payloads with field values — data-import/integration risk`, fix: 'Set creation defaults in the data model’s triggers (or use data-change-triggered flows) so imports/integrations cannot bypass them.' });
    } else passed++;
  }
  return rule('flow-create-in-script', 'Create values come from triggers, not scripts', ss.length, passed, findings);
}

/** Flows that error should return a standardized error response (consistent envelope). */
function errorResponseShape(g: FlowGraph): RuleResult {
  const errs = byKind(g, 'throwError').length > 0 || byKind(g, 'tryCatch').length > 0;
  if (!errs) return rule('flow-error-response', 'Returns a standardized error response', 0, 0, []);
  const hasResponse = byKind(g, 'response').length > 0;
  return rule('flow-error-response', 'Returns a standardized error response', 1, hasResponse ? 1 : 0,
    hasResponse ? [] : [{ ruleId: 'flow-error-response', severity: 'info', message: 'Flow throws/catches errors but has no response node returning a structured error', fix: 'Return a consistent error envelope (e.g. { success:false, code, message }) from a response node.' }]);
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
    mutexBalance(g),
    transactionBoundary(g),
    deprecatedRefs(g, ctx),
    createInScript(g),
    errorResponseShape(g),
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

interface CrossMeta { flow: string; node: string; nodeId: string; kind: 'query' | 'inlineScript'; rep: FlowNode; }

/** Collect inline snippets of a kind across flows (above a size floor). */
function collectSnippets(graphs: FlowGraph[], kind: 'query' | 'inlineScript', minLen: number): SimMember<CrossMeta>[] {
  const out: SimMember<CrossMeta>[] = [];
  for (const g of graphs) {
    for (const n of g.nodes) {
      if (n.kind !== kind) continue;
      const text = kind === 'query' ? n.query : n.script;
      if (!text || normalizeScript(text).length < minLen) continue;
      out.push({ id: `${g.name}::${n.id}`, text, meta: { flow: g.name, node: where(n), nodeId: n.id, kind, rep: n } });
    }
  }
  return out;
}

/**
 * Cross-flow analysis: find **highly similar** (not just identical) inline scripts
 * and queries embedded across flows, and suggest extracting each cluster into a
 * Saved Script / Saved Query referenced from every flow.
 */
export function analyzeFlowsCrossCutting(graphs: FlowGraph[]): ComplianceReport {
  const queries = collectSnippets(graphs, 'query', 40);
  const scripts = collectSnippets(graphs, 'inlineScript', 60);

  const qClusters = clusterBySimilarity(queries, m => m.meta.flow, SIMILARITY_THRESHOLD, 4);
  const sClusters = clusterBySimilarity(scripts, m => m.meta.flow, SIMILARITY_THRESHOLD, 4);

  const qFindings: Finding[] = qClusters.map(c => {
    const flows = [...new Set(c.members.map(m => m.meta.flow))];
    const roots = rootModelsOf(c.members[0].meta.rep.query ?? '');
    const suggestion = savedName(roots[0] ? humanize(roots[0]) : (c.members[0].meta.node || 'Shared'), 'Query');
    return {
      ruleId: 'flow-shared-query', severity: 'warn',
      suggestion,
      message: `${c.members.length} ${c.similarity >= 0.99 ? 'identical' : `~${Math.round(c.similarity * 100)}% similar`} queries across ${flows.length} flows (${flows.join(', ')}) — e.g. "${c.members[0].meta.node}"`,
      fix: `Extract to a Saved Query “${suggestion}” and reference it from each flow (parameterize the differences).`,
    };
  });
  const sFindings: Finding[] = sClusters.map(c => {
    const flows = [...new Set(c.members.map(m => m.meta.flow))];
    const suggestion = savedName(scriptTitle(c.members[0].meta.rep.script) ?? c.members[0].meta.node ?? 'Shared', 'Script');
    return {
      ruleId: 'flow-shared-script', severity: 'warn',
      suggestion,
      message: `${c.members.length} ${c.similarity >= 0.99 ? 'identical' : `~${Math.round(c.similarity * 100)}% similar`} scripts across ${flows.length} flows (${flows.join(', ')}) — e.g. "${c.members[0].meta.node}"`,
      fix: `Extract to a Saved Script “${suggestion}” and reference it from each flow (parameterize the differences).`,
    };
  });

  const rules: RuleResult[] = [
    rule('flow-shared-query', 'Similar queries extracted to Saved Queries', Math.max(1, queries.length), Math.max(1, queries.length) - qFindings.length, qFindings),
    rule('flow-shared-script', 'Similar scripts extracted to Saved Scripts', Math.max(1, scripts.length), Math.max(1, scripts.length) - sFindings.length, sFindings),
  ];
  return toReport(`All flows (${graphs.length})`, rules);
}
