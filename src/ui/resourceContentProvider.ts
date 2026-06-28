/**
 * Read-only virtual documents for Fuuz resource content — a saved script's body
 * (`SavedTransform.transform`) or a saved query's text (`SavedQuery.queryText`) —
 * so you can open one from the resource tree and read what's actually written.
 *
 * Content is fetched lazily over the platform `system_query_model` tool when VS
 * Code opens the URI. The `fuuz:` scheme is registered read-only, so the editor
 * never prompts to save. URI shape:
 *   fuuz:/<friendly-name>.<ext>?model=SavedTransform&id=<id>&field=transform
 */
import * as vscode from 'vscode';
import { TenantConfigurationManager } from '../services/tenantConfigurationManager';
import { TenantDataService } from '../services/tenantDataService';
import { decodeTronPayload } from '../util/tron';

export const FUUZ_SCHEME = 'fuuz';

export class ResourceContentProvider implements vscode.TextDocumentContentProvider {
  constructor(
    private readonly configManager: TenantConfigurationManager,
    private readonly resourceService: TenantDataService,
  ) {}

  async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
    const params = new URLSearchParams(uri.query);
    const model = params.get('model');
    const id = params.get('id');
    const field = params.get('field');
    if (!model || !id || !field) return '// Fuuz: malformed resource link.';

    const tenant = this.configManager.getActiveTenant();
    if (!tenant) return '// Fuuz: no active tenant — select one and reopen.';

    const ctrl = new AbortController();
    token.onCancellationRequested(() => ctrl.abort());
    try {
      const res = await this.resourceService.queryModel(
        tenant, model, ['id', field], JSON.stringify({ id: { _eq: id } }), 'application', ctrl.signal,
      );
      const rows = res?.raw ? decodeTronPayload(res.raw) : [];
      const value = rows[0]?.[field];
      if (value == null || value === '') return `// Fuuz: "${id}" has no ${field} content.`;
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    } catch (err) {
      return `// Fuuz: couldn't load ${model} "${id}" over MCP.\n// ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}

/** Map a SavedTransform script language to a VS Code language id + file extension. */
function scriptLang(language: string | undefined): { ext: string; langId: string } {
  const l = (language ?? '').toLowerCase();
  if (l.includes('javascript') || l === 'js') return { ext: 'js', langId: 'javascript' };
  if (l.includes('json') && !l.includes('jsonata')) return { ext: 'json', langId: 'json' };
  return { ext: 'jsonata', langId: 'plaintext' }; // JSONata has no built-in grammar
}

/** A safe, readable file segment from a resource name. */
function safeName(name: string | undefined, fallback: string): string {
  const base = (name ?? fallback).trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base || fallback;
}

/** Build the virtual-document URI + target language for a tree node. */
export function resourceContentUri(contextValue: string, data: any): { uri: vscode.Uri; langId: string } | undefined {
  if (!data?.id) return undefined;
  let model: string, field: string, ext: string, langId: string;
  if (contextValue === 'script') {
    model = 'SavedTransform'; field = 'transform';
    ({ ext, langId } = scriptLang(data.language));
  } else if (contextValue === 'graphqlOp') {
    model = 'SavedQuery'; field = 'queryText'; ext = 'graphql'; langId = 'graphql';
  } else {
    return undefined;
  }
  const file = `${safeName(data.name, data.id)}.${ext}`;
  const query = `model=${encodeURIComponent(model)}&id=${encodeURIComponent(data.id)}&field=${field}`;
  // Encode the filename in the path so the editor tab + breadcrumb read nicely.
  const uri = vscode.Uri.from({ scheme: FUUZ_SCHEME, path: '/' + file, query });
  return { uri, langId };
}
