/**
 * Pure flow-diagram compliance analyzers. Each returns a {@link RuleResult}
 * (assertions run / passed + findings) so results render in the shared
 * compliance report. No VS Code/Node imports — fully unit-testable.
 *
 * Rules: broadcast surfacing, branch/collect balance, node naming + missing
 * descriptions, long scripts → saved script, try/catch + error-response nodes,
 * delay warnings, `$integrate` in scripts → integration node, hard-coded
 * credentials, and common script anti-patterns. Cross-flow: similar queries →
 * saved query, repeated scripts → saved script.
 */
import { ComplianceReport, Finding, RuleResult, SEVERITY_ORDER } from './complianceTypes';
import { FlowGraph, FlowNode } from './flowTypes';

const rule = (ruleId: string, title: string, checks: number, passed: number, findings: Finding[]): RuleResult =>
  ({ ruleId, title, checks, passed, findings });

const where = (n: FlowNode) => n.name || n.id;
const scripts = (g: FlowGraph) => g.nodes.filter(n => n.type === 'script' && typeof n.script === 'string');
const byType = (g: FlowGraph, t: FlowNode['type']) => g.nodes.filter(n => n.type === t);

/** Default/auto-looking node names that should be made meaningful. */
const AUTO_NAME = /^(node|element|new\s*node|untitled|step|script|query|branch|collect|broadcast)[\s_-]*\d*$/i;

/** Hard-coded credential assignment, e.g. `apiKey = "abc123"`. */
const CRED_LITERAL = /\b(api[_-]?key|secret|client[_-]?secret|password|passwd|pwd|passphrase|token|bearer|private[_-]?key|access[_-]?key|authorization)\b\s*[:=]\s*['"`][^'"`]{4,}['"`]/i;

// --- single-flow rules ----------------------------------------------------

/** Surface broadcast nodes (informational — they fan out to other flows). */
function broadcastUsage(g: FlowGraph): RuleResult {
  const b = byType(g, 'broadcast');
  const findings: Finding[] = b.map(n => ({
    ruleId: 'flow-broadcast', severity: 'info',
    message: `Broadcast node "${where(n)}" — verify downstream subscribers are intended`, where: where(n),
  }));
  return rule('flow-broadcast', 'Broadcast nodes surfaced', 1, 1, findings);
}

/** Each branch should be matched by a collect that gathers the same number of payloads. */
function branchCollectBalance(g: FlowGraph): RuleResult {
  const branches = byType(g, 'branch');
  const collects = byType(g, 'collect');
  const findings: Finding[] = [];
  let checks = 0;
  let passed = 0;

  if (branches.length || collects.length) {
    checks++;
    if (branches.length === collects.length) passed++;
    else findings.push({
      ruleId: 'flow-branch-collect', severity: 'error',
      message: `${branches.length} branch node(s) but ${collects.length} collect node(s) — each branch needs a matching collect`,
      fix: 'Pair every branch with a collect (or remove the orphan).',
    });
  }
  const totalBranches = branches.reduce((n, b) => n + (b.branchCount ?? 0), 0);
  const totalCollect = collects.reduce((n, c) => n + (c.collectCount ?? 0), 0);
  if (totalBranches || totalCollect) {
    checks++;
    if (totalBranches === totalCollect) passed++;
    else findings.push({
      ruleId: 'flow-branch-collect', severity: 'error',
      message: `Branches fan out to ${totalBranches} payload(s) but collects gather ${totalCollect} — counts must match`,
      fix: 'Make the collect node(s) gather exactly the number of branched payloads.',
    });
  }
  return rule('flow-branch-collect', 'Branch/collect payloads balance', checks, passed, findings);
}

/** Every node has a meaningful (non-default) name. */
function nodeNaming(g: FlowGraph): RuleResult {
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of g.nodes) {
    const name = (n.name ?? '').trim();
    if (name.length >= 3 && !AUTO_NAME.test(name)) passed++;
    else findings.push({
      ruleId: 'flow-node-naming', severity: 'warn',
      message: name ? `Node "${name}" has a default/unclear name` : `Node ${n.id} has no name`,
      where: where(n), fix: 'Rename to describe what the node does (use “Rename Flow Nodes”).',
    });
  }
  return rule('flow-node-naming', 'Nodes are clearly named', g.nodes.length, passed, findings);
}

/** Every node has a description. */
function nodeDescriptions(g: FlowGraph): RuleResult {
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of g.nodes) {
    if ((n.description ?? '').trim()) passed++;
    else findings.push({ ruleId: 'flow-node-descriptions', severity: 'info', message: `Node "${where(n)}" has no description`, where: where(n), fix: 'Add a short description.' });
  }
  return rule('flow-node-descriptions', 'Nodes have descriptions', g.nodes.length, passed, findings);
}

/** Long scripts (>100 lines) should become saved scripts. */
function longScripts(g: FlowGraph): RuleResult {
  const ss = scripts(g);
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of ss) {
    const lines = n.script!.split('\n').length;
    if (lines <= 100) passed++;
    else findings.push({
      ruleId: 'flow-long-scripts', severity: 'warn',
      message: `Script node "${where(n)}" is ${lines} lines`, where: where(n),
      fix: 'Convert to a Saved Script and reference it, for reuse + testability.',
    });
  }
  return rule('flow-long-scripts', 'Script nodes are reasonably sized', ss.length, passed, findings);
}

/** Flow has try/catch or an error-response node. */
function errorHandling(g: FlowGraph): RuleResult {
  const hasErrorNode = byType(g, 'errorResponse').length > 0;
  const hasTryCatch = scripts(g).some(n => /\btry\b[\s\S]*\bcatch\b/.test(n.script!));
  const ok = hasErrorNode || hasTryCatch;
  return rule('flow-error-handling', 'Has error handling (try/catch or error-response node)', 1, ok ? 1 : 0,
    ok ? [] : [{ ruleId: 'flow-error-handling', severity: 'warn', message: 'No try/catch in scripts and no error-response node', fix: 'Add an error-response node and/or wrap risky script logic in try/catch.' }]);
}

/** Delay nodes are flagged as a warning. */
function delayNodes(g: FlowGraph): RuleResult {
  const d = byType(g, 'delay');
  const findings: Finding[] = d.map(n => ({
    ruleId: 'flow-delay', severity: 'warn',
    message: `Delay node "${where(n)}" — delays can stall throughput; confirm it's necessary`, where: where(n),
  }));
  return rule('flow-delay', 'No unexpected delay nodes', 1, d.length ? 0 : 1, findings);
}

