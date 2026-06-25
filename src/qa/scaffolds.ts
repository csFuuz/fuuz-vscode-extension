/**
 * Compliant outline generators. Given an artifact kind, emit a starting
 * skeleton that already follows the platform conventions the compliance engine
 * checks for — so a developer scaffolds the right shape, fills it in, and runs
 * the checker before pushing to Fuuz over MCP.
 *
 * Outlines are intentionally human-facing (JSONC / JS with comments). The
 * data-model outline is the most fleshed out; the others encode the known shape
 * and will deepen as their compliance profiles grow.
 */
import { ArtifactKind } from './complianceTypes';

export interface Scaffold {
  /** Suggested file name under `.fuuz/scaffolds/`. */
  fileName: string;
  /** Editor language id for the opened document. */
  language: string;
  content: string;
}

function dataModel(name: string): Scaffold {
  return {
    fileName: `${name}.model.jsonc`,
    language: 'jsonc',
    content: `// Fuuz data-model outline — ${name}
// Conventions checked by Schema Doctor:
//  • id: ID! primary key (server-generated)
//  • camelCase fields, PascalCase model name
//  • every to-one relation \`x\` has a scalar foreign key \`xId\`
//  • scalar fields use known GraphQL scalar types
//  • an \`active: Boolean\` soft-state flag
{
  "name": "${name}",
  "fields": [
    { "name": "id", "type": "ID!", "description": "Primary unique identifier." },
    { "name": "code", "type": "String!", "description": "Auto-generated human-readable code." },
    { "name": "name", "type": "String!", "description": "Display name." },
    { "name": "active", "type": "Boolean!", "description": "Soft-state flag (default true)." }
    // , { "name": "ownerId", "type": "ID", "description": "FK to the owning record." }
  ],
  "relations": [
    // FK + object-relation twin, linked from: <field>Id -> to: id
    // { "field": "owner", "target": "User", "many": false }
  ]
}
`,
  };
}

function query(name: string): Scaffold {
  return {
    fileName: `${name}.query.jsonc`,
    language: 'jsonc',
    content: `// Fuuz query outline — ${name}
{
  "modelName": "${name}",
  // Always include id; use camelCase dot-paths for nested fields.
  "fields": ["id", "code", "name"],
  // JSON predicate; {} returns all. e.g. { "active": { "_eq": true } }
  "where": {},
  // [{ "field": "name", "direction": "asc" }]
  "orderBy": []
}
`,
  };
}

function flow(name: string): Scaffold {
  return {
    fileName: `${name}.flow.jsonc`,
    language: 'jsonc',
    content: `// Fuuz data-flow outline — ${name}
{
  "name": "${name}",
  "type": "Edge",                 // Document | Edge | Integration | Screen | System
  "inputs": [
    // { "name": "recordId", "type": "ID!" }
  ],
  "nodes": [
    // { "id": "fetch", "kind": "query", "model": "...", "fields": ["id"] },
    // { "id": "transform", "kind": "transform", "from": "fetch" },
    // { "id": "output", "kind": "output", "from": "transform" }
  ],
  "outputs": []
}
`,
  };
}

function screen(name: string): Scaffold {
  return {
    fileName: `${name}.screen.jsonc`,
    language: 'jsonc',
    content: `// Fuuz screen outline — ${name}
{
  "name": "${name}",
  "dataModel": "",                // primary model this screen binds to
  "layout": "list",               // list | detail | form | dashboard
  "components": [
    // { "kind": "table", "model": "...", "columns": ["code", "name", "active"] },
    // { "kind": "form", "model": "...", "fields": ["name", "active"] }
  ],
  "actions": [
    // { "label": "Save", "kind": "mutation", "primary": true }
  ]
}
`,
  };
}

function script(name: string): Scaffold {
  return {
    fileName: `${name}.script.js`,
    language: 'javascript',
    content: `// Fuuz script outline — ${name}
// Scripts receive an input payload and return an output object.
/** @param {object} input @returns {object} */
function ${name.replace(/[^A-Za-z0-9_]/g, '') || 'handler'}(input) {
  // ...transform input...
  return {};
}
`,
  };
}

export function scaffoldFor(kind: ArtifactKind, name: string): Scaffold {
  const safe = name.trim() || 'Untitled';
  switch (kind) {
    case 'dataModel': return dataModel(safe);
    case 'query': return query(safe);
    case 'flow': return flow(safe);
    case 'screen': return screen(safe);
    case 'script': return script(safe);
  }
}
