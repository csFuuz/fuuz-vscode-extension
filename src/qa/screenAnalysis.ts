/**
 * Pure SCREEN compliance analyzers. Each returns a {@link RuleResult}
 * (assertions run / passed + findings) so results render in the shared
 * compliance report. No VS Code/Node imports — fully unit-testable.
 *
 * Rules: too many action buttons, oversized element count, heavy inline
 * configuration, column/field transforms that belong at table/form level,
 * ambiguous screen naming, and missing version/release notes (devops).
 */
import { ComplianceReport, Finding, RuleResult, SEVERITY_ORDER } from './complianceTypes';
import { ScreenElementNode, ScreenModel } from './screenTypes';
import { ModelInfo } from './flowTypes';
import { judgeName } from './naming';

const rule = (ruleId: string, title: string, checks: number, passed: number, findings: Finding[]): RuleResult =>
  ({ ruleId, title, checks, passed, findings });

const where = (e: ScreenElementNode) => e.name || e.label || e.id;

/** Buttons that trigger actions/flows. */
const ACTION_TYPES = new Set(['ActionButton', 'FlowButton']);

/** Element types that behave as user-input/field elements (carry field transforms). */
const FIELD_TYPES = new Set([
  'TextInput', 'SelectInput', 'NumberInput', 'FloatInput', 'IntegerInput',
  'DateInput', 'DateTimeInput', 'DateRangeInput', 'DurationInput', 'ColorInput',
  'OptionsInput', 'CustomFieldsInput', 'ScanTextInput', 'Switch',
]);

const MAX_ACTION_BUTTONS = 5;
const MAX_ELEMENTS = 75;
const MAX_CONFIG_SIZE = 60_000;
const LARGE_RECORD_COUNT = 5000;

/** Too many action buttons crowd a screen — consolidate into menus/rows. */
function actionButtons(m: ScreenModel): RuleResult {
  const count = m.elements.filter(e => ACTION_TYPES.has(e.type)).length;
  const ok = count <= MAX_ACTION_BUTTONS;
  return rule('screen-action-buttons', 'Screen has a reasonable number of action buttons', 1, ok ? 1 : 0,
    ok ? [] : [{
      ruleId: 'screen-action-buttons', severity: 'warn',
      message: `Screen has ${count} action buttons (>${MAX_ACTION_BUTTONS}) — consider consolidating or moving actions into menus/rows`,
      fix: 'Group related actions into a menu or row-level actions.',
    }]);
}

/** Large screens are slow to load and hard to maintain — split into widgets/tabs. */
function elementCount(m: ScreenModel): RuleResult {
  const count = m.elements.length;
  const ok = count <= MAX_ELEMENTS;
  return rule('screen-element-count', 'Screen element count is manageable', 1, ok ? 1 : 0,
    ok ? [] : [{
      ruleId: 'screen-element-count', severity: 'warn',
      message: `Screen has ${count} elements (>${MAX_ELEMENTS}) — large screens are slow to load and hard to maintain; consider splitting into widgets/tabs`,
      fix: 'Break the screen into screen widgets or tabbed components.',
    }]);
}

/** Heavy inline configuration usually means many embedded transforms/scripts. */
function configSize(m: ScreenModel): RuleResult {
  const ok = m.totalConfigSize <= MAX_CONFIG_SIZE;
  return rule('screen-config-size', 'Screen configuration size is reasonable', 1, ok ? 1 : 0,
    ok ? [] : [{
      ruleId: 'screen-config-size', severity: 'info',
      message: `Screen carries ~${Math.round(m.totalConfigSize / 1000)} KB of element configuration — likely many inline transforms/scripts; review for extraction`,
      fix: 'Extract inline transforms/scripts to Saved Transforms / Saved Scripts.',
    }]);
}

/** Column-level transforms should prefer a single Table-level transform. */
function columnTransforms(m: ScreenModel): RuleResult {
  const columns = m.elements.filter(e => e.type === 'TableColumn');
  const findings: Finding[] = [];
  let passed = 0;
  for (const c of columns) {
    if (!c.transform) { passed++; continue; }
    findings.push({
      ruleId: 'screen-column-transforms', severity: 'warn',
      message: `Column "${where(c)}" has an inline transform — prefer a single Table-level transform where possible`,
      where: where(c),
      fix: 'Move column transforms into one Table-level transform.',
    });
  }
  return rule('screen-column-transforms', 'Table columns avoid inline transforms', columns.length || 1, columns.length ? passed : 1, findings);
}

