/**
 * The full catalog of compliance validations, and a filter that drops
 * user-excluded rules from a report. Lets a developer choose exactly which
 * checks the audit runs (e.g. exclude "color" or "requires description").
 *
 * The catalog is derived by running each profile once over an empty/stub input,
 * so it always mirrors the real rule set (ids + titles) with no duplicate list
 * to maintain. Pure — no VS Code import.
 */
import { ComplianceReport, scoreOf } from './complianceTypes';
import { analyzeFlow, analyzeFlowsCrossCutting } from './flowAnalysis';
import { analyzeScreen } from './screenAnalysis';
import { DATA_MODEL_RULES } from './dataModelProfile';

export type RuleCategory = 'dataModel' | 'flow' | 'screen' | 'app';

export interface RuleInfo { id: string; title: string; category: RuleCategory; }

/** Every validation the audit can run, with its id, human title, and category. */
export function catalogRules(): RuleInfo[] {
  const out: RuleInfo[] = [];
  const seen = new Set<string>();
  const add = (rules: { ruleId: string; title: string }[], category: RuleCategory) => {
    for (const r of rules) {
      if (seen.has(r.ruleId)) continue;
      seen.add(r.ruleId);
      out.push({ id: r.ruleId, title: r.title, category });
    }
  };
  add(analyzeFlow({ id: '', name: '', nodes: [] }), 'flow');
  add(analyzeFlowsCrossCutting([]).rules, 'flow');
  add(analyzeScreen({ name: '', elements: [], totalConfigSize: 0 }), 'screen');
  add(DATA_MODEL_RULES.map(r => r({ kind: 'dataModel', name: 'Stub', fields: [], relations: [] })), 'dataModel');
  add([{ ruleId: 'app-roles', title: 'Application has roles configured' }], 'app');
  return out;
}

/**
 * Return a report with excluded rules (by ruleId) removed and the score/counts
 * recomputed. A no-op when nothing is excluded.
 */
export function filterReport(report: ComplianceReport, excluded: ReadonlySet<string>): ComplianceReport {
  if (!excluded.size) return report;
  const rules = report.rules.filter(r => !excluded.has(r.ruleId));
  const findings = report.findings.filter(f => !excluded.has(f.ruleId));
  const checks = rules.reduce((n, r) => n + r.checks, 0);
  const passed = rules.reduce((n, r) => n + r.passed, 0);
  return { ...report, rules, findings, checks, passed, ...scoreOf(checks, passed) };
}
