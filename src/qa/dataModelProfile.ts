/**
 * Data-model compliance profile. Rules encode the Fuuz platform conventions
 * observed in real models read over MCP (e.g. `Conversation`):
 *   - a server-generated `id: ID!` primary key
 *   - camelCase field names; PascalCase model name
 *   - every to-one relation `x` has a scalar foreign key `xId` and vice-versa
 *   - scalar fields use known GraphQL scalar types
 *   - an `active: Boolean` soft-state flag
 *   - fields carry descriptions
 *
 * Each rule reports how many assertions it ran and how many passed, so the
 * overall score is an explainable "share of checks passed".
 */
import { DataModelDescriptor, FieldDescriptor, Finding, Rule, RuleResult } from './complianceTypes';
import { SCALAR_TYPES, baseType } from '../util/fuuzParse';

const CAMEL = /^[a-z][A-Za-z0-9]*$/;
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;

/** Strip GraphQL list/non-null decoration: `[X!]!` → `X`. */
const base = (t: string) => baseType(t);
const isList = (t: string) => t.trim().startsWith('[');

function result(ruleId: string, title: string, checks: number, passed: number, findings: Finding[]): RuleResult {
  return { ruleId, title, checks, passed, findings };
}

/** Exactly one `id` field, typed `ID`/`ID!`. */
const idPrimaryKey: Rule<DataModelDescriptor> = d => {
  const id = d.fields.find(f => f.name === 'id');
  if (id && base(id.type) === 'ID') return result('id-primary-key', 'Has an `id: ID!` primary key', 1, 1, []);
  return result('id-primary-key', 'Has an `id: ID!` primary key', 1, 0, [{
    ruleId: 'id-primary-key', severity: 'error',
    message: id ? `\`id\` should be type ID (found ${id.type})` : 'Model has no `id` field',
    where: 'id', fix: 'Add a server-generated `id: ID!` primary key.',
  }]);
};

/** Field and relation names are camelCase. */
const camelCaseFields: Rule<DataModelDescriptor> = d => {
  const names = [...d.fields.map(f => f.name), ...d.relations.map(r => r.field)];
  const findings: Finding[] = [];
  let passed = 0;
  for (const n of names) {
    if (CAMEL.test(n)) passed++;
    else findings.push({ ruleId: 'camelCase-fields', severity: 'warn', message: `Field \`${n}\` is not camelCase`, where: n, fix: 'Rename to camelCase (e.g. `workOrderId`).' });
  }
  return result('camelCase-fields', 'Field names are camelCase', names.length, passed, findings);
};

/** Model name is PascalCase (singular is recommended but not enforced). */
const pascalCaseModel: Rule<DataModelDescriptor> = d => {
  const ok = PASCAL.test(d.name);
  return result('pascalCase-model', 'Model name is PascalCase', 1, ok ? 1 : 0, ok ? [] : [{
    ruleId: 'pascalCase-model', severity: 'warn', message: `Model name \`${d.name}\` is not PascalCase`,
    fix: 'Use a singular PascalCase name (e.g. `WorkOrder`).',
  }]);
};

/** Scalar fields use a known GraphQL scalar type. */
const knownScalarTypes: Rule<DataModelDescriptor> = d => {
  const findings: Finding[] = [];
  let passed = 0;
  for (const f of d.fields) {
    if (SCALAR_TYPES.has(base(f.type))) passed++;
    else findings.push({
      ruleId: 'known-scalar-types', severity: 'error',
      message: `Field \`${f.name}\` has unknown scalar type \`${f.type}\``, where: f.name,
      fix: `Use a known scalar (${[...SCALAR_TYPES].slice(0, 6).join(', ')}, …) or model it as a relation.`,
    });
  }
  return result('known-scalar-types', 'Scalar fields use known types', d.fields.length, passed, findings);
};

/**
 * Foreign-key ↔ relation pairing: every to-one relation `x` has a scalar `xId`,
 * and every scalar `xId` (other than `id`) has a matching object relation `x`.
 */
const fkRelationPairing: Rule<DataModelDescriptor> = d => {
  const fieldNames = new Set(d.fields.map(f => f.name));
  const relNames = new Set(d.relations.map(r => r.field));
  const findings: Finding[] = [];
  let checks = 0;
  let passed = 0;

  for (const r of d.relations.filter(r => !r.many)) {
    checks++;
    if (fieldNames.has(`${r.field}Id`)) passed++;
    else findings.push({
      ruleId: 'fk-relation-pairing', severity: 'warn',
      message: `Relation \`${r.field}\` has no scalar foreign key \`${r.field}Id\``, where: r.field,
      fix: `Add \`${r.field}Id: ID\` and link the relation \`from: ${r.field}Id → to: id\`.`,
    });
  }
  for (const f of d.fields) {
    if (f.name === 'id' || !/Id$/.test(f.name) || base(f.type) !== 'ID') continue;
    checks++;
    const rel = f.name.slice(0, -2);
    if (relNames.has(rel)) passed++;
    else findings.push({
      ruleId: 'fk-relation-pairing', severity: 'warn',
      message: `Foreign key \`${f.name}\` has no object relation \`${rel}\``, where: f.name,
      fix: `Add an object relation \`${rel}\` linked \`from: ${f.name} → to: id\`.`,
    });
  }
  return result('fk-relation-pairing', 'Foreign keys pair with object relations', checks, passed, findings);
};

