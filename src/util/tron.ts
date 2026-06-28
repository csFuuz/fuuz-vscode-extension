/**
 * Decode a `system_query_model` payload into fully-realized records — nested
 * objects and arrays included — so analyzers can read `configuration.query`,
 * `configuration.transform`, `configuration.branches[]`, etc. as real values.
 *
 * The MCP returns one of two shapes after a preamble line:
 *   1. Plain JSON: `[ { "name": …, "configuration": { … } } ]`  (often a single
 *      record, or when values don't repeat).
 *   2. TRON: one or more `class X: f1,f2,…` declarations, then an array of
 *      tuples `[A(…), …]` where a value may itself be a `Y(…)` tuple (decoded
 *      via class Y's field names) or a `[ … ]` array.
 *
 * {@link parseTronRecords} in fuuzParse.ts remains the flat (one-level, string-
 * valued) parser used elsewhere; this decoder is the recursive superset used by
 * the flow/screen compliance analyzers. No VS Code/Node imports — unit-testable.
 */

type Json = any;

/** Slice from the first `[` or `class` to the end (drop the human preamble). */
function payloadStart(text: string): number {
  const cls = text.indexOf('class ');
  const arr = text.indexOf('[');
  if (cls === -1) return arr;
  if (arr === -1) return cls;
  return Math.min(cls, arr);
}

/**
 * Decode a query payload to an array of records. Returns `[]` on anything
 * unparseable so callers degrade gracefully rather than throw.
 */
export function decodeTronPayload(text: string): Record<string, Json>[] {
  if (!text) return [];
  const start = payloadStart(text);
  if (start < 0) return [];
  const body = text.slice(start);

  // Shape 1: plain JSON array (no class table).
  if (!body.startsWith('class ')) {
    try {
      const parsed = JSON.parse(body);
      return Array.isArray(parsed) ? parsed.filter(isObject) : [];
    } catch {
      return [];
    }
  }

  // Shape 2: TRON with one or more class declarations.
  const classes = readClassTable(body);
  const arrStart = body.indexOf('[', lastClassEnd(body));
  if (arrStart < 0) return [];
  const { value } = readValue(body, arrStart, classes);
  return Array.isArray(value) ? value.filter(isObject) : [];
}

const isObject = (v: any): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Map of class letter → ordered field names, e.g. `A → [id, name, type]`. */
type ClassTable = Map<string, string[]>;

function readClassTable(body: string): ClassTable {
  const table: ClassTable = new Map();
  const re = /class\s+([A-Za-z])\s*:\s*([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    table.set(m[1], m[2].split(',').map(s => s.trim()).filter(Boolean));
  }
  return table;
}

/** Index just past the last `class …` declaration line. */
function lastClassEnd(body: string): number {
  let end = 0;
  const re = /class\s+[A-Za-z]\s*:\s*[^\n]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) end = m.index + m[0].length;
  return end;
}

/**
 * Read one TRON value starting at `i`. Dispatches on the first non-space char:
 * `[` array, `"` string, `A(` tuple (when A is a known class), else a bareword
 * scalar (number / null / true / false / unquoted token).
 * Returns the decoded value and the index just past it.
 */
function readValue(s: string, i: number, classes: ClassTable): { value: Json; next: number } {
  i = skipWs(s, i);
  const ch = s[i];
  if (ch === '[') return readArray(s, i, classes);
  if (ch === '"') return readString(s, i);
  if (ch === '{') return readJsonObject(s, i); // defensive: embedded JSON object
  // A class tuple: a known class letter immediately followed by `(`.
  if (classes.has(ch) && s[i + 1] === '(') return readTuple(s, i, classes);
  return readScalar(s, i);
}

function readArray(s: string, i: number, classes: ClassTable): { value: Json[]; next: number } {
  const out: Json[] = [];
  i++; // past '['
  i = skipWs(s, i);
  if (s[i] === ']') return { value: out, next: i + 1 };
  for (;;) {
    const { value, next } = readValue(s, i, classes);
    out.push(value);
    i = skipWs(s, next);
    if (s[i] === ',') { i = skipWs(s, i + 1); continue; }
    if (s[i] === ']') return { value: out, next: i + 1 };
    if (i >= s.length) return { value: out, next: i };
    i++; // tolerate stray separators
  }
}

function readTuple(s: string, i: number, classes: ClassTable): { value: Record<string, Json>; next: number } {
  const letter = s[i];
  const fields = classes.get(letter) ?? [];
  i += 2; // past 'A('
  const obj: Record<string, Json> = {};
  let k = 0;
  i = skipWs(s, i);
  if (s[i] === ')') return { value: obj, next: i + 1 };
  for (;;) {
    const { value, next } = readValue(s, i, classes);
    if (fields[k] !== undefined) obj[fields[k]] = value;
    k++;
    i = skipWs(s, next);
    if (s[i] === ',') { i = skipWs(s, i + 1); continue; }
    if (s[i] === ')') return { value: obj, next: i + 1 };
    if (i >= s.length) return { value: obj, next: i };
    i++;
  }
}

function readString(s: string, i: number): { value: string; next: number } {
  i++; // past opening quote
  let out = '';
  for (; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\') {
      const n = s[i + 1];
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n ?? '';
      i++;
      continue;
    }
    if (ch === '"') return { value: out, next: i + 1 };
    out += ch;
  }
  return { value: out, next: i };
}

/** Defensive: a value that is itself an embedded JSON object `{ … }`. */
function readJsonObject(s: string, i: number): { value: Json; next: number } {
  let depth = 0, inQ = false;
  for (let j = i; j < s.length; j++) {
    const ch = s[j];
    if (inQ) { if (ch === '\\') j++; else if (ch === '"') inQ = false; continue; }
    if (ch === '"') inQ = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) {
      const slice = s.slice(i, j + 1);
      try { return { value: JSON.parse(slice), next: j + 1 }; } catch { return { value: slice, next: j + 1 }; }
    } }
  }
  return { value: s.slice(i), next: s.length };
}

const SCALAR_END = new Set([',', ')', ']']);

function readScalar(s: string, i: number): { value: Json; next: number } {
  let raw = '';
  for (; i < s.length; i++) {
    if (SCALAR_END.has(s[i])) break;
    raw += s[i];
  }
  raw = raw.trim();
  if (raw === 'null' || raw === '') return { value: null, next: i };
  if (raw === 'true') return { value: true, next: i };
  if (raw === 'false') return { value: false, next: i };
  const n = Number(raw);
  return { value: Number.isFinite(n) && /^-?\d/.test(raw) ? n : raw, next: i };
}

function skipWs(s: string, i: number): number {
  while (i < s.length && (s[i] === ' ' || s[i] === '\n' || s[i] === '\r' || s[i] === '\t')) i++;
  return i;
}
