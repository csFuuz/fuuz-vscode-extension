import * as vscode from 'vscode';
import type { ErdGraph, ErdField, ErdInbound, ErdOutbound, ErdService } from '../util/erdTypes';

type Pos = Record<string, { x: number; y: number }>;

export interface ErdPanelOptions {
  title: string;
  graph: ErdGraph;
  /** Stable key (per tenant + diagram) under which node positions are persisted. */
  layoutKey: string;
  /** Lazy-load a model's scalar fields when the user expands its node. */
  loadFields: (name: string, service: ErdService) => Promise<ErdField[]>;
  /** Resolve a model's neighbors (nodes + in/out edges) when double-clicked, to grow the graph. */
  loadNeighbors: (name: string, service: ErdService) => Promise<ErdGraph>;
}

/**
 * Renders an interactive entity-relationship diagram in a webview using the
 * bundled React Flow app (`media/erd/erd.js`). Nodes are draggable, fields load
 * lazily on expand, and the manual layout is persisted per diagram so it's
 * restored next time. One panel is reused per `layoutKey`.
 */
export class ErdPanel {
  private static readonly panels = new Map<string, vscode.WebviewPanel>();

  static show(context: vscode.ExtensionContext, opts: ErdPanelOptions): void {
    const existing = ErdPanel.panels.get(opts.layoutKey);
    if (existing) {
      existing.reveal(vscode.ViewColumn.Active);
      // Re-send the (possibly refreshed) graph to the live webview.
      existing.webview.postMessage(initMessage(opts, context));
      return;
    }

    const mediaRoot = vscode.Uri.joinPath(context.extensionUri, 'media');
    const panel = vscode.window.createWebviewPanel('fuuzErd', `ERD: ${opts.title}`, vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [mediaRoot],
    });
    panel.iconPath = vscode.Uri.joinPath(mediaRoot, 'icon.png');
    ErdPanel.panels.set(opts.layoutKey, panel);
    panel.onDidDispose(() => ErdPanel.panels.delete(opts.layoutKey));

    const erd = mediaRoot.with({ path: mediaRoot.path + '/erd' });
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(erd, 'erd.js'));
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(erd, 'erd.css'));
    panel.webview.html = html(panel.webview, scriptUri, styleUri, opts.title);

    panel.webview.onDidReceiveMessage(async (msg: ErdOutbound) => {
      if (msg.type === 'ready') {
        panel.webview.postMessage(initMessage(opts, context));
      } else if (msg.type === 'expandNode') {
        let fields: ErdField[] = [];
        let error: string | undefined;
        try {
          fields = await opts.loadFields(msg.name, msg.service);
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        const reply: ErdInbound = { type: 'nodeFields', name: msg.name, fields, error };
        panel.webview.postMessage(reply);
      } else if (msg.type === 'expandNeighbors') {
        let graph: ErdGraph = { nodes: [], edges: [] };
        let error: string | undefined;
        try {
          graph = await opts.loadNeighbors(msg.name, msg.service);
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        const reply: ErdInbound = { type: 'addGraph', source: msg.name, graph, error };
        panel.webview.postMessage(reply);
      } else if (msg.type === 'queryModel') {
        // Reuse the interactive Query Data Model command (field picker → JSON
        // where → results open in an editor tab) for the clicked node.
        await vscode.commands.executeCommand('fuuz.queryModel', { node: { name: msg.name, service: msg.service } });
      } else if (msg.type === 'saveLayout') {
        await context.workspaceState.update(layoutStateKey(opts.layoutKey), msg.positions);
      }
    });
  }
}

function layoutStateKey(layoutKey: string): string {
  return `fuuz.erdLayout.${layoutKey}`;
}

function initMessage(opts: ErdPanelOptions, context: vscode.ExtensionContext): ErdInbound {
  const positions = context.workspaceState.get<Pos>(layoutStateKey(opts.layoutKey), {});
  return { type: 'init', title: opts.title, graph: opts.graph, positions };
}

function nonce(): string {
  let s = '';
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

function html(webview: vscode.Webview, scriptUri: vscode.Uri, styleUri: vscode.Uri, title: string): string {
  const n = nonce();
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${n}'`,
  ].join('; ');
  const safeTitle = title.replace(/[&<>"]/g, '');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>ERD: ${safeTitle}</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${n}" src="${scriptUri}"></script>
</body>
</html>`;
}
