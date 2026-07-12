/**
 * "Welcome to Fuuz" — the extension's empty-state / getting-started panel.
 *
 * A self-contained editor WebviewPanel (no bundled script — static HTML with
 * inline styles) showing the Fuuz logo, a short getting-started flow, the
 * features available, and links out to GitHub, the main site, support, and the
 * LMS academy. Getting-started buttons use `command:` URIs to drive extension
 * commands; the external links open in the browser via normal anchors.
 *
 * Opened on first activation (once, gated by globalState) and any time via the
 * `fuuz.welcome` command.
 */
import * as vscode from 'vscode';

const FIRST_RUN_KEY = 'fuuz.welcome.shownV1';

/** External destinations shown in the panel footer. */
const LINKS = {
  github: 'https://github.com/csFuuz/fuuz',
  website: 'https://fuuz.com',
  support: 'https://support.fuuz.com',
  academy: 'https://academy.fuuz.com',
};

export class WelcomePanel {
  private static current: vscode.WebviewPanel | undefined;

  /** Open (or reveal) the Welcome panel in the editor area. */
  static show(context: vscode.ExtensionContext): void {
    if (WelcomePanel.current) {
      WelcomePanel.current.reveal(vscode.ViewColumn.Active);
      return;
    }

    const mediaRoot = vscode.Uri.joinPath(context.extensionUri, 'media');
    const panel = vscode.window.createWebviewPanel(
      'fuuzWelcome',
      'Welcome to Fuuz',
      vscode.ViewColumn.Active,
      {
        enableScripts: false,
        enableCommandUris: true,
        localResourceRoots: [mediaRoot],
        retainContextWhenHidden: true,
      }
    );
    panel.iconPath = vscode.Uri.joinPath(mediaRoot, 'icon.png');
    WelcomePanel.current = panel;
    panel.onDidDispose(() => { WelcomePanel.current = undefined; });

    const logoUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'logo-white.png'));
    panel.webview.html = renderHtml(panel.webview, logoUri);
  }

  /** Show the panel once on first activation; no-op afterwards. */
  static maybeShowOnFirstRun(context: vscode.ExtensionContext): void {
    if (context.globalState.get<boolean>(FIRST_RUN_KEY)) return;
    void context.globalState.update(FIRST_RUN_KEY, true);
    WelcomePanel.show(context);
  }
}

function csp(webview: vscode.Webview): string {
  return [
    `default-src 'none'`,
    `img-src ${webview.cspSource}`,
    `style-src 'unsafe-inline'`,
  ].join('; ');
}

