/**
 * The structured result a QA run produces. The agent writes `result.json` in
 * this shape into the run directory; the extension ingests it (tolerantly — the
 * agent's output may be partial) and renders it alongside the collected Fuuz
 * logs in the QA result view. Pure types + a defensive parser, no VS Code/Node.
 */

export type StepStatus = 'pass' | 'fail' | 'skip' | 'blocked';
export type DefectSeverity = 'high' | 'medium' | 'low';

export interface QaStep {
  title: string;
  status: StepStatus;
  notes?: string;
  /** Run-relative artifact path (screenshot/GIF), e.g. `artifacts/landing.png`. */
  evidence?: string;
}

export interface QaPersonaResult {
  name: string;
  steps: QaStep[];
}

export interface QaDefect {
  severity: DefectSeverity;
  title: string;
  detail?: string;
  fix?: string;
  evidence?: string;
}

export interface QaUxNote {
  area?: string;
  note: string;
  recommendation?: string;
}

export interface QaResult {
  summary?: string;
  personas: QaPersonaResult[];
  defects: QaDefect[];
  uxNotes: QaUxNote[];
}

const STEP_STATUSES: StepStatus[] = ['pass', 'fail', 'skip', 'blocked'];
const SEVERITIES: DefectSeverity[] = ['high', 'medium', 'low'];

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const optStr = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function status(v: unknown): StepStatus {
  const s = str(v).toLowerCase();
  if (STEP_STATUSES.includes(s as StepStatus)) return s as StepStatus;
  // Check fail/blocked before pass: "broken" contains "ok".
  if (/fail|error|broken/.test(s)) return 'fail';
  if (/block/.test(s)) return 'blocked';
  if (/pass|success|\bok\b/.test(s)) return 'pass';
  return 'skip';
}

function severity(v: unknown): DefectSeverity {
  const s = str(v).toLowerCase();
  if (SEVERITIES.includes(s as DefectSeverity)) return s as DefectSeverity;
  if (/high|crit|sev1|blocker/.test(s)) return 'high';
  if (/low|minor|trivial/.test(s)) return 'low';
  return 'medium';
}

/**
 * Parse the agent's `result.json` into a normalized {@link QaResult}, tolerating
 * missing/oddly-shaped fields. Also accepts a flat `{ steps: [...] }` shape by
 * folding it into a single unnamed persona.
 */
export function parseQaResult(raw: unknown): QaResult {
  const r = obj(raw);

  const toStep = (s: unknown): QaStep => {
    const o = obj(s);
    return { title: str(o.title) || str(o.name) || '(step)', status: status(o.status), notes: optStr(o.notes), evidence: optStr(o.evidence) };
  };

  let personas: QaPersonaResult[] = arr(r.personas).map(p => {
    const o = obj(p);
    return { name: str(o.name) || '(persona)', steps: arr(o.steps).map(toStep) };
  });
  // Fallback: a flat steps array with no personas.
  if (personas.length === 0 && arr(r.steps).length) {
    personas = [{ name: '(all)', steps: arr(r.steps).map(toStep) }];
  }

  const defects: QaDefect[] = arr(r.defects).map(d => {
    const o = obj(d);
    return { severity: severity(o.severity), title: str(o.title) || str(o.summary) || '(defect)', detail: optStr(o.detail), fix: optStr(o.fix), evidence: optStr(o.evidence) };
  });

  const uxNotes: QaUxNote[] = arr(r.uxNotes ?? r.ux ?? r.grooming).map(n => {
    const o = obj(n);
    return { area: optStr(o.area), note: str(o.note) || str(o.text) || '(note)', recommendation: optStr(o.recommendation) };
  });

  return { summary: optStr(r.summary), personas, defects, uxNotes };
}

/** Counts for a quick result banner. */
export function resultTotals(r: QaResult): { steps: number; passed: number; failed: number; defects: number } {
  const steps = r.personas.flatMap(p => p.steps);
  return {
    steps: steps.length,
    passed: steps.filter(s => s.status === 'pass').length,
    failed: steps.filter(s => s.status === 'fail').length,
    defects: r.defects.length,
  };
}
