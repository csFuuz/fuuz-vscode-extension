/**
 * The one browser session: launch it once, attach to it forever.
 *
 * Chromium refuses a second launch against a profile directory an open window
 * owns, and on a Fuuz tenant *copying* the profile retires the donor's refresh
 * token — so there is exactly one profile here, reused in place, and every
 * caller after `login` attaches over CDP instead of launching.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const PROFILE = path.join(ROOT, 'profile');
const SESSION_FILE = path.join(ROOT, 'session.json');
const PORT = Number(process.env.FUUZ_UI_CDP_PORT || 9222);
const VIEWPORT = { width: 1680, height: 1050 };

/** Anything that looks like an identity provider rather than the app. */
const IDP_URL = /login|signin|auth0|okta|microsoftonline|accounts\.google/i;
const IDP_TEXT = /sign in|log in|enter your password/i;

function readSession() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); } catch { return null; }
}

function writeSession(patch) {
  const next = { ...(readSession() || {}), ...patch };
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(SESSION_FILE, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

/** The app base URL: explicit flag, then the saved session, then the env. */
function appUrl(explicit) {
  const url = explicit || readSession()?.appUrl || process.env.FUUZ_UI_APP;
  if (!url) {
    throw new Error(
      'No app URL. Pass --url https://<env>.<account>.fuuz.app, or run '
      + '"Fuuz: Start UI Session (Browser)" in VS Code, which fills it in from the active tenant.');
  }
  return url.replace(/\/+$/, '');
}

function requirePlaywright() {
  try { return require('playwright'); } catch {
    // Only the package is needed — the session attaches to the system Chrome, so
    // Playwright's downloaded browsers never come into it.
    throw new Error('The playwright package is not resolvable here. Run: npm i -D playwright');
  }
}

/** Chrome-family binaries, in preference order, per platform. */
const CHROME_CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  linux: [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
  ],
};

/** Chrome's argv for the one persistent session. */
function chromeArgs({ port = PORT, url } = {}) {
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${PROFILE}`,
    // Chrome 136+ opens the port and then refuses every connection without this.
    '--remote-allow-origins=*',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate,MediaRouter',
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
  ];
  if (url) args.push(url);
  return args;
}

/**
 * LAUNCH — only for `login`, and DETACHED on purpose.
 *
 * Playwright's own `launchPersistentContext` makes the browser a CHILD of this
 * process, so the window dies the moment `login` exits — which defeats the whole
 * design. Spawning Chrome ourselves with `detached` + `unref` leaves a window
 * that outlives every command, exactly as the developer expects.
 */
function launchDetached({ url, executable } = {}) {
  const { spawn } = require('child_process');
  const exe = executable
    || process.env.FUUZ_UI_CHROME
    || (CHROME_CANDIDATES[process.platform] || []).find((c) => fs.existsSync(c));
  if (!exe) {
    throw new Error(
      'No Chrome/Chromium/Edge found. Install Chrome, or set FUUZ_UI_CHROME to the binary path.');
  }
  fs.mkdirSync(PROFILE, { recursive: true });
  const child = spawn(exe, chromeArgs({ url }), { detached: true, stdio: 'ignore' });
  child.unref();
  return { pid: child.pid, executable: exe };
}

/** Poll the DevTools endpoint until it answers, or give up. */
async function waitForPort(timeoutMs = 30_000, intervalMs = 300) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * ATTACH — everything except `login`. Takes the live context of the window that
 * is already signed in; closing this connection detaches without killing it.
 */
async function attach() {
  const { chromium } = requirePlaywright();
  let browser;
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  } catch (err) {
    throw new Error(
      `No browser session on CDP port ${PORT} (${String(err.message).split('\n')[0]}).\n`
      + `Start one with:  node ${path.relative(process.cwd(), path.join(ROOT, 'fuuz-ui.cjs'))} login`);
  }
  const ctx = browser.contexts()[0];
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = ctx.pages().find((p) => !/^devtools:/.test(p.url())) || (await ctx.newPage());
  return { browser, ctx, page };
}

/** True when the app shell rendered rather than an identity provider. */
async function isAuthenticated(page) {
  if (IDP_URL.test(page.url())) return false;
  return page.evaluate(
    (re) => !new RegExp(re, 'i').test(document.body.innerText.slice(0, 400)),
    IDP_TEXT.source);
}

/**
 * Throw rather than return an empty result. When the session dies, every route
 * renders the sign-in page and every probe comes back empty — which reads
 * exactly like "the feature is broken". Anything that keeps going here reports
 * a convincing wrong answer, so this is the one guard that must never be
 * skipped after a navigation.
 */
async function requireSession(page) {
  if (await isAuthenticated(page).catch(() => false)) return;
  throw new Error(
    `SESSION EXPIRED — a login form is rendering at ${page.url()}. `
    + 'Re-run `login`. Do NOT report the empty reads from this run as findings.');
}

/** Who the capture is running as — "works for admin, breaks for operator". */
async function whoami(page) {
  return page.evaluate(() => {
    const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
    const jwt = read('token');
    let claims = null;
    if (jwt && jwt.split('.').length === 3) {
      try { claims = JSON.parse(atob(jwt.split('.')[1])); } catch { /* opaque */ }
    }
    return {
      hasToken: Boolean(jwt),            // never the token itself
      tenantId: claims?.tenantId ?? read('tenantId') ?? null,
      roleId: claims?.roleId ?? null,
      email: claims?.email ?? null,
      url: location.href,
    };
  });
}

/** Open a URL in the live session, reusing a tab already on it. */
async function openTab(ctx, url, { fresh = false } = {}) {
  const existing = fresh ? null : ctx.pages().find((p) => p.url().startsWith(url));
  const page = existing || (await ctx.newPage());
  if (!existing) await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.bringToFront().catch(() => {});
  return page;
}

/**
 * The screen-runner route — the only surface that emits `Transform Debugging`.
 * A cold load redirects to the app route and only sticks on the second
 * navigation, so this goes twice on purpose.
 */
async function openScreenRun(ctx, base, screenVersionId) {
  const url = `${base}/system/configuration/screens/${screenVersionId}/run`;
  const page = await openTab(ctx, url, { fresh: true });
  await page.waitForTimeout(1500);
  if (!page.url().includes('/run')) await page.goto(url, { waitUntil: 'domcontentloaded' });
  await requireSession(page);
  return page;
}

/**
 * Clear unsaved designer state. `localStorage` is left alone — the auth token
 * lives there — and `tenantId` is preserved. Note `dataModelEditor.diagram` is
 * NOT under the `applicationDesigner.*` prefix, so a prefix-only clear leaves a
 * previous model's card on a canvas meant to be new.
 */
async function clearDesignerState(page) {
  return page.evaluate(() => {
    const tenantId = sessionStorage.getItem('tenantId');
    sessionStorage.clear();
    if (tenantId) sessionStorage.setItem('tenantId', tenantId);
    return true;
  });
}

module.exports = {
  ROOT, PROFILE, SESSION_FILE, PORT, VIEWPORT,
  readSession, writeSession, appUrl,
  chromeArgs, launchDetached, waitForPort,
  attach, isAuthenticated, requireSession, whoami,
  openTab, openScreenRun, clearDesignerState,
};