/** Script nodes must not call `$integrate` — use an integration node + connection. */
function integrateInScript(g: FlowGraph): RuleResult {
  const ss = scripts(g);
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of ss) {
    if (!n.script!.includes('$integrate')) passed++;
    else findings.push({
      ruleId: 'flow-integrate-in-script', severity: 'error',
      message: `Script node "${where(n)}" calls $integrate`, where: where(n),
      fix: 'Replace the in-script $integrate with a proper Integration node + Connection.',
    });
  }
  return rule('flow-integrate-in-script', 'Scripts do not call $integrate', ss.length, passed, findings);
}

/** Hard-coded credentials in scripts are a security risk. */
function credentialsInScript(g: FlowGraph): RuleResult {
  const ss = scripts(g);
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of ss) {
    if (!CRED_LITERAL.test(n.script!)) passed++;
    else findings.push({
      ruleId: 'flow-credentials', severity: 'error',
      message: `Script node "${where(n)}" appears to hard-code a credential (key/token/password)`, where: where(n),
      fix: 'Move secrets to a Connection; never embed api keys/tokens/passwords in scripts.',
    });
  }
  return rule('flow-credentials', 'No hard-coded credentials in scripts', ss.length, passed, findings);
}

/** Misc script anti-patterns: hard-coded URLs and leftover console logging. */
function scriptAntiPatterns(g: FlowGraph): RuleResult {
  const ss = scripts(g);
  const findings: Finding[] = [];
  let checks = 0;
  let passed = 0;
  for (const n of ss) {
    checks++;
    const url = /https?:\/\/[^\s'"`)]+/.test(n.script!);
    const log = /console\.(log|debug|info|warn|error)\s*\(/.test(n.script!);
    if (!url && !log) { passed++; continue; }
    if (url) findings.push({ ruleId: 'flow-script-antipatterns', severity: 'warn', message: `Script node "${where(n)}" hard-codes a URL`, where: where(n), fix: 'Use a Connection / config value instead of a literal URL.' });
    if (log) findings.push({ ruleId: 'flow-script-antipatterns', severity: 'info', message: `Script node "${where(n)}" leaves console logging in`, where: where(n), fix: 'Remove console.* or use flow logging.' });
  }
  return rule('flow-script-antipatterns', 'Scripts avoid hard-coded URLs / stray logging', checks, passed, findings);
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

/** All single-flow rules. */
export function analyzeFlow(g: FlowGraph): RuleResult[] {
  return [
    branchCollectBalance(g),
    broadcastUsage(g),
    nodeNaming(g),
    nodeDescriptions(g),
    duplicateNames(g),
    longScripts(g),
    errorHandling(g),
    delayNodes(g),
    integrateInScript(g),
    credentialsInScript(g),
    scriptAntiPatterns(g),
  ];
}

function toReport(kindName: string, rules: RuleResult[]): ComplianceReport {
  const checks = rules.reduce((n, r) => n + r.checks, 0);
  const passed = rules.reduce((n, r) => n + r.passed, 0);
  const findings = rules.flatMap(r => r.findings).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { kind: 'flow', name: kindName, score: checks === 0 ? 100 : Math.round((passed / checks) * 100), checks, passed, rules, findings };
}

export function runFlowGraphCompliance(g: FlowGraph): ComplianceReport {
  return toReport(g.name, analyzeFlow(g));
}

// --- cross-flow rules -----------------------------------------------------

/** Strip comments + collapse whitespace so equivalent scripts compare equal. */
export function normalizeScript(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look across many flows for repetition worth extracting:
 *  - the same query signature used in ≥2 flows → suggest a Saved Query
 *  - the same non-trivial script used in ≥2 flows → suggest a Saved Script
 */
export function analyzeFlowsCrossCutting(graphs: FlowGraph[]): ComplianceReport {
  const queryFlows = new Map<string, Set<string>>();
  const scriptFlows = new Map<string, { flows: Set<string>; sample: string }>();

  for (const g of graphs) {
    for (const n of g.nodes) {
      if (n.type === 'query' && n.query) {
        if (!queryFlows.has(n.query)) queryFlows.set(n.query, new Set());
        queryFlows.get(n.query)!.add(g.name);
      }
      if (n.type === 'script' && n.script) {
        const norm = normalizeScript(n.script);
        if (norm.length < 60) continue; // ignore trivial snippets
        if (!scriptFlows.has(norm)) scriptFlows.set(norm, { flows: new Set(), sample: where(n) });
        scriptFlows.get(norm)!.flows.add(g.name);
      }
    }
  }

  const qFindings: Finding[] = [];
  for (const [sig, flows] of queryFlows) if (flows.size >= 2) {
    qFindings.push({ ruleId: 'flow-shared-query', severity: 'warn', message: `Query \`${sig}\` appears in ${flows.size} flows (${[...flows].join(', ')})`, fix: 'Convert to a Saved Query and reference it from each flow.' });
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
