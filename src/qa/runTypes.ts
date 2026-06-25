/**
 * Types for the browser-QA harness. A *plan* is a driver-agnostic brief: it
 * describes what to exercise, for which personas, against which (test) target,
 * and what to capture. The same plan feeds either driver — Claude-for-Chrome
 * (human-supervised) or a headless Claude Code + Playwright MCP run. Pure types,
 * no VS Code/Node imports.
 */

export type RunScopeKind = 'screen' | 'app';

/** A test identity the developer creates and logs into one at a time. */
export interface Persona {
  /** Short label, e.g. "Operator", "Supervisor". */
  name: string;
  /** What this persona is expected to be able to do (drives expectations). */
  role?: string;
  /** Free-text notes (e.g. "read-only", "no delete on WorkOrder"). */
  notes?: string;
}

/** The environment a run targets. Destructive steps require `isTestEnv`. */
export interface QaTarget {
  /** `{env}.{account}` slug, e.g. `build.mfgx`. */
  envSlug: string;
  /** App host the persona logs into, e.g. `https://build.mfgx.fuuz.app`. */
  url: string;
  /** Whether this looks like a designated non-production test environment. */
  isTestEnv: boolean;
}

export interface RunScope {
  kind: RunScopeKind;
  /** Screen or application name. */
  name: string;
  /** Primary data model bound to the screen, when known. */
  model?: string;
  /** Screen names in scope (for an app run). */
  screens?: string[];
}

/** One objective in the plan — Claude explores to satisfy it, not a literal script. */
export interface PlanStep {
  id: string;
  title: string;
  /** What to do / verify. */
  detail: string;
  /** True if this step mutates data (gated on the test-env + destructive opt-in). */
  destructive?: boolean;
}

export interface QaPlan {
  runId: string;
  createdAt: string;
  scope: RunScope;
  target: QaTarget;
  personas: Persona[];
  destructiveAllowed: boolean;
  steps: PlanStep[];
  /** Relative artifact directory, e.g. `.fuuz/qa/<runId>`. */
  artifactsDir: string;
}

export type RunStatus = 'planned' | 'running' | 'passed' | 'failed' | 'cancelled';

/** Where a finding came from — correlated across the browser and Fuuz. */
export type FindingSource = 'chrome-console' | 'fuuz-devconsole' | 'fuuz-spanlog' | 'fuuz-dataflowlog' | 'integration-log' | 'ux';
