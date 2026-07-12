/**
 * Minimal JSONC-tolerant parser. VS Code config files (`.vscode/mcp.json`,
 * `.mcp.json`, …) routinely carry line/block comments and trailing commas,
 * which strict `JSON.parse` rejects — so a naive read would treat a perfectly
 * good file as "invalid" and risk clobbering it. This strips comments (string-
 * aware) and trailing commas, then defers to `JSON.parse`.
 *
 * No VS Code/Node imports so it stays unit-testable in plain Node.
 */

/** Strip `//` and block comments, honoring string literals so `"http://"` survives. */
function stripComments(text: string): string {
  let out = '';
  let inStr = false;
  let strCh = '';
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (ch === '\n') { inLine = false; out += ch; }
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') { inBlock = false; i++; }
      continue;
    }
    if (inStr) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i++; continue; }
      if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === '\'') { inStr = true; strCh = ch; out += ch; continue; }
    if (ch === '/' && next === '/') { inLine = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlock = true; i++; continue; }
    out += ch;
  }
  return out;
}

/** Remove trailing commas before `}` or `]` (outside strings). */
function stripTrailingCommas(text: string): string {
  let out = '';
  let inStr = false;
  let strCh = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      out += ch;
      if (ch === '\\') { out += text[i + 1] ?? ''; i++; continue; }
      if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === '\'') { inStr = true; strCh = ch; out += ch; continue; }
    if (ch === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') continue; // drop the comma
    }
    out += ch;
  }
  return out;
}

/**
 * Parse JSON that may contain comments and trailing commas. Throws (like
 * `JSON.parse`) when the content is genuinely malformed, so callers can
 * distinguish a real parse failure from a tolerable JSONC file.
 */
export function parseJsonc(text: string): any {
  return JSON.parse(stripTrailingCommas(stripComments(text)));
}
