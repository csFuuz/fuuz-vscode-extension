/**
 * Parse a local artifact *outline* (the scaffolds Schema Doctor generates, or
 * any candidate a developer authors) into an {@link ArtifactDescriptor} the
 * compliance engine can score — so a feature can be checked BEFORE it is pushed
 * to Fuuz. Pure; no VS Code/Node imports.
 */
import { ArtifactDescriptor, ArtifactKind, DataModelDescriptor, FieldDescriptor, RelationDescriptor } from './complianceTypes';

/** Infer the artifact kind from a scaffold file name (`Foo.model.jsonc` → dataModel). */
export function kindFromFileName(fileName: string): ArtifactKind | undefined {
  const f = fileName.toLowerCase();
  if (f.endsWith('.model.jsonc') || f.endsWith('.model.json')) return 'dataModel';
  if (f.endsWith('.query.jsonc') || f.endsWith('.query.json')) return 'query';
  if (f.endsWith('.flow.jsonc') || f.endsWith('.flow.json')) return 'flow';
  if (f.endsWith('.screen.jsonc') || f.endsWith('.screen.json')) return 'screen';
  if (f.endsWith('.script.js') || f.endsWith('.script.ts')) return 'script';
  return undefined;
}

/** Strip `//` line and block comments so JSONC outlines parse as JSON. */
export function stripJsonComments(text: string): string {
  let out = '';
  let inStr = false, inLine = false, inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inLine) { if (c === '\n') { inLine = false; out += c; } continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) { out += c; if (c === '\\') { out += n ?? ''; i++; } else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    out += c;
  }
  return out;
}

/** Remove trailing commas that JSONC tolerates but JSON.parse does not. */
function stripTrailingCommas(text: string): string {
  return text.replace(/,(\s*[}\]])/g, '$1');
}

export class OutlineParseError extends Error {}

/**
 * Parse outline `text` of a given `kind` into a descriptor. Scripts are kept as
 * raw source (regex-checked); JSONC kinds are comment-stripped then JSON-parsed.
 */
export function parseOutline(kind: ArtifactKind, text: string, fallbackName = 'Untitled'): ArtifactDescriptor {
  if (kind === 'script') {
    return { kind: 'script', name: fallbackName, raw: { source: text } };
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(stripTrailingCommas(stripJsonComments(text)));
  } catch (e) {
    throw new OutlineParseError(`Outline is not valid JSON/JSONC: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!obj || typeof obj !== 'object') throw new OutlineParseError('Outline must be a JSON object.');

  if (kind === 'dataModel') {
    const fields: FieldDescriptor[] = Array.isArray(obj.fields)
      ? (obj.fields as any[]).map(f => ({ name: String(f?.name ?? ''), type: String(f?.type ?? ''), description: f?.description }))
      : [];
    const relations: RelationDescriptor[] = Array.isArray(obj.relations)
      ? (obj.relations as any[]).map(r => ({ field: String(r?.field ?? ''), target: String(r?.target ?? ''), many: !!r?.many }))
      : [];
    const d: DataModelDescriptor = { kind: 'dataModel', name: String(obj.name ?? fallbackName), fields, relations };
    return d;
  }

  const name = String(obj.name ?? obj.modelName ?? fallbackName);
  return { kind, name, raw: obj };
}
