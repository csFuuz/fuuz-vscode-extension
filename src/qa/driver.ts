/**
 * Headed-browser QA driver: wire the Playwright MCP into a supervised Claude
 * Code session that executes a run's brief against the target app. The browser
 * is **headed** with a persistent profile so the developer logs each persona in
 * manually (per the persona model) while Claude drives everything else and saves
 * artifacts. Pure config/command construction — the caller spawns it in a
 * terminal so logins and progress stay visible.
 */

type StdioServer = { command: string; args: string[]; env?: Record<string, string> };
type HttpServer = { type: 'http'; url: string; headers: Record<string, string> };

export interface DriverLaunch {
  /** Written to `<run>/mcp.qa.json` and passed to `claude --mcp-config`. */
  mcpConfig: { mcpServers: Record<string, StdioServer | HttpServer> };
  /** Single-line initial prompt for the Claude session. */
  prompt: string;
  /** The shell command to run in the run-directory terminal. */
  shellCommand: string;
}

interface DriverOptions {
  /** Absolute path to the run directory (for the browser's output/profile dirs). */
  runDirFsPath: string;
  /** Brief path relative to the launch cwd (workspace root), e.g. `.fuuz/qa/<run>/brief.md`. */
  briefPath: string;
  /** MCP config path relative to the launch cwd, e.g. `.fuuz/qa/<run>/mcp.qa.json`. */
  mcpConfigPath: string;
  /** Artifacts path relative to the launch cwd, e.g. `.fuuz/qa/<run>/artifacts`. */
  artifactsPath: string;
  targetUrl: string;
  /** Full authority: launch Claude with permission prompts bypassed. */
  autonomous: boolean;
  /** The single role this session tests (role-per-session model). */
  roleName?: string;
  /**
   * When a sandboxed test user is pre-saved for this role, the env var names the
   * terminal sets for its username/password so Claude can log in automatically
   * (values are set on the terminal env, never written to disk).
   */
  testUser?: { userEnvVar: string; passEnvVar: string };
  /**
   * Optionally also expose the active tenant's Fuuz MCP server to the session so
   * Claude can cross-reference schema / data / logs while testing. The token is
   * referenced via an env var (set on the terminal) and is NEVER written to disk.
   */
  fuuz?: { url: string; tenantId: string; tokenEnvVar: string };
}

/** Path join that is safe for the absolute fs paths we pass to the MCP. */
function join(dir: string, ...parts: string[]): string {
  return [dir.replace(/\/+$/, ''), ...parts].join('/');
}

export function buildHeadedDriver(opts: DriverOptions): DriverLaunch {
  const artifactsDir = join(opts.runDirFsPath, 'artifacts');
  const profileDir = join(opts.runDirFsPath, 'profile');

  // Headed (no --headless) so the developer can log personas in; persistent
  // profile keeps the session across steps; output-dir collects traces/shots.
  const mcpServers: Record<string, StdioServer | HttpServer> = {
    playwright: {
      command: 'npx',
      args: [
        '-y', '@playwright/mcp@latest',
        '--output-dir', artifactsDir,
        '--user-data-dir', profileDir,
        '--viewport-size', '1280,800',
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
  const mcpConfig = { mcpServers };

  const role = opts.roleName ? `the "${opts.roleName}" role` : 'the role under test';
  const loginLine = opts.testUser
    ? `Log in to Fuuz at ${opts.targetUrl} using the sandboxed test user for ${role}: username from the ${opts.testUser.userEnvVar} env var and password from ${opts.testUser.passEnvVar}. Do NOT print the password.`
    : `Ask me to log in to Fuuz at ${opts.targetUrl} as ${role} (one-time), then continue.`;
  const authorityLine = opts.autonomous
    ? `After login, proceed with COMPLETE AUTHORITY as ${role} — do everything the brief requires without asking.`
    : `After login, STOP and confirm before each major step.`;
  const prompt = [
    `Execute the QA brief in ${opts.briefPath} against ${opts.targetUrl} as ${role}, using the Playwright MCP browser tools.`,
    loginLine,
    authorityLine,
    opts.fuuz ? `The Fuuz MCP server for this tenant is also available — use it to cross-reference schema, data, and logs.` : '',
    `Save all screenshots/GIFs under ${opts.artifactsPath} (never the workspace root), record any browser console/network errors,`,
    `and write the structured result to ${opts.artifactsPath.replace(/\/artifacts$/, '')}/result.json as described in the brief.`,
  ].filter(Boolean).join(' ');

  // Prompt MUST come before --mcp-config: the flag is variadic (`<configs...>`)
  // and would otherwise swallow the prompt as another config path. Single-quoted
  // (the prompt contains no single quotes). --strict-mcp-config limits the session
  // to exactly these servers; autonomous runs bypass per-tool permission prompts.
  const flags = [`--mcp-config ${opts.mcpConfigPath}`, '--strict-mcp-config'];
  if (opts.autonomous) flags.push('--permission-mode bypassPermissions');
  const shellCommand = `claude '${prompt}' ${flags.join(' ')}`;

  return { mcpConfig, prompt, shellCommand };
}
