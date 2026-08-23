/**
 * The UI-validation session: one signed-in browser, attached to across turns.
 *
 * Distinct from `driver.ts`, which launches a *fresh* profile per QA run and
 * asks the developer to log each persona in again. Here the developer logs in
 * once (`fuuz.ui.startSession`), the window stays open, and every later agent
 * session attaches to it over CDP — which is how the workflow this encodes has
 * actually been used. Pure config/command construction; the caller spawns it.
 */

type StdioServer = { command: string; args: string[]; env?: Record<string, string> };
type HttpServer = { type: 'http'; url: string; headers: Record<string, string> };

/** Where the harness, profile and artifacts live, relative to the workspace. */
export const UI_DIR = '.fuuz/ui';
/** Default DevTools port. Chrome refuses one already in use, so it is overridable. */
export const DEFAULT_CDP_PORT = 9222;

/**
 * Chrome's argv for the one persistent session.
 *
 * `--remote-allow-origins=*` is NOT optional on Chrome 136+: without it the port
 * opens and then refuses every connection, which reads as "Playwright is broken".
 */
export function chromeArgs(opts: { userDataDir: string; port: number; url?: string }): string[] {
  const args = [
    `--remote-debugging-port=${opts.port}`,
    `--user-data-dir=${opts.userDataDir}`,
    '--remote-allow-origins=*',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate,MediaRouter',
  ];
  if (opts.url) args.push(opts.url);
  return args;
}

/** The screen-runner route — the only surface that emits Transform Debugging. */
export function screenRunUrl(appUrl: string, screenVersionId: string): string {
  return `${appUrl.replace(/\/+$/, '')}/system/configuration/screens/${screenVersionId}/run`;
}

export interface UiLaunch {
  /** Written to `<ui>/mcp.ui.json` and passed to `claude --mcp-config`. */
  mcpConfig: { mcpServers: Record<string, StdioServer | HttpServer> };
  prompt: string;
  shellCommand: string;
}

interface UiLaunchOptions {
  /** Absolute path of `<workspace>/.fuuz/ui` (for the MCP's output dir). */
  uiDirFsPath: string;
  /** Workspace-relative MCP config path, e.g. `.fuuz/ui/mcp.ui.json`. */
  mcpConfigPath: string;
  /** The app base URL, derived from the active enterprise's environment slug. */
  appUrl: string;
  /** DevTools port of the session the developer already logged in. */
  cdpPort: number;
  /** What to validate, in the developer's words. */
  brief: string;
  /** Optional screen to open on the runner route before anything else. */
  screenVersionId?: string;
  /** Skip per-tool permission prompts (opt-in, same gate as the QA driver). */
  autonomous: boolean;
  /** Expose the tenant's Fuuz MCP too, so the agent can verify by read-back. */
  fuuz?: { url: string; tenantId: string; tokenEnvVar: string };
}

/**
 * Build the launch for a UI-validation session.
 *
 * The Playwright MCP is pointed at the ALREADY-RUNNING browser with
 * `--cdp-endpoint`; it must not be given `--user-data-dir`, which would launch a
 * second, signed-out Chrome and produce a login page the agent then reports as a
 * broken screen. Clipboard permissions are granted because reading a Monaco
 * editor back requires a clipboard round-trip — the DOM only holds the viewport.
 */
export function buildUiSessionLaunch(opts: UiLaunchOptions): UiLaunch {
  const mcpServers: Record<string, StdioServer | HttpServer> = {
    playwright: {
      command: 'npx',
      args: [
        '-y', '@playwright/mcp@latest',
        '--cdp-endpoint', `http://127.0.0.1:${opts.cdpPort}`,
        '--output-dir', `${opts.uiDirFsPath.replace(/\/+$/, '')}/shots`,
        '--grant-permissions', 'clipboard-read', 'clipboard-write',
      ],
    },
  };
  if (opts.fuuz) {
    mcpServers.fuuz = {
      type: 'http',
      url: opts.fuuz.url,
      headers: { Authorization: `Bearer \${${opts.fuuz.tokenEnvVar}}`, 'X-Fuuz-Tenant': opts.fuuz.tenantId },
    };
  }

  const openLine = opts.screenVersionId
    ? `Start at ${screenRunUrl(opts.appUrl, opts.screenVersionId)} — note that a cold load redirects to the app route and only sticks on the SECOND navigation.`
    : `The app is at ${opts.appUrl}.`;
  const authorityLine = opts.autonomous
    ? 'Proceed with complete authority: do everything the brief requires without asking.'
    : 'Confirm with me before any action that writes, deploys or deletes.';
  const verifyLine = opts.fuuz
    ? 'Verify every change by reading the record back over the Fuuz MCP — never by looking at the canvas.'
    : 'Verify what you can from the DOM and say plainly what you could not verify.';

  const prompt = [
    'Load the fuuz-ui-validation skill and follow it.',
    `The browser on CDP port ${opts.cdpPort} is ALREADY SIGNED IN — attach to it with the Playwright MCP tools; do not launch a new browser and do not ask me to log in again.`,
    openLine,
    `Task: ${opts.brief}`,
    authorityLine,
    verifyLine,
    `If a login form renders, STOP and tell me the session expired — do not report the empty reads as findings.`,
    `Save screenshots under ${UI_DIR}/shots and finish with what you verified, what you did not, and what is wrong.`,
  ].join(' ');

  // Prompt MUST precede --mcp-config: the flag is variadic and would otherwise
  // swallow the prompt as another config path.
  const flags = [`--mcp-config ${opts.mcpConfigPath}`, '--strict-mcp-config'];
  if (opts.autonomous) flags.push('--permission-mode bypassPermissions');
  const shellCommand = `claude '${prompt.replace(/'/g, "'\\''")}' ${flags.join(' ')}`;

  return { mcpConfig: { mcpServers }, prompt, shellCommand };
}
