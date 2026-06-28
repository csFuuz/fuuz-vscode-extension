/**
 * Build a normalized {@link ScreenModel} from raw Fuuz ScreenElement rows. A
 * screen is a flat list of records; this extracts the few fields the analyzer
 * cares about (type, the element's inline transform, its config size) defensively
 * — configuration may be absent, a string, or a nested object. Pure + no imports
 * beyond the model types, so it's unit-testable in plain Node.
 */
import { ScreenElementNode, ScreenModel } from './screenTypes';

/** Element types that behave as user-input/field elements (carry field transforms). */
const FIELD_TYPES = new Set([
  'TextInput', 'SelectInput', 'NumberInput', 'FloatInput', 'IntegerInput',
  'DateInput', 'DateTimeInput', 'DateRangeInput', 'DurationInput', 'ColorInput',
  'OptionsInput', 'CustomFieldsInput', 'ScanTextInput', 'Switch',
]);

/** Treat a value as a usable transform only when it's a non-empty string. */
function nonEmpty(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

/** Extract the transform expression attached directly to one row, if any. */
function extractTransform(type: string, configuration: any): string | undefined {
  if (!configuration || typeof configuration !== 'object') return undefined;
  if (type === 'Form') return nonEmpty(configuration.query?.dataTransform?.transform);
  if (type === 'TableColumn' || FIELD_TYPES.has(type)) return nonEmpty(configuration.transform);
  return undefined;
}

/** Element types that bind a data model via a query (Form/Table). */
const DATA_BOUND = new Set(['Form', 'Table']);

/** The data model an element binds to, if any. */
function boundModel(type: string, configuration: any): string | undefined {
  if (!DATA_BOUND.has(type) || !configuration || typeof configuration !== 'object') return undefined;
  return nonEmpty(configuration.query?.model);
}

/** Whether a Form/Table query carries a non-empty filter (parameters.filter or a where). */
function queryHasFilter(type: string, configuration: any): boolean | undefined {
  if (!DATA_BOUND.has(type) || !configuration || typeof configuration !== 'object') return undefined;
  const q = configuration.query;
  if (!q || typeof q !== 'object') return undefined;
  let params: any = q.parameters;
  if (typeof params === 'string') { try { params = JSON.parse(params); } catch { params = undefined; } }
  const filter = params?.filter ?? params?.where ?? q.where;
  return !!filter && typeof filter === 'object' && Object.keys(filter).length > 0;
}

/** Approximate serialized size of a configuration blob (chars); 0 on failure. */
function sizeOf(configuration: unknown): number {
  try {
    return JSON.stringify(configuration ?? '').length;
  } catch {
    return 0;
  }
}

export function buildScreenModel(
  name: string,
  rows: Record<string, any>[],
  versionNotes?: { total: number; withNotes: number },
): ScreenModel {
  const elements: ScreenElementNode[] = (rows ?? []).map(row => {
    const type = String(row?.type ?? '');
    return {
      id: String(row?.id ?? ''),
      name: row?.name ?? undefined,
      type,
      componentName: row?.componentName ?? undefined,
      label: row?.label ?? undefined,
      transform: extractTransform(type, row?.configuration),
      model: boundModel(type, row?.configuration),
      hasFilter: queryHasFilter(type, row?.configuration),
      configSize: sizeOf(row?.configuration),
    };
  });
  const totalConfigSize = elements.reduce((n, e) => n + e.configSize, 0);
  return { name, elements, totalConfigSize, versionNotes };
}