/** Field-level transforms should prefer a Form-level transform. */
function fieldTransforms(m: ScreenModel): RuleResult {
  const fields = m.elements.filter(e => FIELD_TYPES.has(e.type));
  const findings: Finding[] = [];
  let passed = 0;
  for (const f of fields) {
    if (!f.transform) { passed++; continue; }
    findings.push({
      ruleId: 'screen-field-transforms', severity: 'warn',
      message: `Field "${where(f)}" has an inline transform — prefer a Form-level transform where possible`,
      where: where(f),
      fix: 'Move field transforms into the Form\'s data transform.',
    });
  }
  return rule('screen-field-transforms', 'Fields avoid inline transforms', fields.length || 1, fields.length ? passed : 1, findings);
}

/** No `$integrate` in screen element transforms — use a Connection + integration flow. */
function screenIntegrate(m: ScreenModel): RuleResult {
  const withTransforms = m.elements.filter(e => e.transform);
  if (!withTransforms.length) return rule('screen-integrate', 'No $integrate in screen transforms', 0, 0, []);
  const findings: Finding[] = [];
  let passed = 0;
  for (const e of withTransforms) {
    if (/\$integrate\b/.test(e.transform!)) findings.push({ ruleId: 'screen-integrate', severity: 'error', where: where(e), message: `Element "${where(e)}" transform calls $integrate`, fix: 'Replace the in-transform $integrate with a Connection + integration flow.' });
    else passed++;
  }
  return rule('screen-integrate', 'No $integrate in screen transforms', withTransforms.length, passed, findings);
}

/** Data-bound elements on large transactional models should filter server-side. */
function bigTableBinding(m: ScreenModel, models?: Map<string, ModelInfo>): RuleResult {
  const bound = m.elements.filter(e => e.model);
  if (!bound.length || !models) return rule('screen-perf-binding', 'Large tables are filtered server-side', 0, 0, []);
  const findings: Finding[] = [];
  let passed = 0;
  for (const e of bound) {
    const info = models.get(e.model!) ?? models.get(e.model![0].toUpperCase() + e.model!.slice(1));
    const large = info && info.type !== 'setup' && (info.recordCount ?? 0) > LARGE_RECORD_COUNT;
    if (large && !e.hasFilter) {
      findings.push({ ruleId: 'screen-perf-binding', severity: 'warn', where: where(e), message: `"${where(e)}" binds ${e.model} (~${info!.recordCount} records) with no server-side filter`, fix: 'Add a where/filter to the element query (e.g. a recent window or required scope) so it does not load the whole table.' });
    } else passed++;
  }
  return rule('screen-perf-binding', 'Large tables are filtered server-side', bound.length, passed, findings);
}

/** Screen has a meaningful (non-placeholder) name. */
function naming(m: ScreenModel): RuleResult {
  const verdict = judgeName(m.name, 'Screen');
  return rule('screen-naming', 'Screen is clearly named', 1, verdict.ambiguous ? 0 : 1,
    verdict.ambiguous ? [{
      ruleId: 'screen-naming', severity: 'warn',
      message: verdict.reason ?? `Screen "${m.name}" has an ambiguous name`,
      fix: 'Rename the screen to describe what it shows/does.',
    }] : []);
}

/** Screen should carry version/release notes (a devops/process discipline). */
function versionNotes(m: ScreenModel): RuleResult {
  const vn = m.versionNotes;
  if (!vn || vn.total <= 0) return rule('screen-version-notes', 'Screen has version/release notes', 0, 0, []);
  const ok = vn.withNotes > 0;
  return rule('screen-version-notes', 'Screen has version/release notes', 1, ok ? 1 : 0,
    ok ? [] : [{
      ruleId: 'screen-version-notes', severity: 'info',
      message: 'Screen has no version/release notes — a devops/process gap',
      fix: 'Record release notes when versioning the screen.',
    }]);
}

/** All screen rules. `models` (optional) enables the big-table-binding perf check. */
export function analyzeScreen(m: ScreenModel, models?: Map<string, ModelInfo>): RuleResult[] {
  return [
    actionButtons(m),
    elementCount(m),
    configSize(m),
    columnTransforms(m),
    fieldTransforms(m),
    screenIntegrate(m),
    bigTableBinding(m, models),
    naming(m),
    versionNotes(m),
  ];
}

function toReport(name: string, rules: RuleResult[]): ComplianceReport {
  const checks = rules.reduce((n, r) => n + r.checks, 0);
  const passed = rules.reduce((n, r) => n + r.passed, 0);
  const findings = rules.flatMap(r => r.findings).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { kind: 'screen', name, score: checks === 0 ? 100 : Math.round((passed / checks) * 100), checks, passed, rules, findings };
}

export function runScreenCompliance(m: ScreenModel, models?: Map<string, ModelInfo>): ComplianceReport {
  return toReport(m.name, analyzeScreen(m, models));
}
