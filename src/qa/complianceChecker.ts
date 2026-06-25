/**
 * Runs an artifact's compliance profile and computes an explainable score —
 * the share of assertions that passed across all rules. Pure; no I/O.
 */
import {
  ArtifactDescriptor,
  ComplianceReport,
  DataModelDescriptor,
  Finding,
  GenericDescriptor,
  RuleResult,
  SEVERITY_ORDER,
} from './complianceTypes';
import { DATA_MODEL_RULES } from './dataModelProfile';
import { KIND_RULES } from './profiles';

export function runCompliance(descriptor: ArtifactDescriptor): ComplianceReport {
  const rules: RuleResult[] =
    descriptor.kind === 'dataModel'
      ? DATA_MODEL_RULES.map(r => r(descriptor as DataModelDescriptor))
      : KIND_RULES[descriptor.kind].map(r => r(descriptor as GenericDescriptor));

  const checks = rules.reduce((n, r) => n + r.checks, 0);
  const passed = rules.reduce((n, r) => n + r.passed, 0);
  const score = checks === 0 ? 100 : Math.round((passed / checks) * 100);

  const findings: Finding[] = rules
    .flatMap(r => r.findings)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return { kind: descriptor.kind, name: descriptor.name, score, checks, passed, rules, findings };
}
