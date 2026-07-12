/**
 * Pure planning for mirroring a Fuuz tenant's as-built app into a GitHub repo.
 * Produces a deterministic list of {path, content} files structured the same as
 * the extension's Resources tree (ModuleGroup → Module → screens/flows/...).
 * No `vscode`/git/fs dependency so it can be unit-tested under `node --test`.
 * This module only plans (paths + string contents); the actual git push and
 * component fetching happen elsewhere.
 */

/** A single as-built app component pulled from a tenant, grouped by module. */
export interface AppComponent {
  kind: 'screen' | 'flow' | 'dataModel' | 'script' | 'query' | 'document';
  id: string;
  name: string;
  moduleGroup: string;
  module: string;
  definition: unknown;
}

/** An MCP tool exposed by the tenant. `system` tools are built-in; `dataflow` are custom. */
export interface McpTool {
  name: string;
  kind: 'system' | 'dataflow';
  description?: string;
  definition?: unknown;
}

/** One planned file: repo-relative path plus its full string content. */
export interface MirrorFile {
  path: string;
  content: string;
}

/** The full mirror plan: files to write plus counts of intentionally skipped items. */
export interface MirrorPlan {
  files: MirrorFile[];
  skipped: { systemModels: number; systemTools: number };
}

/** Map a component `kind` to its plural directory segment. */
const PLURAL_KIND: Record<AppComponent['kind'], string> = {
  screen: 'screens',
  flow: 'flows',
  dataModel: 'dataModels',
  script: 'scripts',
  query: 'queries',
  document: 'documents',
};

/**
 * Turn an arbitrary string into a filesystem-safe path segment: non
 * `[A-Za-z0-9._-]` chars become `-`, repeats collapse, leading/trailing `-`
 * are trimmed, and an empty result falls back to `unnamed`.
 */
export function safeSeg(s: string): string {
  const cleaned = String(s ?? '')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'unnamed';
}

/** Repo-relative path for a component: `app/<mg>/<module>/<pluralKind>/<name>.json`. */
export function componentPath(c: AppComponent): string {
  return [
    'app',
    safeSeg(c.moduleGroup),
    safeSeg(c.module),
    PLURAL_KIND[c.kind],
    `${safeSeg(c.name)}.json`,
  ].join('/');
}

/** True when a component is a system data model (system flag set or in the `system` group). */
function isSystemModel(c: AppComponent): boolean {
  return c.kind === 'dataModel' && ((c as any).system === true || c.moduleGroup === 'system');
}

/** Pretty JSON serialization used for every planned file. */
function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Build the deterministic mirror plan. Custom components are written under
 * `app/...`; system data models are excluded (unless `includeSystemDataModels`)
 * and only custom (`dataflow`) MCP tools are written to `tools/custom/`. A
 * `README.md` summary and a `MIRROR.md` manifest are always emitted, and files
 * are sorted by path.
 */
export function planMirror(
  components: AppComponent[],
  tools: McpTool[],
  opts?: { includeSystemDataModels?: boolean },
): MirrorPlan {
  const includeSystemModels = opts?.includeSystemDataModels === true;
  const files: MirrorFile[] = [];
  const skipped = { systemModels: 0, systemTools: 0 };
  const counts: Record<AppComponent['kind'], number> = {
    screen: 0,
    flow: 0,
    dataModel: 0,
    script: 0,
    query: 0,
    document: 0,
  };

  for (const c of components) {
    if (isSystemModel(c) && !includeSystemModels) {
      skipped.systemModels++;
      continue;
    }
    counts[c.kind]++;
    files.push({
      path: componentPath(c),
      content: pretty({
        id: c.id,
        name: c.name,
        moduleGroup: c.moduleGroup,
        module: c.module,
        definition: c.definition,
      }),
    });
  }

  for (const t of tools) {
    if (t.kind !== 'dataflow') {
      if (t.kind === 'system') skipped.systemTools++;
      continue;
    }
    files.push({ path: `tools/custom/${safeSeg(t.name)}.json`, content: pretty(t) });
  }

  files.push({ path: 'README.md', content: renderReadme(counts) });
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // MIRROR.md lists every other written path; compute after the rest are sorted.
  const manifest = renderManifest(files.map((f) => f.path));
  files.push({ path: 'MIRROR.md', content: manifest });
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { files, skipped };
}

/** Render the top-level README with component counts by kind. */
function renderReadme(counts: Record<AppComponent['kind'], number>): string {
  const lines = [
    '# As-built Fuuz app mirror',
    '',
    'This repository mirrors the as-built app of a Fuuz tenant, structured the',
    'same as the extension Resources tree (ModuleGroup → Module → components).',
    '',
    '## Component counts',
    '',
    `- screens: ${counts.screen}`,
    `- flows: ${counts.flow}`,
    `- dataModels: ${counts.dataModel}`,
    `- scripts: ${counts.script}`,
    `- queries: ${counts.query}`,
    `- documents: ${counts.document}`,
    '',
  ];
  return lines.join('\n');
}

/** Render the MIRROR.md manifest listing every written path. */
function renderManifest(paths: string[]): string {
  const lines = ['# Mirror manifest', '', ...paths.map((p) => `- ${p}`), ''];
  return lines.join('\n');
}

/** Inputs for wiki-page planning: UAT docs by role and QA results by run. */
export interface WikiInput {
  uatDocs: { role: string; filename: string; markdown: string }[];
  qaResults: { runId: string; markdown: string }[];
}

/**
 * Plan the GitHub wiki pages: one `UAT-<role>.md` per UAT doc, one
 * `QA-<runId>.md` per QA result, plus a `Home.md` index linking them all.
 */
export function planWikiPages(w: WikiInput): MirrorFile[] {
  const files: MirrorFile[] = [];

  for (const doc of w.uatDocs) {
    files.push({ path: `UAT-${safeSeg(doc.role)}.md`, content: doc.markdown });
  }
  for (const qa of w.qaResults) {
    files.push({ path: `QA-${safeSeg(qa.runId)}.md`, content: qa.markdown });
  }

  const home = [
    '# Home',
    '',
    '## UAT',
    '',
    ...w.uatDocs.map((d) => `- [[UAT-${safeSeg(d.role)}]] (${d.filename})`),
    '',
    '## QA',
    '',
    ...w.qaResults.map((q) => `- [[QA-${safeSeg(q.runId)}]]`),
    '',
  ].join('\n');
  files.push({ path: 'Home.md', content: home });

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return files;
}