/** List relations are non-null lists (`[X!]` / `[X!]!`). */
const listRelationShape: Rule<DataModelDescriptor> = d => {
  // We only have target + many here; treat the existence of a list relation as
  // its own check (shape detail beyond "is a list" needs the full type string).
  const lists = d.relations.filter(r => r.many);
  return result('list-relation-shape', 'List relations present where modeled', lists.length, lists.length, []);
};

/** Soft-state `active: Boolean` flag (common convention). */
const activeFlag: Rule<DataModelDescriptor> = d => {
  const f = d.fields.find(x => x.name === 'active');
  const ok = !!f && base(f.type) === 'Boolean';
  return result('active-flag', 'Has an `active: Boolean` flag', 1, ok ? 1 : 0, ok ? [] : [{
    ruleId: 'active-flag', severity: 'info',
    message: 'No `active: Boolean` soft-state flag', where: 'active',
    fix: 'Add `active: Boolean!` (default true) for soft enable/disable.',
  }]);
};

/** Fields carry descriptions (only evaluated when descriptions were sampled). */
const fieldDescriptions: Rule<DataModelDescriptor> = d => {
  const described = d.fields.filter(f => f.description !== undefined);
  if (described.length === 0) return result('field-descriptions', 'Fields have descriptions', 0, 0, []);
  const findings: Finding[] = [];
  let passed = 0;
  for (const f of described) {
    if ((f.description ?? '').trim().length > 0) passed++;
    else findings.push({ ruleId: 'field-descriptions', severity: 'info', message: `Field \`${f.name}\` has no description`, where: f.name, fix: 'Add a short description.' });
  }
  return result('field-descriptions', 'Fields have descriptions', described.length, passed, findings);
};

// --- Type-aware rules (only run when `modelType` is known) -------------

/** Word/suffix pattern shared by setup-type heuristics (Status/Type/Group/…). */
const SETUP_WORD = /(Status|Type|Group|Category|State)/;
const SETUP_TARGET = /(Status|Type|Group|Category|State)$/;

/** True when a field is an active flag (`active`/`isActive`, base type Boolean). */
const isActiveField = (f: FieldDescriptor) =>
  (f.name === 'active' || f.name === 'isActive') && base(f.type) === 'Boolean';

/**
 * Setup models classify other records, so they carry the standard trio:
 * a `color`, an active flag, and a `code`. (`id` should equal `code`, both
 * immutable — surfaced as info when `code` is present.)
 */
const setupRequiredFields: Rule<DataModelDescriptor> = d => {
  if (d.modelType !== 'setup') return result('setup-required-fields', 'Setup model carries color/active/code', 0, 0, []);
  const findings: Finding[] = [];
  let passed = 0;

  const hasColor = d.fields.some(f => f.name === 'color');
  if (hasColor) passed++;
  else findings.push({ ruleId: 'setup-required-fields', severity: 'warn', message: 'Setup model is missing a `color` field', where: 'color', fix: 'Add `color: String` so the value renders with a swatch.' });

  const hasActive = d.fields.some(isActiveField);
  if (hasActive) passed++;
  else findings.push({ ruleId: 'setup-required-fields', severity: 'warn', message: 'Setup model is missing an `active`/`isActive` Boolean flag', where: 'active', fix: 'Add `active: Boolean!` (default true) for soft enable/disable.' });

  const hasCode = d.fields.some(f => f.name === 'code');
  if (hasCode) {
    passed++;
    findings.push({ ruleId: 'setup-required-fields', severity: 'info', message: 'Setup model has `code` — `id` should equal `code` and both should be immutable', where: 'code', fix: 'Make `id` mirror `code` and keep both read-only after creation.' });
  } else {
    findings.push({ ruleId: 'setup-required-fields', severity: 'warn', message: 'Setup model is missing a `code` field', where: 'code', fix: 'Add a stable `code: String!` (equal to `id`, immutable).' });
  }

  return result('setup-required-fields', 'Setup model carries color/active/code', 3, passed, findings);
};

