#!/usr/bin/env node
/**
 * fuuz-ui — one signed-in browser, driven from the command line.
 *
 *   login  [--url <app>]              headed window; sign in once
 *   status                            is the session alive, and who am I
 *   open   <url|screen:<versionId>>   open/reuse a tab
 *   shot   <url|screen:…> [file]      screenshot
 *   console <url|screen:…> [--for s]  collect browser console + GraphQL errors
 *   run    <script.cjs> [args…]       hand your script the live page
 *   reset                             clear unsaved designer state
 *
 * Everything except `login` attaches to the window `login` left open.
 */
const fs = require('fs');
const path = require('path');
const S = require('./session.cjs');

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);
/** Bare words, minus any that are a `--flag`'s value. */
const positional = (() => {
  const out = [];
  const rest = argv.slice(1);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) { if (rest[i + 1] && !rest[i + 1].startsWith('--')) i++; continue; }
    out.push(rest[i]);
  }
  return out;
})();

/** `screen:<versionId>` is the screen-runner route; anything else is a URL. */
function resolveTarget(arg, base) {
  if (!arg) return null;
  const m = /^screen:(.+)$/.exec(arg);
  if (m) return { screenVersionId: m[1] };
  return { url: /^https?:\/\//.test(arg) ? arg : `${base}${arg.startsWith('/') ? '' : '/'}${arg}` };
}

async function pageFor(ctx, arg, base) {
  const t = resolveTarget(arg, base);
  if (!t) {
    const page = ctx.pages().find((p) => !/^devtools:/.test(p.url())) || (await ctx.newPage());
    return page;
  }
  if (t.screenVersionId) return S.openScreenRun(ctx, base, t.screenVersionId);
  const page = await S.openTab(ctx, t.url);
  await S.requireSession(page);
  return page;
}

const COMMANDS = {
  /**
   * One interactive login into the profile every later call attaches to.
   *
   * Chrome is spawned DETACHED and then attached to over CDP — not launched
   * through Playwright, whose browser would be a child of this process and die
   * when `login` exits.
   */
  async login() {
    const base = S.appUrl(flag('url'));
    const existing = await S.waitForPort(1200);
    if (existing) {
      const { browser, ctx } = await S.attach();
      const page = await S.openTab(ctx, `${base}/`);
      const authed = await S.isAuthenticated(page).catch(() => false);
      await browser.close();
      if (authed) {
        console.log(`Already signed in on port ${S.PORT} — nothing to do. Run \`status\` to see who.`);
        return;
      }
      console.log(`A window is already open on port ${S.PORT} but is not signed in — finish the login there.`);
      return;
    }

    const { executable } = S.launchDetached({ url: `${base}/` });
    console.log(`launched ${executable}`);
    console.log(`opened   ${base}`);
    console.log(`profile  ${S.PROFILE}`);
    console.log(`cdp      http://127.0.0.1:${S.PORT}`);
    if (!(await S.waitForPort())) {
      throw new Error(
        `Chrome started but never answered on port ${S.PORT}. If a Chrome is already running with `
        + 'this profile, quit it (Chrome refuses a debugging port on a live profile) and retry.');
    }

    const { browser, ctx } = await S.attach();
    const page = ctx.pages().find((p) => !/^devtools:/.test(p.url())) || (await ctx.newPage());

    // Best effort on an INTERNAL email/password form only. A federated IdP is
    // left to the human — and the password is never printed or stored.
    const user = process.env.FUUZ_UI_USER;
    const pass = process.env.FUUZ_UI_PASS;
    if (user && pass && !(await S.isAuthenticated(page).catch(() => false))) {
      try {
        const pw = page.locator('input[type=password]').first();
        await pw.waitFor({ timeout: 8000 });
        const id = page.locator('input[type=email], input[name=email], input[name=username]').first();
        await id.fill(user);
        await pw.fill(pass);
        await Promise.all([
          page.waitForLoadState('domcontentloaded').catch(() => {}),
          page.keyboard.press('Enter'),
        ]);
        console.log(`filled the internal login form as ${user}`);
      } catch {
        console.log('no internal login form found — complete the sign-in in the window');
      }
    }

    console.log('\nWaiting up to 5 minutes for the app shell…');
    const deadline = Date.now() + 5 * 60_000;
    let ok = false;
    while (Date.now() < deadline) {
      await page.waitForTimeout(3000);
      if (await S.isAuthenticated(page).catch(() => false)) { ok = true; break; }
    }
    if (!ok) {
      await browser.close();
      console.error('\nTimed out — no session established. The window stays open; finish the login and re-run `status`.');
      process.exitCode = 1;
      return;
    }
    const who = await S.whoami(page).catch(() => ({}));
    S.writeSession({
      appUrl: base, cdpPort: S.PORT, profile: S.PROFILE,
      establishedAt: new Date().toISOString(),
      tenantId: who.tenantId ?? null, roleId: who.roleId ?? null, email: who.email ?? null,
    });
    // Detaching, not closing: the window is the point.
    await browser.close();
    console.log(`\nSigned in. ${who.email ?? ''} tenant=${who.tenantId ?? '?'} role=${who.roleId ?? '?'}`);
    console.log(`Landed on ${page.url()}`);
    console.log('\nLEAVE THIS WINDOW OPEN — every later command attaches to it.');
  },

  async status() {
    const saved = S.readSession();
    const { browser, page } = await S.attach();
    const who = await S.whoami(page).catch(() => ({}));
    const authed = await S.isAuthenticated(page).catch(() => false);
    console.log(JSON.stringify({
      cdpPort: S.PORT,
      authenticated: authed,
      appUrl: saved?.appUrl ?? null,
      establishedAt: saved?.establishedAt ?? null,
      tenantId: who.tenantId ?? null,
      roleId: who.roleId ?? null,
      email: who.email ?? null,
      currentUrl: who.url ?? null,
      hint: authed ? undefined : 'A login form is rendering — re-run `login`. Treat every read from this session as void.',
    }, null, 2));
    await browser.close();
    process.exitCode = authed ? 0 : 1;
  },

  async open() {
    const base = S.appUrl(flag('url'));
    const { browser, ctx } = await S.attach();
    const page = await pageFor(ctx, positional[0], base);
    console.log(page.url());
    await browser.close();
  },

  async shot() {
    const base = S.appUrl(flag('url'));
    const out = positional[1] || path.join(S.ROOT, 'shots', `shot-${Date.now()}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const { browser, ctx } = await S.attach();
    const page = await pageFor(ctx, positional[0], base);
    await page.waitForTimeout(Number(flag('settle', 1200)));
    await page.screenshot({ path: out, fullPage: has('full') });
    console.log(out);
    await browser.close();
  },

  /**
   * Console + network for a screen. A GraphQL error returns HTTP 200 with
   * `errors[]` in the body, so status alone proves nothing — those are flagged.
   */
  async console() {
    const base = S.appUrl(flag('url'));
    const seconds = Number(flag('for', 15));
    const { browser, ctx } = await S.attach();
    const page = await pageFor(ctx, positional[0], base);
    const logs = [];
    const failures = [];
    page.on('console', (m) => logs.push({ type: m.type(), text: m.text().slice(0, 2000) }));
    page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: String(e).slice(0, 2000) }));
    page.on('response', async (r) => {
      const bad = r.status() >= 400;
      let graphqlErrors = false;
      if (!bad && /application|system|orchestration|graphql/.test(r.url())) {
        try {
          const body = await r.text();
          graphqlErrors = body.includes('"errors"') && /"errors"\s*:\s*\[/.test(body);
        } catch { /* stream consumed */ }
      }
      if (bad || graphqlErrors) {
        failures.push({ url: r.url().slice(0, 200), status: r.status(), graphqlErrors });
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await S.requireSession(page);
    await page.waitForTimeout(seconds * 1000);
    const redact = (s) => s.replace(/eyJ[A-Za-z0-9_.-]{20,}/g, '<jwt>');
    console.log(JSON.stringify({
      url: page.url(),
      errors: logs.filter((l) => l.type === 'error' || l.type === 'pageerror').map((l) => ({ ...l, text: redact(l.text) })),
      transformDebugging: logs.filter((l) => l.text.startsWith('Transform Debugging')).length,
      failures,
      total: logs.length,
    }, null, 2));
    await browser.close();
  },

  /**
   * Hand a script the live page. This is the escape hatch for everything an MCP
   * round-trip is bad at: loops, whole-form reads in one evaluation, synthetic
   * DOM events. Whatever the script returns is printed as JSON.
   */
  async run() {
    const scriptPath = positional[0];
    if (!scriptPath) throw new Error('usage: run <script.cjs> [args…]');
    const base = S.appUrl(flag('url'));
    const mod = require(path.resolve(scriptPath));
    const fn = typeof mod === 'function' ? mod : mod.default || mod.run;
    if (typeof fn !== 'function') {
      throw new Error(`${scriptPath} must export a function ({ page, ctx, browser, base, S, args }) => any`);
    }
    const { browser, ctx, page } = await S.attach();
    process.env.FUUZ_UI_APP = base;
    try {
      const out = await fn({
        page, ctx, browser, base, S,
        args: positional.slice(1),
        requireSession: () => S.requireSession(page),
      });
      if (out !== undefined) console.log(JSON.stringify(out, null, 2));
    } finally {
      await browser.close();
    }
  },

  async reset() {
    const { browser, page } = await S.attach();
    await S.clearDesignerState(page);
    console.log('cleared sessionStorage (kept tenantId); localStorage untouched — the auth token lives there');
    await browser.close();
  },
};

(async () => {
  const wantsHelp = !cmd || cmd === '--help' || cmd === '-h';
  if (wantsHelp || !COMMANDS[cmd]) {
    const header = fs.readFileSync(__filename, 'utf8').split('\n');
    const doc = header.slice(header.indexOf('/**') + 1, header.indexOf(' */'));
    console.log(doc.map((l) => l.replace(/^ \* ?/, '')).join('\n'));
    process.exit(wantsHelp ? 0 : 1);
  }
  try {
    await COMMANDS[cmd]();
  } catch (err) {
    console.error(`\n${err.message}`);
    process.exit(1);
  }
})();
