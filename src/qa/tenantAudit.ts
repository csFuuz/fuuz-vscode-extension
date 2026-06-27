/**
 * Aggregate many per-artifact {@link ComplianceReport}s (data models + flows)
 * into a single tenant **summary** report: an overall score, a per-artifact
 * scorecard (worst first), and the consolidated findings (errors first, capped).
 * Pure — no VS Code/Node.
 */
import { ComplianceReport, Finding, RuleResult, SEVERITY_ORDER } from './complianceTypes';

/** Max findings to surface in the summary before truncating with a note. */
const FINDING_CAP = 200;

export function runTenantAudit(tenantName: string, reports: ComplianceReport[]): ComplianceReport {
  // Scorecard: one rule row per artifact, worst score first.
  const rules: RuleResult[] = reports
    .slice()
    .sort((a, b) => a.score - b.score)
    .map(r => ({
      ruleId: `${r.kind}:${r.name}`,
      title: `${r.kind} · ${r.name} — ${r.score}%`,
      checks: r.checks,
      passed: r.passed,
      findings: [],
    }));

  // Consolidated findings, artifact-prefixed, errors → warns → info, capped.
  const all: Finding[] = reports
    .flatMap(r => r.findings.map(f => ({ ...f, message: `[${r.name}] ${f.message}` })))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const errors = all.filter(f => f.severity === 'error').length;
  const warns = all.filter(f => f.severity === 'warn').length;
  const withErrors = reports.filter(r => r.findings.some(f => f.severity === 'error')).length;

  const findings: Finding[] = [
    {
      ruleId: 'tenant-audit-summary', severity: errors ? 'error' : warns ? 'warn' : 'info',
      message: `${reports.length} artifact(s) audited · ${withErrors} with errors · ${errors} errors, ${warns} warnings total`,
    },
    ...all.slice(0, FINDING_CAP),
  ];
  if (all.length > FINDING_CAP) {
    findings.push({ ruleId: 'tenant-audit-summary', severity: 'info', message: `… and ${all.length - FINDING_CAP} more findings (see individual artifacts).` });
  }

  const checks = reports.reduce((n, r) => n + r.checks, 0);
  const passed = reports.reduce((n, r) => n + r.passed, 0);
  return {
    kind: 'dataModel', // generic container kind for the summary view
    name: `Tenant audit — ${tenantName}`,
    score: checks === 0 ? 100 : Math.round((passed / checks) * 100),
    checks,
    passed,
    rules,
    findings,
  };
}
