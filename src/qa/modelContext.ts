/**
 * Build the {@link FlowAnalysisContext} the flow analyzers cross-reference:
 * a data-model index (name → type + estimated record count) and a saved-transform
 * index (id → input-schema presence). Pure builders over already-decoded MCP rows
 * so they're unit-testable; the extension does the actual fetching.
 */
import { ModelInfo, SavedTransformInfo, FlowAnalysisContext } from './flowTypes';

/** Upper-case first character: `productionRun` → `ProductionRun`. */
export function pascalize(name: string): string {
  return name ? name[0].toUpperCase() + name.slice(1) : name;
}

/**
 * Parse Fuuz's human-formatted estimated record count: `"384"`, `"6k"`, `"59k"`,
 * `"37m"`, `"1.2m"`. Returns a number, or undefined when unparseable.
 */
export function parseRecordCount(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = String(v).trim().toLowerCase().replace(/,/g, '');
  if (!s) return undefined;
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*([kmbt])?$/);
  if (!m) { const n = Number(s); return Number.isFinite(n) ? n : undefined; }
  const mult: Record<string, number> = { '': 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
  return Math.round(parseFloat(m[1]) * (mult[m[2] ?? ''] ?? 1));
}

/** Data-change-capture + trigger config parsed from a model definition. */
export interface ModelMeta {
  dcc?: { exposed?: boolean; retentionDays?: number };
  triggers?: Record<string, string>;
}

/** Pull DCC + trigger config from a `DataModelDeployment.modelDefinition` JSON. */
export function parseModelMeta(modelDefinition: any): ModelMeta {
  const mfgx = modelDefinition?.metadata?.mfgx ?? {};
  const d = mfgx.dataChangeCapture;
  const dcc = d && typeof d === 'object'
    ? { exposed: typeof d.exposed === 'boolean' ? d.exposed : undefined, retentionDays: typeof d.retentionDays === 'number' ? d.retentionDays : undefined }
    : undefined;
  const triggers = mfgx.triggers && typeof mfgx.triggers === 'object' ? (mfgx.triggers as Record<string, string>) : undefined;
  return { dcc, triggers };
}

/**
 * Index `DataModel` rows by PascalCase name. Rows are expected to carry `name`,
 * `dataModelTypeId` (master|setup|transactional) and `estimatedRecordCount`.
 * A nested `dataModelType.name` is honored as a fallback for the type.
 */
export function buildModelIndex(rows: Record<string, any>[]): Map<string, ModelInfo> {
  const map = new Map<string, ModelInfo>();
  for (const r of rows) {
    const name = String(r.name ?? '').trim();
    if (!name) continue;
    const type = (r.dataModelTypeId ?? r.dataModelType?.name ?? r.dataModelType?.id ?? undefined) as string | undefined;
    map.set(name, {
      name,
      type: type ? String(type).toLowerCase() : undefined,
      recordCount: parseRecordCount(r.estimatedRecordCount),
      deploymentId: r.currentDataModelDeploymentId ? String(r.currentDataModelDeploymentId) : undefined,
    });
  }
  return map;
}

/** True when a saved-transform input schema is non-trivial (declares a contract). */
function schemaIsMeaningful(schema: unknown): boolean {
  if (!schema) return false;
  if (typeof schema === 'string') {
    const s = schema.trim();
    return s.length > 2 && s !== '{}' && s !== 'null';
  }
  if (typeof schema === 'object') {
    const o = schema as Record<string, unknown>;
    if (Array.isArray((o as any).required) && (o as any).required.length) return true;
    if (o.properties && typeof o.properties === 'object') return Object.keys(o.properties as object).length > 0;
    return Object.keys(o).length > 0;
  }
  return false;
}

/** Index `SavedTransform` rows by id. Rows carry `id`, `name`, `inputSchema`, `deprecated`. */
export function buildSavedTransformIndex(rows: Record<string, any>[]): Map<string, SavedTransformInfo> {
  const map = new Map<string, SavedTransformInfo>();
  for (const r of rows) {
    const id = String(r.id ?? '').trim();
    if (!id) continue;
    map.set(id, {
      id,
      name: r.name ? String(r.name) : undefined,
      hasInputSchema: schemaIsMeaningful(r.inputSchema),
      deprecated: r.deprecated === true || r.deprecated === 'true',
    });
  }
  return map;
}

/**
 * Resolve a query root field (camelCase, e.g. `productionRun`) to model info.
 * Tries the PascalCase form first, then the raw token.
 */
export function lookupModel(ctx: FlowAnalysisContext | undefined, rootField: string): ModelInfo | undefined {
  if (!ctx?.models) return undefined;
  return ctx.models.get(pascalize(rootField)) ?? ctx.models.get(rootField);
}
