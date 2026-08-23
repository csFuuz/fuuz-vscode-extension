# The browser session

One signed-in Chrome, launched once, attached to for the rest of the day.

## Start it

```bash
node .fuuz/ui/fuuz-ui.cjs login            # headed; sign in by hand, once
node .fuuz/ui/fuuz-ui.cjs login --url https://build.acme.fuuz.app
```

What that launch is, and why each part matters:

| flag | why |
| --- | --- |
| `--user-data-dir=<workspace>/.fuuz/ui/profile` | its own profile, so the session survives runs |
| `--remote-debugging-port=9222` | the only way to attach later |
| `--remote-allow-origins=*` | **mandatory on Chrome 136+** — without it the port opens and refuses every connection |
| headed | an SSO login cannot be completed headlessly |

**Chrome is spawned detached, not launched through Playwright.** This is the part
that is easy to get wrong and looks like a Playwright bug when you do:
`chromium.launchPersistentContext` makes the browser a **child** of the Node
process, so the window dies the moment the login script exits and the very next
`attach` gets `ECONNREFUSED` — as though the login never worked. Spawn Chrome
yourself with `detached: true` + `unref()`, wait for the DevTools port to answer,
and *then* attach to drive it. (Verified: with the child-process launch the window
closed on exit; detached, it survived every later command.)

A useful consequence: since nothing is launched through Playwright, you need the
`playwright` **package** but not its downloaded browsers — `connectOverCDP` talks
to the system Chrome you already have.

It is deliberately **not** your everyday Chrome profile: Chrome refuses
`--remote-debugging-port` on an already-running default profile, and an agent
should not be holding a debugger over your personal browsing.

`login` waits until the app shell renders, then writes `.fuuz/ui/session.json`
(app URL, CDP port, profile path, when it was established). If a test-user
credential was passed in the environment (`FUUZ_UI_USER` / `FUUZ_UI_PASS`, set by
the VS Code command from SecretStorage) it fills an **internal** email/password
form; a federated IdP is left to you. It never prints or stores the password.

## Attach to it

```bash
node .fuuz/ui/fuuz-ui.cjs status                       # url, auth, tenant, roleId
node .fuuz/ui/fuuz-ui.cjs open  '<url>'                # open/reuse a tab
node .fuuz/ui/fuuz-ui.cjs shot  '<url>' shots/x.png    # screenshot
node .fuuz/ui/fuuz-ui.cjs run   probe.cjs              # your script gets the live page
```

Attaching is `chromium.connectOverCDP('http://127.0.0.1:9222')` and then taking
the existing context — **never** `launchPersistentContext` on that directory,
which Chromium refuses while a window owns it (single-instance) and which, when it
does succeed, ties the browser's life to your script's.

Disconnect when done (`browser.close()` on a CDP connection detaches; it does
not kill the window). Leave the window open — that is the whole point.

A `run` script is the escape hatch for everything an MCP round-trip is bad at:

```js
// probe.cjs — read a whole property panel in ONE evaluation
module.exports = async ({ page, requireSession }) => {
  await page.goto(`${process.env.FUUZ_UI_APP}/system/configuration/screens`, { waitUntil: 'domcontentloaded' });
  await requireSession();                       // aborts loudly if we got a login form
  return page.$$eval('[data-data-path]', els => els.map(e => ({
    path: e.getAttribute('data-data-path'),
    value: e.querySelector('input,textarea')?.value ?? null,
  })));
};
```

Whatever it returns is printed as JSON. Keep these in `.fuuz/ui/probes/`; they
are cheap and worth keeping, because the next investigation usually wants the
same read.

## Auth, concretely

- **There are no auth cookies.** The session is the `token` in `localStorage`,
  plus a refresh token the app rotates on page load.
- **Copying a token into another window does not restore a session.** It has been
  tried; it does not work. Re-login is the fix.
- The token **rotates roughly every 15 minutes**, so anything that needs it must
  re-read it per request rather than caching it.
- A token is a bearer credential: never write one to a file, a report, or a
  screenshot. Redact anything JWT-shaped (`eyJ…`) before it leaves the browser.
- The signed-in user's role bounds everything you see. `status` prints `roleId`
  and tenant, because "works for admin, breaks for operator" is a whole family of
  bug and nothing else tells you which one you are testing.

## When it breaks

| symptom | cause | fix |
| --- | --- | --- |
| every probe returns empty; panels look unrendered | session expired — a login form is rendering | re-run `login`; **never** report the empties as findings |
| `connectOverCDP` refused | no window on that port, Chrome without `--remote-allow-origins=*`, or a browser that was launched as a child process and died with it | `status`; then `login` |
| "profile is already in use" | you tried to *launch* a directory an open window owns | attach instead |
| session dies far sooner than expected | something cloned the profile and took the refresh token | one profile, in place; see SKILL.md rule 1 |
| a designer opens with a stale model/flow on the canvas | unsaved editor state | clear **all** of `sessionStorage` except `tenantId`; leave `localStorage` alone (the token lives there). `dataModelEditor.diagram` is NOT under the `applicationDesigner.*` prefix |
| clicks land on nothing | a menu backdrop or a lingering tooltip | `Escape`, park the cursor, wait for `[role=tooltip]` to clear |

## Ports and files

```
.fuuz/ui/profile/        the one Chrome profile   (gitignore)
.fuuz/ui/session.json    app url, cdp port, established-at
.fuuz/ui/probes/         your run scripts
.fuuz/ui/shots/          screenshots              (gitignore)
```

Override the port with `FUUZ_UI_CDP_PORT` when you genuinely need two independent
sessions — for example one per role. Two sessions means two profile directories
and two logins; that is the honest cost, and it is still cheaper than one profile
being fought over by two runs.
