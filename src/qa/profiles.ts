/**
 * Compliance profiles for screen / flow / script / query artifacts, evaluated
 * over the parsed local outline (`GenericDescriptor.raw`). Rules encode the
 * platform conventions and the outline shapes the scaffolds emit; flow types are
 * grounded in the real `DataFlowType` values read over MCP
 * (Document · Edge · Integration · Screen · System).
 *
 * Each rule reports assertions-run / passed so the score stays explainable.
 */
import { Finding, GenericDescriptor, Rule, RuleResult } from './complianceTypes';

const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const r = (ruleId: string, title: string, checks: number, passed: number, findings: Finding[]): RuleResult =>
  ({ ruleId, title, checks, passed, findings });
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

// --- query ----------------------------------------------------------------

export const FLOW_TYPES = ['Document', 'Edge', 'Integration', 'Screen', 'System'];
const LAYOUTS = ['list', 'detail', 'form', 'dashboard'];

const QUERY_RULES: Rule<GenericDescriptor>[] = [
  d => {
    const m = str(d.raw.modelName);
    return r('query-model', 'Targets a PascalCase model', 1, m && PASCAL.test(m) ? 1 : 0,
      m && PASCAL.test(m) ? [] : [{ ruleId: 'query-model', severity: 'error', message: m ? `modelName \`${m}\` is not PascalCase` : 'Missing `modelName`', fix: 'Set `modelName` to an existing model (e.g. "WorkOrder").' }]);
  },
  d => {
    const fields = arr(d.raw.fields);
    return r('query-fields', 'Requests at least one field', 1, fields.length ? 1 : 0,
      fields.length ? [] : [{ ruleId: 'query-fields', severity: 'error', message: '`fields` is empty', fix: 'List the field paths to return (always include "id").' }]);
  },
  d => {
    const fields = arr(d.raw.fields).map(str);
    const has = fields.includes('id');
    return r('query-includes-id', 'Includes `id`', 1, has ? 1 : 0,
      has ? [] : [{ ruleId: 'query-includes-id', severity: 'warn', message: '`fields` does not include "id"', fix: 'Add "id" so results are addressable.' }]);
  },
  d => {
    const ok = d.raw.where === undefined || isObj(d.raw.where);
    return r('query-where', '`where` is a JSON object', 1, ok ? 1 : 0,
      ok ? [] : [{ ruleId: 'query-where', severity: 'error', message: '`where` must be a JSON object', fix: 'Use `{}` for no filter, or a predicate like `{ "active": { "_eq": true } }`.' }]);
  },
  d => {
    const ob = arr(d.raw.orderBy);
    const findings: Finding[] = [];
    let passed = 0;
    for (const e of ob) {
      const o = isObj(e) ? e : {};
      if (str(o.field) && ['asc', 'desc'].includes(str(o.direction))) passed++;
      else findings.push({ ruleId: 'query-orderby', severity: 'warn', message: 'orderBy entry needs `field` and `direction` (asc|desc)' });
    }
    return r('query-orderby', 'orderBy entries are well-formed', ob.length, passed, findings);
  },
];

// --- flow -----------------------------------------------------------------

const FLOW_RULES: Rule<GenericDescriptor>[] = [
  d => r('flow-name', 'Has a name', 1, str(d.raw.name) ? 1 : 0,
    str(d.raw.name) ? [] : [{ ruleId: 'flow-name', severity: 'error', message: 'Flow has no `name`' }]),
  d => {
    const t = str(d.raw.type);
    const ok = FLOW_TYPES.includes(t);
    return r('flow-type', 'Has a valid type', 1, ok ? 1 : 0,
      ok ? [] : [{ ruleId: 'flow-type', severity: 'error', message: t ? `Unknown flow type \`${t}\`` : 'Missing flow `type`', fix: `Use one of: ${FLOW_TYPES.join(', ')}.` }]);
  },
  d => {
    const nodes = arr(d.raw.nodes);
    return r('flow-has-nodes', 'Has at least one node', 1, nodes.length ? 1 : 0,
      nodes.length ? [] : [{ ruleId: 'flow-has-nodes', severity: 'warn', message: 'Flow has no nodes', fix: 'Add nodes (query / transform / output …).' }]);
  },
  d => {
    const nodes = arr(d.raw.nodes);
    const ids: string[] = [];
    const findings: Finding[] = [];
    let passed = 0;
    for (const n of nodes) {
      const id = isObj(n) ? str(n.id) : '';
      if (id && !ids.includes(id)) { passed++; ids.push(id); }
      else findings.push({ ruleId: 'flow-node-ids', severity: 'error', message: id ? `Duplicate node id \`${id}\`` : 'A node is missing an `id`' });
    }
    return r('flow-node-ids', 'Nodes have unique ids', nodes.length, passed, findings);
  },
];

// --- screen ---------------------------------------------------------------

const SCREEN_RULES: Rule<GenericDescriptor>[] = [
  d => r('screen-name', 'Has a name', 1, str(d.raw.name) ? 1 : 0,
    str(d.raw.name) ? [] : [{ ruleId: 'screen-name', severity: 'error', message: 'Screen has no `name`' }]),
  d => {
    const l = str(d.raw.layout);
    const ok = LAYOUTS.includes(l);
    return r('screen-layout', 'Has a known layout', 1, ok ? 1 : 0,
      ok ? [] : [{ ruleId: 'screen-layout', severity: 'warn', message: l ? `Unknown layout \`${l}\`` : 'Missing `layout`', fix: `Use one of: ${LAYOUTS.join(', ')}.` }]);
  },
  d => r('screen-datamodel', 'Binds a data model', 1, str(d.raw.dataModel) ? 1 : 0,
    str(d.raw.dataModel) ? [] : [{ ruleId: 'screen-datamodel', severity: 'warn', message: 'Screen does not bind a `dataModel`', fix: 'Set the primary model this screen reads/writes.' }]),
  d => {
    const c = arr(d.raw.components);
    return r('screen-components', 'Has components', 1, c.length ? 1 : 0,
      c.length ? [] : [{ ruleId: 'screen-components', severity: 'warn', message: 'Screen has no components', fix: 'Add at least one component (table / form / …).' }]);
  },
];

// --- script ---------------------------------------------------------------

const SCRIPT_RULES: Rule<GenericDescriptor>[] = [
  d => {
    const src = str(d.raw.source);
    const hasFn = /function\s+\w+\s*\(|=>/.test(src);
    return r('script-handler', 'Defines a handler function', 1, hasFn ? 1 : 0,
      hasFn ? [] : [{ ruleId: 'script-handler', severity: 'error', message: 'No function/handler found', fix: 'Define a handler `function name(input) { … }`.' }]);
  },
  d => {
    const src = str(d.raw.source);
    const ret = /\breturn\b/.test(src);
    return r('script-returns', 'Returns a value', 1, ret ? 1 : 0,
      ret ? [] : [{ ruleId: 'script-returns', severity: 'warn', message: 'No `return` statement found', fix: 'Return the output object from the handler.' }]);
  },
];

export const KIND_RULES: Record<GenericDescriptor['kind'], Rule<GenericDescriptor>[]> = {
  query: QUERY_RULES,
  flow: FLOW_RULES,
  screen: SCREEN_RULES,
  script: SCRIPT_RULES,
};
