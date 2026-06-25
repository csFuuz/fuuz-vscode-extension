import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import type { ComplianceReport } from './complianceTypes';
import type { ReportInbound, ReportOutbound } from '../webview/report/protocol';

/**
 * Renders a {@link ComplianceReport} in a React webview (the shared QA report
 * surface). One panel is reused; calling {@link ReportPanel.show} again replaces
 * the report. A `recheck` callback, when provided, lets the panel's Re-check
 * button refresh the report in place.
 */
export class ReportPanel {
  private static current: ReportPanel | undefined;
  private report: ComplianceReport;
  private recheck?: () => Promise<ComplianceReport | undefined>;

  static show(
    context: vscode.ExtensionContext,
    report: ComplianceReport,
    recheck?: () => Promise<ComplianceReport | undefined>
  ): void {
    if (ReportPanel.current) {
      ReportPanel.current.report = report;
      ReportPanel.current.recheck = recheck;
      ReportPanel.current.panel.title = `Compliance: ${report.name}`;
      ReportPanel.current.panel.reveal(vscode.ViewColumn.Active);
      void ReportPanel.current.post();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'fuuzReport',
      `Compliance: ${report.name}`,
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] }
    );
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
    ReportPanel.current = new ReportPanel(panel, context, report, recheck);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    report: ComplianceReport,
    recheck?: () => Promise<ComplianceReport | undefined>
  ) {
    this.report = report;
    this.recheck = recheck;
    this.panel.webview.html = this.html(context);
    this.panel.webview.onDidReceiveMessage(async (msg: ReportInbound) => {
      if (msg.type === 'ready') {
        await this.post();
      } else if (msg.type === 'recheck' && this.recheck) {
        const fresh = await this.recheck().catch(() => undefined);
        if (fresh) { this.report = fresh; await this.post(); }
      }
    });
    this.panel.onDidDispose(() => { ReportPanel.current = undefined; });
  }

  private post(): Thenable<boolean> {
    const msg: ReportOutbound = { type: 'report', report: this.report };
    return this.panel.webview.postMessage(msg);
  }

  private html(context: vscode.ExtensionContext): string {
    const webview = this.panel.webview;
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
  <link href="${asset('report', 'report.css')}" rel="stylesheet" />
  <title>Compliance</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${asset('report', 'report.js')}"></script>
</body>
</html>`;
  }
}
