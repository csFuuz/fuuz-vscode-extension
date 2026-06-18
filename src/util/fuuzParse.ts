/**
 * Pure helpers with no VS Code dependency — safe to unit-test in plain Node.
 * Covers: MCP tool classification, Fuuz "TRON" parsing, application assembly,
 * JWT decoding, and endpoint derivation.
 */
import { DataModel, EnterpriseEndpoints, McpTool, ModuleGroup } from '../types';
import { ErdEdgeJson, ErdGraph, ErdService } from './erdTypes';

// --- MCP tools ---------------------------------------------------------

/**
 * Classify an MCP tool. System (platform) tools are exactly the `system_`-
 * prefixed ones; everything else — including `data_flow_*` and any tenant flow
 * the server exposes — is grouped under data flows.
 */
export function classifyTool(name: string, description?: string): McpTool {
  return { name, description, kind: /^system_/.test(name) ? 'system' : 'dataflow' };
}

// --- TRON parsing ------------------------------------------------------

export type Rec = Record<string, string>;

/**
 * Parse Fuuz "TRON" output from a record query into plain objects. The payload
 * declares one class (e.g. `class A: id,name,moduleId`) then a `[A(...),…]`
 * array of tuples; values are quoted strings (which may contain commas/parens),
 * so arguments are split respecting quotes and nesting.
 */
export function parseTronRecords(text: string): Rec[] {
  const cls = text.match(/class\s+([A-Z])\s*:\s*([^\n]+)/);
  if (!cls) return [];
  const letter = cls[1];
  const fields = cls[2].split(',').map(s => s.trim());
  const start = text.indexOf('[', cls.index ?? 0);
  if (start < 0) return [];
  const records: Rec[] = [];
  // Scan quote-aware (like parseModelFieldRecords) and only treat the declared
  // class letter followed by `(` as a tuple start. A naive `/[A-Z]\(/g` regex
  // matches `Foo(` inside quoted string values (names/descriptions) and spawns
  // phantom records — so the boundary scan must honor quotes, not just readArgs.
  let inQuote = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '\\') i++;
      else if (ch === '"') inQuote = false;
      continue;
    }
    if (ch === '"') { inQuote = true; continue; }
    if (ch === letter && text[i + 1] === '(') {
      const args = readArgs(text, i + 1);
      if (!args) continue;
      const rec: Rec = {};
      fields.forEach((f, k) => (rec[f] = args[k] ?? ''));
      records.push(rec);
    }
  }
  return records;
}

/** Read comma-separated tuple arguments starting at an open paren, honoring quotes. */
export function readArgs(str: string, openParen: number): string[] | null {
  const args: string[] = [];
  let depth = 0;
  let cur = '';
  let inQuote = false;
  for (let i = openParen; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      if (ch === '\\') { cur += str[i + 1] ?? ''; i++; }
      else if (ch === '"') inQuote = false;
      else cur += ch;
      continue;
    }
    if (ch === '"') { inQuote = true; continue; }
    if (ch === '(') { depth++; if (depth === 1) continue; cur += ch; continue; }
    if (ch === ')') { depth--; if (depth === 0) { args.push(cur.trim()); return args; } cur += ch; continue; }
    if (ch === ',' && depth === 1) { args.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  return null;
}

/**
 * Parse `system_list_model_fields` output into one record per field. Unlike a
 * plain record query, this tool wraps the tuples in a JSON envelope —
 * `[{ "name": Model, "fields": [A("name","type","desc"), …] }]` with a single
 * `class A: name,type,description` declaration. Field descriptions can contain
 * markdown (parens, capital letters), so we scan quote-aware and only treat the
 * declared class letter followed by `(` as a tuple start — avoiding the false
 * matches a regex would hit inside descriptions. Summary detail only (no nested
 * metadata tuples).
 */
export function parseModelFieldRecords(text: string): Rec[] {
  const cls = text.match(/class\s+([A-Z])\s*:\s*([^\n]+)/);
  if (!cls) return [];
  const letter = cls[1];
  const cols = cls[2].split(',').map(s => s.trim());
  const recs: Rec[] = [];
  let inQuote = false;
  for (let i = cls.index ?? 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '\\') i++;
      else if (ch === '"') inQuote = false;
      continue;
    }
    if (ch === '"') { inQuote = true; continue; }
    if (ch === letter && text[i + 1] === '(') {
      const args = readArgs(text, i + 1);
      if (args) {
        const rec: Rec = {};
        cols.forEach((c, k) => (rec[c] = args[k] ?? ''));
        recs.push(rec);
      }
    }
  }
  return recs;
}