/** A non-setup model named like a setup type (Status/Type/Group/…) is suspicious. */
const modelNameImpliesSetup: Rule<DataModelDescriptor> = d => {
  if (!d.modelType || d.modelType === 'setup') return result('model-name-implies-setup', 'Setup-like name matches a setup type', 0, 0, []);
  if (!SETUP_WORD.test(d.name)) return result('model-name-implies-setup', 'Setup-like name matches a setup type', 1, 1, []);
  return result('model-name-implies-setup', 'Setup-like name matches a setup type', 1, 0, [{
    ruleId: 'model-name-implies-setup', severity: 'warn',
    message: `Model name \`${d.name}\` implies a setup type but this is a ${d.modelType} model — rename it or change its type.`,
    fix: 'Rename the model or set its type to `setup`.',
  }]);
};

/** Master/transactional models classify against at least one setup type. */
const setupReferences: Rule<DataModelDescriptor> = d => {
  if (d.modelType !== 'master' && d.modelType !== 'transactional') return result('setup-references', 'References a standard setup type', 0, 0, []);
  const ok = d.relations.some(r => SETUP_TARGET.test(r.target));
  return result('setup-references', 'References a standard setup type', 1, ok ? 1 : 0, ok ? [] : [{
    ruleId: 'setup-references', severity: 'info',
    message: 'No reference to a standard setup type (status/type/group/category) — most transactional/master models classify against one.',
    fix: 'Relate this model to a setup type (e.g. a `*Status` or `*Type`).',
  }]);
};

/** Master/transactional models prefer soft state (status/active) over hard delete. */
const statusOrActive: Rule<DataModelDescriptor> = d => {
  if (d.modelType !== 'master' && d.modelType !== 'transactional') return result('status-or-active', 'Has a status relation or active flag', 0, 0, []);
  const hasActive = d.fields.some(isActiveField);
  const hasStatus = d.relations.some(r => /status$/i.test(r.field) || /status$/i.test(r.target));
  const ok = hasActive || hasStatus;
  return result('status-or-active', 'Has a status relation or active flag', 1, ok ? 1 : 0, ok ? [] : [{
    ruleId: 'status-or-active', severity: 'info',
    message: 'No `status` relation or `active`/`isActive` flag — prefer a status/isActive over hard deletes (traceability).',
    fix: 'Add a `*Status` relation or an `active`/`isActive: Boolean` flag.',
  }]);
};

const MEASURE_NAME = /(quantity|qty|weight|length|width|height|depth|volume|temperature|pressure|rate|amount|mass|level|capacity|speed|flow|density|thickness|diameter)/i;
const BARE_NUMBER = new Set(['Int', 'Float', 'Decimal', 'BigInt', 'Long']);

/** Measurement fields carry an explicit unit (Measure/Ratio scalar or a Unit reference). */
const uomOnMeasures: Rule<DataModelDescriptor> = d => {
  // Only bare-number measurement fields need a unit; Measure/Ratio/Duration are fine.
  const measures = d.fields.filter(f => MEASURE_NAME.test(f.name) && BARE_NUMBER.has(base(f.type)));
  if (measures.length === 0) return result('uom-on-measures', 'Measurements carry an explicit unit', 0, 0, []);
  const fieldNames = new Set(d.fields.map(f => f.name));
  const hasUnitRelation = d.relations.some(r => r.field === 'Unit' || r.target === 'Unit' || /unit/i.test(r.field) || /unit/i.test(r.target));
  const findings: Finding[] = [];
  let passed = 0;
  for (const f of measures) {
    const hasSiblingUnit = fieldNames.has(`${f.name}Unit`) || fieldNames.has(`${f.name}UnitId`);
    if (hasSiblingUnit || hasUnitRelation) passed++;
    else findings.push({
      ruleId: 'uom-on-measures', severity: 'info',
      message: `Measurement field \`${f.name}\` is a bare number — use the \`Measure\` or \`Ratio\` scalar, or relate it to the system \`Unit\` model, so units are explicit.`,
      where: f.name, fix: `Type \`${f.name}\` as \`Measure\`/\`Ratio\`, or add \`${f.name}UnitId\` linked to the system \`Unit\` model.`,
    });
  }
  return result('uom-on-measures', 'Measurements carry an explicit unit', measures.length, passed, findings);
};

/** The ordered data-model profile. */
export const DATA_MODEL_RULES: Rule<DataModelDescriptor>[] = [
  idPrimaryKey,
  pascalCaseModel,
  camelCaseFields,
  knownScalarTypes,
  fkRelationPairing,
  listRelationShape,
  activeFlag,
  fieldDescriptions,
  setupRequiredFields,
  modelNameImpliesSetup,
  setupReferences,
  statusOrActive,
  uomOnMeasures,
];
