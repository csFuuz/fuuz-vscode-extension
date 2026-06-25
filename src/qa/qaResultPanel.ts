import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { parseQaResult } from './resultTypes';
import type { CollectedLog } from './logCollector';
import type { QaResultInbound, QaResultOutbound, QaResultPayload } from '../webview/qaresult/protocol';

/**
 * Renders a QA run's unified result — the agent's `result.json` merged with the
 * Fuuz logs (`logs.json`) collected over MCP — in a React webview. Reads the run
 * directory each time it's opened; one panel per run.
 */
export class QaResultPanel {
  private static readonly panels = new Map<string, vscode.WebviewPanel>();

  static async show(context: vscode.ExtensionContext, runDir: vscode.Uri): Promise<void> {
    const key = runDir.fsPath;
    const payload = await buildPayload(runDir);

    const existing = QaResultPanel.panels.get(key);
    if (existing) {
      existing.reveal(vscode.ViewColumn.Active);
      void existing.webview.postMessage({ type: 'data', payload } satisfies QaResultOutbound);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'fuuzQaResult',
      `QA: ${payload.scopeName}`,
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] }
    );
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
    panel.webview.html = html(panel.webview, context);
    QaResultPanel.panels.set(key, panel);
    panel.onDidDispose(() => QaResultPanel.panels.delete(key));

    panel.webview.onDidReceiveMessage(async (msg: QaResultInbound) => {
      if (msg.type === 'ready') {
        // Re-read so a freshly written result.json / logs.json is reflected.
        void panel.webview.postMessage({ type: 'data', payload: await buildPayload(runDir) } satisfies QaResultOutbound);
      } else if (msg.type === 'openFile') {
        const safe = msg.path.replace(/^[/\\]+/, '');
        const uri = vscode.Uri.joinPath(runDir, ...safe.split('/'));
        await vscode.commands.executeCommand('vscode.open', uri).then(undefined, () =>
          vscode.window.showWarningMessage(`Fuuz: couldn't open ${msg.path}`)
        );
      }
    });
  }
}

async function readJson(uri: vscode.Uri): Promise<unknown | undefined> {
  try {
    const buf = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(buf).toString('utf8'));
  } catch {
    return undefined;
  }
}

async function buildPayload(runDir: vscode.Uri): Promise<QaResultPayload> {
  const plan = (await readJson(vscode.Uri.joinPath(runDir, 'plan.json'))) as any;
  const rawResult = await readJson(vscode.Uri.joinPath(runDir, 'result.json'));
  const rawLogs = await readJson(vscode.Uri.joinPath(runDir, 'logs.json'));

  const logs: CollectedLog[] = Array.isArray(rawLogs) ? (rawLogs as CollectedLog[]) : [];
  return {
    runId: plan?.runId ?? runDir.path.split('/').pop() ?? 'run',
    scopeName: plan?.scope?.name ?? 'QA run',
    target: { url: plan?.target?.url ?? '', envSlug: plan?.target?.envSlug ?? '' },
    hasResult: rawResult !== undefined,
    result: parseQaResult(rawResult ?? {}),
    logs,
    hasLogs: rawLogs !== undefined,
  };
}

function html(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const nonce = randomBytes(16).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
  const asset = (...p: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', ...p));
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <link href="${asset('qaresult', 'qaresult.css')}" rel="stylesheet" />
  <title>QA Result</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${asset('qaresult', 'qaresult.js')}"></script>
</body>
</html>`;
}