/** GraphQL/Fuuz scalar types — a field of any other base type is a relation. */
export const SCALAR_TYPES = new Set([
  'ID', 'String', 'Boolean', 'Int', 'Float', 'DateTime', 'Date', 'Time',
  'JSON', 'JSONObject', 'BigInt', 'Decimal', 'Long', 'Upload', 'Byte', 'UUID', 'Email', 'URL',
]);

/** Strip list/non-null markers (`[`, `]`, `!`) to get a type's base name. */
export function baseType(type: string): string {
  return type.replace(/[[\]!]/g, '').trim();
}

/** True when a field type refers to another model (not a built-in scalar). */
export function isRelationType(type: string): boolean {
  const base = baseType(type);
  return base.length > 0 && !SCALAR_TYPES.has(base);
}

/** Extract model names from a `system_list_models` TRON payload (tuple first args). */
export function extractModelNames(text: string): string[] {
  const names = new Set<string>();
  const re = /[A-Z]\("((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) names.add(m[1]);
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Web flows are designed to run inside the Fuuz web UI and **cannot be executed
 * from VS Code** (they need the browser/screen runtime), so the extension hides
 * the Execute action for them. Detection is by type name to tolerate label
 * variants ("Web", "Web Flow", "Webflow"). Conservative: only true on a match.
 */
export function isWebflowType(type?: string): boolean {
  return !!type && /web\s*flow|^web$|webflow/i.test(type.trim());
}

/** Module-group ids that belong to the platform/system surface, not the app. */
const SYSTEM_GROUP_IDS = new Set(['system']);

/**
 * Assemble the application hierarchy from the app-component record lists:
 * ModuleGroup → Module (moduleGroupId) → Screen / DataFlow / DataModel (moduleId).
 * The platform `system` module group is excluded — it belongs with the system
 * data models, not the application.
 */
export function assembleApplication(groups: Rec[], modules: Rec[], screens: Rec[], flows: Rec[], models: Rec[]): ModuleGroup[] {
  groups = groups.filter(g => !SYSTEM_GROUP_IDS.has(g.id));
  modules = modules.filter(m => !SYSTEM_GROUP_IDS.has(m.moduleGroupId ?? ''));
  const byKey = <T,>(rows: Rec[], key: string, map: (r: Rec) => T): Map<string, T[]> => {
    const out = new Map<string, T[]>();
    for (const r of rows) {
      const k = r[key] ?? '';
      if (!out.has(k)) out.set(k, []);
      out.get(k)!.push(map(r));
    }
    return out;
  };

  const screensByModule = byKey(screens, 'moduleId', s => ({ id: s.id, name: s.name }));
  const flowsByModule = byKey(flows, 'moduleId', f => ({ id: f.id, name: f.name, type: f.type || undefined }));
  const modelsByModule = byKey(models, 'moduleId', (d): DataModel => ({
    id: d.id,
    name: d.name,
    description: d.dataModelTypeId,
    fields: [],
    service: 'application',
  }));
  const modulesByGroup = byKey(modules, 'moduleGroupId', m => ({
    id: m.id,
    name: m.name,
    screens: screensByModule.get(m.id) ?? [],
    flows: flowsByModule.get(m.id) ?? [],
    dataModels: modelsByModule.get(m.id) ?? [],
  }));

  return groups.map(g => ({
    id: g.id,
    name: g.name,
    modules: modulesByGroup.get(g.id) ?? [],
    documents: [],
    scripts: [],
    graphql: [],
  }));
}

// --- JWT / identity ----------------------------------------------------

/** Decode (without verifying) a JWT's payload claims. */
export function decodeJwt(token: string): Record<string, any> | null {
  const parts = token.trim().split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Derive the environment slug from the token's audience/issuer host. */
export function environmentFromClaims(claims: Record<string, any>): string | undefined {
  const host: string | undefined = claims.aud || claims.iss;
  if (!host || typeof host !== 'string') return undefined;
  // e.g. "admin.fuuz.app" → "admin", "build.mfgx.fuuz.app" → "build.mfgx"
  const m = host.trim().replace(/^https?:\/\//, '').match(/^([^/]+)\.fuuz\.app/);
  return m ? m[1] : undefined;
}

/** Parse "Fuuz MCP Server: <Enterprise> / <Tenant>" with id fallbacks. */
export function namesFrom(serverName: string | undefined, enterpriseId: string, tenantId: string) {
  let enterpriseName = enterpriseId;
  let tenantName = tenantId;
  if (serverName) {
    const afterColon = serverName.includes(':') ? serverName.split(':').slice(1).join(':') : serverName;
    const [ent, ten] = afterColon.split('/').map(s => s.trim());
    if (ent) enterpriseName = ent;
    if (ten) tenantName = ten;
  }
  return { enterpriseName, tenantName };
}

// --- ERD ---------------------------------------------------------------

export interface ModelGraph {
  name: string;
  description?: string;
  fields: { name: string; type: string }[];
  relations: { field: string; target: string; many: boolean }[];
}

export interface ErdEdge {
  from: string;
  to: string;
  label: string;
  many: boolean;
}

/** Parse `system_list_model_references` TRON into edges, dropping audit/metadata noise. */
export function parseReferences(tron: string): ErdEdge[] {
  return parseTronRecords(tron)
    .filter(r => r.fromModelName && r.toModelName)
    .filter(r => !/^_/.test(r.fromModelFieldName || '') && !/^(createdBy|updatedBy)/.test(r.fromModelFieldName || ''))
    .map(r => ({
      from: r.fromModelName,
      to: r.toModelName,
      label: r.fromModelFieldName || '',
      many: (r.fromModelRelationType || '').trim().startsWith('['),
    }));
}

/**
 * Strip a trailing FK `Id`/`ID` suffix so a scalar foreign key (`areaId`) and its
 * object-relation twin (`area`) canonicalize to the same relationship. Only the
 * camelCase `…Id` convention is stripped (not words like "paid"/"valid").
 */
function canonicalBase(label: string): string {
  const stripped = label.replace(/I[dD]$/, '');
  return stripped.length ? stripped : label;
}

/**
 * Collapse raw directed references into ONE edge per real relationship, with
 * crow's-foot cardinality at each end:
 *
 *  1. Same-direction duplicates that are just the FK + its object twin
 *     (`areaId` and `area`) collapse to a single edge — so a model isn't joined
 *     to another twice for one relationship. Genuinely distinct foreign keys
 *     (e.g. `shipFromAddressId` and `shipToAddressId`) keep their own edges.
 *  2. A single `A → B` paired with a single `B → A` (a foreign key and its
 *     reverse collection) merges into one undirected edge whose ends carry the
 *     two cardinalities.
 */
export function relationshipEdges(raw: ErdEdge[]): ErdEdgeJson[] {
  type Dir = { from: string; to: string; label: string; many: boolean };
  const dir = new Map<string, Dir>();
  for (const e of raw) {
    if (!e.from || !e.to || e.from === e.to) continue;
    const base = canonicalBase(e.label);
    const key = `${e.from} ${e.to} ${base.toLowerCase()}`;
    const ex = dir.get(key);
    if (!ex) {
      dir.set(key, { from: e.from, to: e.to, label: base, many: e.many });
    } else {
      ex.many = ex.many || e.many;
      if (base.length < ex.label.length) ex.label = base; // prefer the object name
    }
  }

  const groups = new Map<string, Dir[]>();
  for (const d of dir.values()) {
    const key = [d.from, d.to].slice().sort().join(' ');
    const arr = groups.get(key);
    if (arr) arr.push(d);
    else groups.set(key, [d]);
  }

  const out: ErdEdgeJson[] = [];
  for (const grp of groups.values()) {
    const directions = new Set(grp.map(g => `${g.from}>${g.to}`));
    if (grp.length === 2 && directions.size === 2) {
      // Orient from the to-one (foreign-key owner) side so the crow's foot lands
      // on the owning model and the bar on the referenced model.
      const toOne = grp.find(g => !g.many) ?? grp[0];
      const other = grp.find(g => g !== toOne)!;
      out.push({ from: toOne.from, to: toOne.to, label: toOne.label, toMany: toOne.many, fromMany: other.many });
    } else {
      for (const g of grp) out.push({ from: g.from, to: g.to, label: g.label, toMany: g.many, fromMany: false });
    }
  }
  return out;
}

/**
 * JSON graph for one model: the focal model (with its fields) plus its outbound
 * relations and inbound references. Neighbor nodes are emitted WITHOUT fields so
 * the webview can lazy-load them on expand (avoids an MCP call per neighbor).
 */
export function buildModelGraph(graph: ModelGraph, references: ErdEdge[], service: ErdService = 'application'): ErdGraph {
  const model = graph.name;
  const outEdges: ErdEdge[] = graph.relations.map(r => ({ from: model, to: r.target, label: r.field, many: r.many }));
  const inEdges = references.filter(e => e.to === model && e.from !== model);
  const neighbors = new Set<string>([...outEdges.map(e => e.to), ...inEdges.map(e => e.from)].filter(n => n && n !== model));
  return {
    nodes: [
      { name: model, service, focal: true, fields: graph.fields },
      ...[...neighbors].map(n => ({ name: n, service })),
    ],
    edges: relationshipEdges([...outEdges, ...inEdges]),
  };
}

/**
 * JSON graph for a set of models, with only the relationships internal to the
 * set. Nodes carry no fields (loaded lazily) to keep large app/module ERDs cheap.
 */
export function buildSetGraph(modelNames: string[], references: ErdEdge[], service: ErdService = 'application'): ErdGraph {
  const names = new Set(modelNames);
  return {
    nodes: modelNames.map(n => ({ name: n, service })),
    edges: relationshipEdges(references.filter(e => names.has(e.from) && names.has(e.to))),
  };
}

// --- Endpoint derivation ----------------------------------------------

export interface EndpointInput {
  environment?: string;
  mcpEndpoint?: string;
  mcpServerUrl?: string;
  flowExecutionUrl?: string;
  webhookUrl?: string;
}

/** API base for an enterprise: `https://api.{environment}.fuuz.app`, else `mcpEndpoint`. */
export function deriveApiBase(e: EndpointInput): string {
  const env = e.environment?.trim();
  if (env) return `https://api.${env}.fuuz.app`;
  return (e.mcpEndpoint ?? '').replace(/\/$/, '');
}

/** Resolve every endpoint; explicit overrides win, else derived from the API base. */
export function deriveEndpoints(e: EndpointInput): EnterpriseEndpoints {
  const base = deriveApiBase(e);
  const pick = (override: string | undefined, suffix: string) =>
    override && override.trim() ? override.trim() : `${base}${suffix}`;
  return {
    apiBase: base,
    flowExecution: pick(e.flowExecutionUrl, '/orchestration/executeFlow'),
    webhook: pick(e.webhookUrl, '/webhook/post/'),
    mcp: pick(e.mcpServerUrl, '/mcp'),
  };
}
