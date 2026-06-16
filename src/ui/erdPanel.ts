import * as vscode from 'vscode';

/**
 * Renders an entity-relationship diagram (Mermaid `erDiagram` text) in a webview,
 * with an export-to-`.mmd` action. Used for single-model, module, and
 * application-level ERDs.
 */
export class ErdPanel {
  static show(context: vscode.ExtensionContext, title: string, mermaid: string, note?: string): void {
    const mediaRoot = vscode.Uri.joinPath(context.extensionUri, 'media');
    const panel = vscode.window.createWebviewPanel('fuuzErd', `ERD: ${title}`, vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [mediaRoot],
    });
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
    const mermaidUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'mermaid.min.js'));
    panel.webview.html = html(panel.webview, mermaid, title, mermaidUri, note);
    panel.webview.onDidReceiveMessage(async msg => {
      if (msg?.type === 'export') {
        const uri = await vscode.window.showSaveDialog({
          saveLabel: 'Export ERD',
          filters: { Mermaid: ['mmd'] },
          defaultUri: vscode.Uri.file(`${title.replace(/[^A-Za-z0-9_-]/g, '_')}.mmd`),
        });
        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(mermaid, 'utf8'));
          vscode.window.showInformationMessage(`Fuuz: ERD exported to ${uri.fsPath}`);
        }
      }
    });
  }
}

function nonce(): string {
  let s = '';
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

function html(webview: vscode.Webview, mermaid: string, title: string, mermaidUri: vscode.Uri, note?: string): string {
  const n = nonce();
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${n}' ${webview.cspSource}`,
  ].join('; ');
  const escaped = mermaid.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  const safeTitle = title.replace(/[&<>]/g, '');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    html, body { height: 100%; }
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); margin: 0; padding: 10px 16px; box-sizing: border-box; display: flex; flex-direction: column; }
    header { display: flex; align-items: center; gap: 10px; }
    h1 { font-size: 14px; margin: 0; flex: 1; }
    .note { color: var(--vscode-descriptionForeground); font-size: 12px; margin: 4px 0; }
    button { padding: 4px 10px; border: none; border-radius: 3px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    #viewport { position: relative; flex: 1; min-height: 300px; overflow: hidden; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-editor-background); cursor: grab; }
    #viewport.grabbing { cursor: grabbing; }
    #canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
    #zoombar { position: absolute; right: 10px; bottom: 10px; display: flex; gap: 6px; }
    #zoombar button { width: 30px; height: 28px; padding: 0; font-size: 15px; }
    .hint { position: absolute; left: 10px; bottom: 10px; font-size: 11px; color: var(--vscode-descriptionForeground); }
    .err { color: var(--vscode-errorForeground); padding: 12px; }
    details { margin-top: 8px; }
    summary { cursor: pointer; color: var(--vscode-textLink-foreground); }
    pre { background: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 6px; overflow: auto; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; max-height: 30vh; }
  </style>
</head>
<body>
  <header>
    <h1>ERD — ${safeTitle}</h1>
    <button id="fit" class="secondary">Fit</button>
    <button id="export">Export .mmd</button>
  </header>
  ${note ? `<div class="note">${note.replace(/[&<>]/g, '')}</div>` : ''}
  <div id="viewport">
    <div id="canvas"><div id="diagram" class="mermaid">${escaped}</div></div>
    <div id="zoombar"><button id="zout" title="Zoom out">−</button><button id="zin" title="Zoom in">+</button></div>
    <div class="hint">scroll to zoom · drag to pan</div>
  </div>
  <div id="fallback" class="err" style="display:none">Couldn't render the diagram. The Mermaid source is below.</div>
  <details><summary>Mermaid source</summary><pre>${escaped}</pre></details>
  <script nonce="${n}" src="${mermaidUri}"></script>
  <script nonce="${n}">
    const vscode = acquireVsCodeApi();
    document.getElementById('export').addEventListener('click', () => vscode.postMessage({ type: 'export' }));

    const viewport = document.getElementById('viewport');
    const canvas = document.getElementById('canvas');
    let scale = 1, tx = 0, ty = 0;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    function apply() { canvas.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; }

    function zoomAt(cx, cy, factor) {
      const next = clamp(scale * factor, 0.05, 8);
      const k = next / scale;
      tx = cx - (cx - tx) * k;
      ty = cy - (cy - ty) * k;
      scale = next;
      apply();
    }
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = viewport.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });

    let dragging = false, sx = 0, sy = 0;
    viewport.addEventListener('pointerdown', (e) => { dragging = true; sx = e.clientX - tx; sy = e.clientY - ty; viewport.classList.add('grabbing'); viewport.setPointerCapture(e.pointerId); });
    viewport.addEventListener('pointermove', (e) => { if (!dragging) return; tx = e.clientX - sx; ty = e.clientY - sy; apply(); });
    const endDrag = () => { dragging = false; viewport.classList.remove('grabbing'); };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointerleave', endDrag);

    document.getElementById('zin').addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.25); });
    document.getElementById('zout').addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / 1.25); });

    function fit() {
      const svg = canvas.querySelector('svg');
      if (!svg) return;
      const r = viewport.getBoundingClientRect();
      const bb = svg.getBoundingClientRect();
      const w = bb.width / scale, h = bb.height / scale; // natural size (undo current scale)
      if (!w || !h) return;
      scale = clamp(Math.min(r.width / w, r.height / h) * 0.95, 0.05, 8);
      tx = (r.width - w * scale) / 2;
      ty = (r.height - h * scale) / 2;
      apply();
    }
    document.getElementById('fit').addEventListener('click', fit);

    (async () => {
      try {
        if (!window.mermaid) throw new Error('mermaid not loaded');
        const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');
        window.mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default', maxTextSize: 500000, er: { useMaxWidth: false } });
        await window.mermaid.run({ querySelector: '#diagram' });
        const svg = canvas.querySelector('svg');
        if (svg) { svg.style.maxWidth = 'none'; }
        fit();
      } catch (e) {
        document.getElementById('fallback').textContent = 'Couldn\\'t render the diagram: ' + (e && e.message ? e.message : e);
        document.getElementById('fallback').style.display = 'block';
      }
    })();
  </script>
</body>
</html>`;
}