function renderHtml(webview: vscode.Webview, logoUri: vscode.Uri): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp(webview)}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Fuuz</title>
  <style>
    :root {
      --brand-1: #6d4aff;
      --brand-2: #22d3ee;
      --radius: 12px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--vscode-font-family, "DM Sans", system-ui, sans-serif);
      color: var(--vscode-foreground);
      line-height: 1.5;
    }
    .wrap { max-width: 860px; margin: 0 auto; padding: 0 24px 48px; }
    .hero {
      background: linear-gradient(135deg, var(--brand-1), var(--brand-2));
      border-radius: 0 0 var(--radius) var(--radius);
      padding: 40px 24px 32px;
      text-align: center;
      margin-bottom: 28px;
    }
    .hero img { height: 56px; width: auto; }
    .hero p { color: rgba(255,255,255,0.92); margin: 14px auto 0; max-width: 560px; font-size: 14px; }
    h1 { font-size: 20px; margin: 28px 0 6px; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .06em; opacity: .7; margin: 32px 0 14px; }
    .lead { opacity: .8; margin: 0 0 4px; }
    .steps { counter-reset: step; display: grid; gap: 12px; padding: 0; margin: 0; list-style: none; }
    .steps li {
      counter-increment: step;
      display: flex; align-items: flex-start; gap: 14px;
      background: var(--vscode-editorWidget-background, rgba(127,127,127,0.08));
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,0.2));
      border-radius: var(--radius); padding: 14px 16px;
    }
    .steps li::before {
      content: counter(step);
      flex: 0 0 26px; height: 26px; border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-1), var(--brand-2));
      color: #fff; font-weight: 600; font-size: 13px;
      display: flex; align-items: center; justify-content: center;
    }
    .steps .body { flex: 1; }
    .steps .body strong { display: block; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .card {
      background: var(--vscode-editorWidget-background, rgba(127,127,127,0.08));
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,0.2));
      border-radius: var(--radius); padding: 14px 16px;
    }
    .card h3 { margin: 0 0 4px; font-size: 14px; }
    .card p { margin: 0; opacity: .78; font-size: 13px; }
    a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .btn {
      display: inline-block; margin-top: 8px; padding: 5px 12px; font-size: 13px;
      border-radius: 6px; background: var(--vscode-button-background);
      color: var(--vscode-button-foreground); border: none;
    }
    .btn:hover { background: var(--vscode-button-hoverBackground); text-decoration: none; }
    .links { display: flex; flex-wrap: wrap; gap: 10px; }
    .links a {
      flex: 1 1 180px; display: flex; align-items: center; gap: 10px;
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,0.2));
      border-radius: var(--radius); padding: 12px 14px;
    }
    .links .ico { font-size: 18px; }
    .links .t { font-weight: 600; }
    .links .d { display: block; opacity: .7; font-size: 12px; font-weight: 400; }
    footer { margin-top: 36px; opacity: .55; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="hero">
    <img src="${logoUri}" alt="Fuuz" />
    <p>The Fuuz extension is your cockpit for building manufacturing apps — connect your tenants, browse your app, run compliance audits and QA, deploy, and register the Fuuz MCP server so your AI coding assistant can build against it.</p>
  </div>

  <div class="wrap">
    <h1>Get started</h1>
    <p class="lead">Two steps to go from an empty workspace to working in Fuuz.</p>
    <ol class="steps">
      <li><div class="body"><strong>Connect to your Fuuz environment</strong>
        Paste a Fuuz API key — the tenant, enterprise and environment are detected automatically, and the Fuuz MCP server is registered for your AI assistant.
        <a class="btn" href="command:fuuz.addConnectionByKey">Add Connection</a></div></li>
      <li><div class="body"><strong>Browse, audit, and deploy</strong>
        Explore your app in the Resources view, run compliance and QA checks, and deploy component versions.
        <a class="btn" href="command:fuuz.openConfigPanel">Configure Connections</a></div></li>
    </ol>

    <h2>What you can do</h2>
    <div class="cards">
      <div class="card"><h3>🔌 Connect your AI assistant</h3><p>Registers the Fuuz MCP server so tools like the Claude VS Code extension can query and build against your tenant.</p></div>
      <div class="card"><h3>🗂️ Browse your app</h3><p>Module groups, modules, screens, flows, scripts and data models in the Resources view.</p></div>
      <div class="card"><h3>✅ Compliance audits</h3><p>Audit an entire tenant against Fuuz best-practice checks and generate fix plans.</p></div>
      <div class="card"><h3>🧪 QA &amp; UAT</h3><p>Run role-based tests, capture logs, and generate signed UAT documents.</p></div>
      <div class="card"><h3>🧬 Application ERD</h3><p>Visualize data-model relationships across your app.</p></div>
      <div class="card"><h3>🐙 Push to GitHub</h3><p>Mirror your as-built app and UAT/QA docs to a GitHub repo and wiki.</p></div>
    </div>

    <h2>Resources &amp; help</h2>
    <div class="links">
      <a href="${LINKS.github}"><span class="ico">🐙</span><span class="t">GitHub<span class="d">Source &amp; issues</span></span></a>
      <a href="${LINKS.website}"><span class="ico">🌐</span><span class="t">fuuz.com<span class="d">Product &amp; docs</span></span></a>
      <a href="${LINKS.support}"><span class="ico">💬</span><span class="t">Support<span class="d">support.fuuz.com</span></span></a>
      <a href="${LINKS.academy}"><span class="ico">🎓</span><span class="t">Academy<span class="d">academy.fuuz.com (LMS)</span></span></a>
    </div>

    <footer>You can reopen this page any time with the <strong>Fuuz: Welcome</strong> command.</footer>
  </div>
</body>
</html>`;
}
