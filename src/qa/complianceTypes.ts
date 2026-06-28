/**
 * Local "compliance" engine: learn the Fuuz platform's conventions from real
 * artifacts (read over MCP) and score a candidate artifact against them BEFORE
 * it is pushed to Fuuz. Pure types + pure rule functions, no VS Code or Node
 * imports, so the engine is unit-testable in plain Node.
 *
 * An artifact is described as a kind-specific *descriptor* (built by the sampler
 * from MCP data, or parsed from a local outline). A *profile* is an ordered set
 * of rules for one kind. Running a profile over a descriptor yields a
 * {@link ComplianceReport} with a 0–100 score and actionable findings.
 */

export type ArtifactKind = 'dataModel' | 'screen' | 'flow' | 'script' | 'query';

export type Severity = 'error' | 'warn' | 'info';

/** A scalar (non-relation) field on a data model. */
export interface FieldDescriptor {
  name: string;
  /** GraphQL type string, e.g. `ID!`, `String`, `Boolean!`. */
  type: string;
  description?: string;
}

/** An object/relation field on a data model. */
export interface RelationDescriptor {
  /** The relation field name, e.g. `conversationStatus`. */
  field: string;
  /** Target model name, e.g. `ConversationStatus`. */
  target: string;
  /** True for list relations (`[X!]`), false for to-one. */
  many: boolean;
}

export interface DataModelDescriptor {
  kind: 'dataModel';
  name: string;
  fields: FieldDescriptor[];
  relations: RelationDescriptor[];
  /** master | setup | transactional (when known) — drives type-aware rules. */
  modelType?: string;
  /** Estimated record count (when known) — drives indexing/perf rules. */
  recordCount?: number;
}

/** Generic descriptor for kinds whose profiles are not yet fully modeled. */
export interface GenericDescriptor {
  kind: Exclude<ArtifactKind, 'dataModel'>;
  name: string;
  /** Raw shape pulled from MCP / a local outline, checked by generic rules. */
  raw: Record<string, unknown>;
}

export type ArtifactDescriptor = DataModelDescriptor | GenericDescriptor;

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  /** Field/element the finding applies to, when relevant. */
  where?: string;
  /** How to fix it. */
  fix?: string;
  /** Stable id of the artifact/node the fix targets (for MCP mutations). */
  targetId?: string;
  /** A concrete proposed value (e.g. a suggested node name) — Claude refines it. */
  suggestion?: string;
}

/** Outcome of one rule: how many assertions it ran, how many passed, and why. */
export interface RuleResult {
  ruleId: string;
  title: string;
  checks: number;
  passed: number;
  findings: Finding[];
}

/** A rule: evaluate a descriptor and report its assertions + findings. */
export type Rule<D extends ArtifactDescriptor = ArtifactDescriptor> = (d: D) => RuleResult;

export interface ComplianceReport {
  kind: ArtifactKind;
  name: string;
  /** 0–100, the share of assertions that passed across all rules. */
  score: number;
  checks: number;
  passed: number;
  rules: RuleResult[];
  /** All findings, flattened and sorted error → warn → info. */
  findings: Finding[];
}

export const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
