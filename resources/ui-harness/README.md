# `.fuuz/ui` — the UI validation session

One signed-in browser, launched once, attached to by everything after.

Installed here by **Fuuz: Start UI Session (Browser)**. The instructions your AI
assistant follows live in the `fuuz-ui-validation` skill (installed to
`.claude/skills/`); this README is the human-facing half.

```bash
node .fuuz/ui/fuuz-ui.cjs login          # headed window — sign in once, LEAVE IT OPEN
node .fuuz/ui/fuuz-ui.cjs status         # alive? which tenant and role?
node .fuuz/ui/fuuz-ui.cjs open  '/system/configuration/screens'
node .fuuz/ui/fuuz-ui.cjs open  'screen:<screenVersionId>'   # the runner route
node .fuuz/ui/fuuz-ui.cjs shot  'screen:<id>' shots/before.png
node .fuuz/ui/fuuz-ui.cjs console 'screen:<id>' --for 20     # console + GraphQL errors
node .fuuz/ui/fuuz-ui.cjs run   probes/my-probe.cjs
node .fuuz/ui/fuuz-ui.cjs reset          # clear unsaved designer state
```

`login` is the only command that launches; everything else attaches over CDP, so
you never sign in twice and the window survives between sessions. Chrome is
spawned **detached** on purpose — a browser launched as a child process of the
script dies when the script exits, and the next command then fails as though the
login never happened.

## Why one window and not one per run

Chromium refuses a second launch against a profile directory an open window owns,
and copying the profile is worse: on a Fuuz tenant the copy's first navigation
retires the donor's refresh token, so cloning to check whether you are still
signed in destroys the session you were checking. One profile, reused in place.

## Writing a probe

`run` hands your script the live page. Use it when an MCP round-trip is the wrong
shape — a loop, a whole property panel read in one evaluation, a synthetic DOM
event. Whatever you return is printed as JSON.

```js
// probes/count-rows.cjs
module.exports = async ({ page, base, requireSession }) => {
  await page.goto(`${base}/system/configuration/screens`, { waitUntil: 'domcontentloaded' });
  await requireSession();                 // aborts loudly if the session died
  return { rows: await page.locator('[role=row]').count(), url: page.url() };
};
```

`requireSession()` is not optional. When a session expires, every route renders
the sign-in page and every read comes back empty — which looks exactly like "the
feature is broken". A probe that keeps going there produces a convincing wrong
answer.

## Files

```
profile/       the one Chrome profile — holds a live session, never commit it
session.json   app url, cdp port, when the session was established
probes/        your scripts
shots/         screenshots
```

`profile/`, `shots/` and `session.json` are gitignored for you. Two independent
sessions (say, one per role) means two profile directories and two logins: set
`FUUZ_UI_CDP_PORT` and run from a second checkout.

## Requirements

- **Chrome, Chromium or Edge** already installed. The harness spawns your system
  browser and attaches to it, so Playwright's downloaded browsers are not needed.
  Set `FUUZ_UI_CHROME` if it lives somewhere unusual.
- The **`playwright` package** resolvable from the workspace, for `connectOverCDP`:

```bash
npm i -D playwright
```
