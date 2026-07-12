/**
 * Fuuz relation foreign-key typing rule (pure — no VS Code/Node).
 *
 * In a Fuuz model definition, a relation is a pair: a resolved reference field
 * (e.g. `site: Site`) whose `metadata.mfgx.relation.fields.from` names a scalar
 * foreign-key field (e.g. `siteId`), and that FK scalar MUST be typed `ID`
 * (or `ID!`) — never `String`. A `String` FK silently breaks the reference.
 *
 * Operates on the raw model-definition JSON (the shape authored/mutated via the
 * Fuuz MCP), so it uses the EXACT `from` field name, not a name heuristic. Used
 * both to validate (QA) and to auto-fix (the Copilot build path).
 */

interface RawField {
  name?: string;
  type?: string;
  metadata?: { mfgx?: { relation?: { fields?: { from?: string; to?: string } } } };
  [k: string]: unknown;
}
interface RawModel {
  name?: string;
  fields?: RawField[];
  [k: string]: unknown;
}

/** Base GraphQL type without the non-null `!` suffix (`String!` → `String`). */
export function baseGraphqlType(t: string | undefined): string {
  return String(t ?? '').replace(/!+$/, '').trim();
}

/** The set of scalar field names that some relation points at via `fields.from`. */
export function relationFkFieldNames(model: RawModel | undefined): Set<string> {
  const out = new Set<string>();
  for (const f of model?.fields ?? []) {
    const from = f?.metadata?.mfgx?.relation?.fields?.from;
    if (typeof from === 'string' && from) out.add(from);
  }
  return out;
}

export interface FkTypeViolation {
  field: string;
  type: string;
  /** The corrected type (`ID` / `ID!`, preserving nullability). */
  expected: string;
}

/** Relation FK fields whose scalar type is not `ID`/`ID!`. */
export function findRelationFkTypeViolations(model: RawModel | undefined): FkTypeViolation[] {
  const fkNames = relationFkFieldNames(model);
  const out: FkTypeViolation[] = [];
  for (const f of model?.fields ?? []) {
    if (!f?.name || !fkNames.has(f.name)) continue;
    const type = String(f.type ?? '');
    if (baseGraphqlType(type) === 'ID') continue;
    out.push({ field: f.name, type, expected: `ID${type.trim().endsWith('!') ? '!' : ''}` });
  }
  return out;
}

/**
 * Return a copy of the model with every relation FK scalar retyped to `ID`
 * (preserving nullability) and the list of field names changed. Idempotent.
 */
export function fixRelationFkTypes(model: RawModel): { model: RawModel; fixed: string[] } {
  const violations = new Map(findRelationFkTypeViolations(model).map(v => [v.field, v.expected]));
  if (violations.size === 0) return { model, fixed: [] };
  const fixed: string[] = [];
  const fields = (model.fields ?? []).map(f => {
    if (f?.name && violations.has(f.name)) {
      fixed.push(f.name);
      return { ...f, type: violations.get(f.name)! };
    }
    return f;
  });
  return { model: { ...model, fields }, fixed };
}

/**
 * Walk an arbitrary MCP mutation payload, apply {@link fixRelationFkTypes} to
 * every embedded model definition (any object carrying a `fields` array of
 * field-like objects), and collect what was fixed. Never throws; returns the
 * input unchanged when it finds nothing model-shaped.
 */
export function fixRelationFksInPayload(payload: unknown): { payload: unknown; fixed: string[] } {
  const fixed: string[] = [];
  const looksLikeModel = (v: any): v is RawModel =>
    !!v && typeof v === 'object' && Array.isArray(v.fields) &&
    v.fields.some((f: any) => f && typeof f === 'object' && typeof f.name === 'string' && 'type' in f);

  const walk = (v: any): any => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      let obj: Record<string, unknown> = v;
      if (looksLikeModel(v)) {
        const res = fixRelationFkTypes(v);
        if (res.fixed.length) { fixed.push(...res.fixed); obj = res.model as Record<string, unknown>; }
      }
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(obj)) out[k] = walk(val);
      return out;
    }
    return v;
  };

  return { payload: walk(payload), fixed: [...new Set(fixed)] };
}
