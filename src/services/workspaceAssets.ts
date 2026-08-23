/**
 * Copy the extension's bundled assets into the open workspace.
 *
 * Two of them, both of which only work where a coding agent can see them:
 *   - `resources/skills/*`   -> `.claude/skills/*`   (the Fuuz platform skills)
 *   - `resources/ui-harness` -> `.fuuz/ui`           (the browser-session CLI)
 *
 * Since the in-extension Copilot was removed there is nothing left that serves
 * the skills to an assistant, so they shipped in the .vsix and reached nobody.
 */
import * as vscode from 'vscode';

/** Never clobber a developer's own edits without being told to. */
export type Overwrite = 'skip-existing' | 'overwrite';

export interface CopyResult {
  written: string[];
  skipped: string[];
}

/** Recursive copy of a bundled directory, honouring {@link Overwrite}. */
async function copyDir(from: vscode.Uri, to: vscode.Uri, mode: Overwrite, out: CopyResult, label: string): Promise<void> {
  await vscode.workspace.fs.createDirectory(to);
  for (const [name, type] of await vscode.workspace.fs.readDirectory(from)) {
    const src = vscode.Uri.joinPath(from, name);
    const dst = vscode.Uri.joinPath(to, name);
    const rel = `${label}/${name}`;
    if (type === vscode.FileType.Directory) {
      await copyDir(src, dst, mode, out, rel);
      continue;
    }
    if (mode === 'skip-existing') {
      try { await vscode.workspace.fs.stat(dst); out.skipped.push(rel); continue; } catch { /* absent */ }
    }
    await vscode.workspace.fs.writeFile(dst, await vscode.workspace.fs.readFile(src));
    out.written.push(rel);
  }
}

/**
 * Install the bundled skills as project skills. `.claude/skills/<name>/SKILL.md`
 * is where Claude Code discovers them; a workspace copy is also editable, which
 * is the point — a team can extend them.
 */
export async function installSkills(
  extensionUri: vscode.Uri, workspace: vscode.Uri, mode: Overwrite
): Promise<CopyResult> {
  const out: CopyResult = { written: [], skipped: [] };
  await copyDir(
    vscode.Uri.joinPath(extensionUri, 'resources', 'skills'),
    vscode.Uri.joinPath(workspace, '.claude', 'skills'),
    mode, out, 'skills');
  return out;
}

/** Install the UI-session harness into `.fuuz/ui`. */
export async function installUiHarness(
  extensionUri: vscode.Uri, workspace: vscode.Uri, mode: Overwrite
): Promise<CopyResult> {
  const out: CopyResult = { written: [], skipped: [] };
  await copyDir(
    vscode.Uri.joinPath(extensionUri, 'resources', 'ui-harness'),
    vscode.Uri.joinPath(workspace, '.fuuz', 'ui'),
    mode, out, 'ui');
  return out;
}

/**
 * Keep the browser profile, screenshots and session file out of git. The profile
 * holds a live session; committing it would publish a credential.
 */
export async function ignoreUiArtifacts(workspace: vscode.Uri): Promise<void> {
  const uri = vscode.Uri.joinPath(workspace, '.fuuz', 'ui', '.gitignore');
  await vscode.workspace.fs.writeFile(uri, Buffer.from(
    ['# The profile holds a live signed-in session — never commit it.',
      'profile/', 'shots/', 'session.json', ''].join('\n'), 'utf8'));
}
