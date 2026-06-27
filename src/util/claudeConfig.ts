/**
 * Pure file-merge helpers for Claude config files (`~/.claude.json`, the project
 * `.mcp.json`, Claude Desktop config). No VS Code dependency so they can be unit-
 * tested in plain Node. Only `fuuz-*` server keys are ever managed here — every
 * other key in the file is preserved untouched.
 */
import * as fs from 'fs/promises';
import * as path from 'path';

export function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Read+parse JSON, returning {} for a missing file and null for invalid JSON. */
export async function readJsonFile(file: string): Promise<any | null> {
  try {
    const text = await fs.readFile(file, 'utf8');
    if (!text.trim()) return {};
    const parsed = JSON.parse(text);
    return isPlainObject(parsed) ? parsed : null;
  } catch (err: any) {
    if (err && err.code === 'ENOENT') return {};
    return null; // exists but unreadable/invalid → caller leaves it untouched
  }
}

/** Canonical serialization used for both writing and the skip-if-unchanged check. */
export function serializeConfig(config: unknown): string {
  return JSON.stringify(config, null, 2) + '\n';
}

/**
 * Replace the managed `fuuz-*` entries in a config's `mcpServers` with `entries`,
 * preserving every other server and top-level key. Mutates and returns `config`.
 * `hadFuuzEntries` reports whether the file already contained managed entries —
 * callers use it to decide whether a no-op (no entries to add, none to remove)
 * can skip touching the file entirely.
 */
export function applyFuuzServers(
  config: Record<string, any>,
  entries: Record<string, any>
): { config: Record<string, any>; hadFuuzEntries: boolean } {
  const mcpServers: Record<string, any> = isPlainObject(config.mcpServers) ? config.mcpServers : {};
  const hadFuuzEntries = Object.keys(mcpServers).some(k => k.startsWith('fuuz-'));
  for (const key of Object.keys(mcpServers)) {
    if (key.startsWith('fuuz-')) delete mcpServers[key];
  }
  for (const [key, value] of Object.entries(entries)) {
    mcpServers[key] = value;
  }
  config.mcpServers = mcpServers;
  return { config, hadFuuzEntries };
}

/** A managed `fuuz-*` server whose token is an env-var reference (not embedded). */
export function isEnvRefServer(server: any): boolean {
  const auth = server?.headers?.Authorization;
  if (typeof auth === 'string' && auth.includes('${')) return true;
  return !!(server?.env && (server.env.FUUZ_TOKEN_ENV || String(server.env.FUUZ_TOKEN ?? '').includes('${')));
}

/** A managed `fuuz-*` server whose token is embedded (a real, usable credential). */
export function isEmbeddedServer(server: any): boolean {
  const auth = server?.headers?.Authorization;
  if (typeof auth === 'string' && /^Bearer\s+\S/.test(auth) && !auth.includes('${')) return true;
  return !!(server?.env && server.env.FUUZ_TOKEN && !String(server.env.FUUZ_TOKEN).includes('${'));
}

const fuuzServers = (config: any): Record<string, any> => {
  const ms = isPlainObject(config?.mcpServers) ? config.mcpServers : {};
  return Object.fromEntries(Object.entries(ms).filter(([k]) => k.startsWith('fuuz-')));
};

/**
 * Project-scope `fuuz-*` servers that use env-var token refs AND are also present
 * (embedded) in the user config. Claude Code gives the project file precedence,
 * so these *shadow* the working embedded servers and fail to auth unless the env
 * vars are exported — exactly the conflict to surface/clean up.
 */
export function shadowingFuuzServers(projectConfig: any, userConfig: any): string[] {
  const proj = fuuzServers(projectConfig);
  const user = fuuzServers(userConfig);
  return Object.keys(proj).filter(k => isEnvRefServer(proj[k]) && user[k] && isEmbeddedServer(user[k]));
}

/**
 * Write a file atomically: write to a sibling temp file, then rename over the
 * target. `rename` is atomic on the same filesystem, so a reader (e.g. Claude
 * Code reading `~/.claude.json`) never observes a half-written file, and a crash
 * mid-write leaves the original intact.
 */
export async function writeFileAtomic(file: string, contents: string): Promise<void> {
  const tmp = `${file}.fuuz-${process.pid}.tmp`;
  try {
    await fs.writeFile(tmp, contents, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}

/** Ensure the parent directory of `file` exists. */
export async function ensureDir(file: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
}
