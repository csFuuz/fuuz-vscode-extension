/**
 * Pure helpers with no VS Code dependency — safe to unit-test in plain Node.
 * Covers: MCP tool classification, Fuuz "TRON" parsing, application assembly,
 * JWT decoding, and endpoint derivation.
 */
import { DataModel, EnterpriseEndpoints, McpTool, ModuleGroup } from '../types';

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
  const cls = text.match(/class\s+[A-Z]\s*:\s*([^\n]+)/);
  if (!cls) return [];
  const fields = cls[1].split(',').map(s => s.trim());
  const start = text.indexOf('[', cls.index ?? 0);
  if (start < 0) return [];
  const body = text.slice(start);
  const records: Rec[] = [];
  const re = /[A-Z]\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const args = readArgs(body, m.index + m[0].length - 1);
    if (!args) continue;
    const rec: Rec = {};
    fields.forEach((f, i) => (rec[f] = args[i] ?? ''));
    records.push(rec);
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

/** Extract model names from a `system_list_models` TRON payload (tuple first args). */
export function extractModelNames(text: string): string[] {
  const names = new Set<string>();
  const re = /[A-Z]\("((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) names.add(m[1]);
  return [...names].sort((a, b) => a.localeCompare(b));
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
  const flowsByModule = byKey(flows, 'moduleId', f => ({ id: f.id, name: f.name }));
  const modelsByModule = byKey(models, 'moduleId', (d): DataModel => ({
    id: d.id,
    name: d.name,
    description: d.dataModelTypeId,
    fields: [],
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

/** Sanitize an identifier so it's a valid Mermaid erDiagram entity/attr token. */
export function safeId(id: string): string {
  return (id || '_').replace(/[^A-Za-z0-9_]/g, '_');
}

export interface ErdEntity {
  name: string;
  fields?: { name: string; type: string }[];
}
export interface ErdEdge {
  from: string;
  to: string;
  label: string;
  many: boolean;
}

/** Render a Mermaid `erDiagram` from entities (optional attributes) + edges. */
export function toErd(entities: ErdEntity[], edges: ErdEdge[]): string {
  const lines: string[] = ['erDiagram'];
  const seen = new Set<string>();
  for (const e of entities) {
    const n = safeId(e.name);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    lines.push(`  ${n} {`);
    for (const f of (e.fields ?? []).slice(0, 40)) {
      lines.push(`    ${safeId(f.type.replace(/[[\]!]/g, '')) || 'field'} ${safeId(f.name)}`);
    }
    lines.push('  }');
  }
  const edgeSeen = new Set<string>();
  for (const ed of edges) {
    const f = safeId(ed.from);
    const t = safeId(ed.to);
    if (!f || !t || f === t || !seen.has(f) || !seen.has(t)) continue;
    const key = `${f}|${t}|${ed.label}`;
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    lines.push(`  ${f} ${ed.many ? '||--o{' : '}o--||'} ${t} : ${safeId(ed.label) || 'ref'}`);
  }
  return lines.join('\n');
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

/** ERD for one model: its attributes + outbound relations + inbound references. */
export function buildModelErd(graph: ModelGraph, references: ErdEdge[]): string {
  const model = graph.name;
  const outEdges: ErdEdge[] = graph.relations.map(r => ({ from: model, to: r.target, label: r.field, many: r.many }));
  const inEdges = references.filter(e => e.to === model && e.from !== model);
  const neighbors = new Set<string>([...outEdges.map(e => e.to), ...inEdges.map(e => e.from)].filter(n => n && n !== model));
  const entities: ErdEntity[] = [{ name: model, fields: graph.fields }, ...[...neighbors].map(n => ({ name: n }))];
  return toErd(entities, [...outEdges, ...inEdges]);
}

/** ERD for a set of models, showing only relationships internal to the set. */
export function buildSetErd(modelNames: string[], references: ErdEdge[]): string {
  const names = new Set(modelNames);
  const edges = references.filter(e => names.has(e.from) && names.has(e.to));
  return toErd(modelNames.map(n => ({ name: n })), edges);
}

/** Back-compat single-model ERD (outbound relations only). */
export function toMermaid(graph: ModelGraph): string {
  return buildModelErd(graph, []);
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
