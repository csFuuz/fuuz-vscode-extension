#!/usr/bin/env node
/**
 * Fuuz MCP gating proxy.
 *
 * A stdio MCP server that VS Code launches and forwards to the remote Fuuz
 * streamable-HTTP MCP server, while ENFORCING the user's tool allow/deny list:
 *   - `tools/list` responses have disabled tools removed, and
 *   - `tools/call` for a disabled tool is rejected locally (never forwarded).
 *
 * Config via env: FUUZ_MCP_URL, FUUZ_TOKEN, FUUZ_DISABLED_TOOLS (comma list).
 * No third-party dependencies — uses Node's global fetch + stdin/stdout.
 */
'use strict';

const readline = require('readline');

const MCP_URL = process.env.FUUZ_MCP_URL;
const TOKEN = process.env.FUUZ_TOKEN;
const DISABLED = new Set(
  String(process.env.FUUZ_DISABLED_TOOLS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}
function log(...args) {
  process.stderr.write('[fuuz-mcp-proxy] ' + args.join(' ') + '\n');
}

/** Parse a remote response body that may be JSON or an SSE `data:` frame. */
function parseBody(text) {
  const t = (text || '').trim();
  if (!t) return null;
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return JSON.parse(t); } catch { return null; }
  }
  const lines = t.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch { /* keep looking */ }
  }
  return null;
}

let sessionId;

async function forward(message) {
  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(message) });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  return parseBody(await res.text());
}

async function handle(msg) {
  // Notifications (no id) are forwarded fire-and-forget.
  if (msg.id === undefined || msg.id === null) {
    try { await forward(msg); } catch (e) { log('notification forward failed:', e.message); }
    return;
  }

  // Block disabled tools locally — never reaches the server.
  if (msg.method === 'tools/call') {
    const name = msg.params && msg.params.name;
    if (name && DISABLED.has(name)) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Tool "${name}" is disabled in Fuuz for VS Code.` } });
      return;
    }
  }

  try {
    const body = await forward(msg);
    if (!body) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: 'No response from Fuuz MCP server' } });
      return;
    }
    // Strip disabled tools from the advertised catalog.
    if (msg.method === 'tools/list' && body.result && Array.isArray(body.result.tools)) {
      body.result.tools = body.result.tools.filter(t => !DISABLED.has(t && t.name));
    }
    send(body);
  } catch (e) {
    send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: String((e && e.message) || e) } });
  }
}

if (!MCP_URL || !TOKEN) {
  log('FUUZ_MCP_URL and FUUZ_TOKEN are required');
  process.exit(1);
}
log(`proxying ${MCP_URL} (disabled: ${[...DISABLED].join(', ') || 'none'})`);

const rl = readline.createInterface({ input: process.stdin });
let chain = Promise.resolve();
rl.on('line', line => {
  const t = line.trim();
  if (!t) return;
  let msg;
  try { msg = JSON.parse(t); } catch { return; }
  // Serialize so the remote sees initialize → initialized → calls in order.
  chain = chain.then(() => handle(msg)).catch(e => log('handle error:', e.message));
});
rl.on('close', () => process.exit(0));
