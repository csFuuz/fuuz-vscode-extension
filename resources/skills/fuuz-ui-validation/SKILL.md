---
name: fuuz-ui-validation
description: Drive the real Fuuz UI in a real signed-in browser with Playwright — log in once, attach across turns, act, and verify by reading the record back. Use when the user asks you to validate/verify a screen, flow or data model you built, to check that something actually renders or actually saved, to reproduce a UI bug, to capture screenshots, or to do anything in the App Designer (schema, flow or screen designer) that the API cannot do. Also use before claiming any UI work is done.
---

# Fuuz UI Validation

Pushing a screen over MCP proves the platform *accepted* it. It does not prove it
renders, binds, queries, or saves. A screen can deploy clean and render a blank
page with no error at all — three separate ways (see `fuuz-screen-design`). So the
work is not finished at deploy; it is finished when someone has seen it run.

This skill is how you go and see, without asking the developer to babysit a
browser.

## The loop

```
   ┌─ start the session ────  one login, reused all day
   │
   ├─ attach ───────────────  the already-signed-in window, over CDP
   │
   ├─ act ──────────────────  navigate / click / fill — Playwright MCP or a script
   │
   ├─ verify ───────────────  read the RECORD back over the Fuuz MCP
   │
   └─ report ───────────────  screenshot + what you verified + what you did not
```

Start it with the VS Code command **Fuuz: Start UI Session (Browser)**, or from a
terminal:

```bash
node .fuuz/ui/fuuz-ui.cjs login          # headed window; sign in once
node .fuuz/ui/fuuz-ui.cjs status         # is the session alive? who am I?
```

`login` opens a Chrome with its own persistent profile and the DevTools port
open, then waits. Everything after that — this session and every later one —
attaches to that same window and needs no credentials. Details and failure modes:
**`session.md`**.

Then either:

- **Playwright MCP over CDP** — the extension writes the config, so
  `browser_navigate` / `browser_click` / `browser_snapshot` act on the
  signed-in window. This is the default; prefer it for anything conversational.
- **A local script** — `node .fuuz/ui/fuuz-ui.cjs run probe.cjs` hands your
  script the live `page`. Prefer it when you need a loop, a whole form read in
  one evaluation, or a synthetic DOM event. Dozens of MCP round-trips to read
  one property panel is the wrong tool.

## Six rules that each cost a real session to learn

**1. One profile, reused in place. Never clone a live one.**
Chromium refuses a second launch against the same profile directory, so the
tempting move is to copy it. On a Fuuz tenant the copy's first navigation
*retires the donor's refresh token* — cloning to check whether you are still
signed in destroys the session you were checking. That mistake cost three
operator logins in one study, misdiagnosed each time as a timeout. To test a
session, launch its own directory.

**2. A login form is an ABORT, not a retry.**
When the session dies, every route renders the sign-in page and every probe comes
back empty — which reads exactly like "the feature is broken" or "the panel is
empty". Guard every step: if the URL matches an identity provider or the body
says *sign in / log in / password*, **stop and say the session expired**. Never
report an empty result you cannot prove was a real empty. The harness's
`requireSession()` does this for you; call it after every navigation.

**3. Never eyeball the canvas.**
A designer save can complete with no error and create nothing — a missed name
dialog, an unconfirmed deploy prompt, a required "Data migration?" question. The
canvas looks right either way. Verification is reading the record back over the
Fuuz MCP (`DataModelVersion.modelDefinition`, `DataFlowVersion.flow`,
`ScreenVersion.design`) or introspecting the deployed type. See **`verify.md`**.

**4. Dismiss before you click.**
An open menu lays a backdrop over the page, and option tooltips linger where the
cursor was left — both silently intercept the next click, and both report as
"element is not visible" on something that is plainly visible. Press `Escape`,
park the cursor, wait for `[role=tooltip]` to clear.

**5. Screenshots are evidence, not proof.**
Attach them, and say what they show. A screenshot cannot tell you a value
persisted, and it cannot tell you a transform ran.

**6. Say what you did not check.**
"Renders and the table loads 12 rows; I did not test Save, or the operator role"
is a useful report. "Validated ✅" is not.

## Which surface am I even on?

Three different URLs, three different behaviours — picking the wrong one wastes
a whole investigation:

| surface | URL | what it gives you |
| --- | --- | --- |
| **Designer** | `/system/configuration/screens/<id>` | authoring; transforms DO run but the context is a shell (`components: []`, `screen: null`) |
| **Screen runner** | `/system/configuration/screens/<versionId>/run` | the real screen, and the only surface that *can* emit `Transform Debugging` — see below |
| **Deployed app** | the app route | the real screen with **zero** transform logging |

So any console-based diagnosis must drive `/run`.

**But the route is necessary and NOT sufficient.** Transform logging is gated on a
session flag, and a plain browser does not set it — measured on platform
`2026.8.0.959`:

| what you do | `Transform Debugging` entries |
| --- | --- |
| open `/run` | **0** |
| `sessionStorage.setItem('transformDebuggingEnabled','true')`, then reload | **13** |
| open `/run?developerMode=true` | **13** (it sets the flag for you) |

So "I'm on `/run` and the console is empty" is the expected result, not a broken
screen. Set the flag — `?developerMode=true` is the cheapest way — **and reload**,
because the flag is read as the app bundle evaluates. One more reason for an empty
console: `executeTransform` returns a cached value *before* the logging line, so an
unchanged transform logs nothing. A reload gives you the cold evaluation.

*(An earlier build redirected a cold `/run` load to the app route, sticking only on
a second navigation. That did not reproduce on `2026.8.0.959` — the first
navigation stuck. If you do get redirected, just navigate again.)*

## References

| file | read it when |
| --- | --- |
| [session.md](./session.md) | starting/attaching/diagnosing the browser session, ports, profiles, tokens |
| [designers.md](./designers.md) | driving the schema / flow / screen designers — selectors, gestures, dialogs |
| [monaco.md](./monaco.md) | typing into or reading back any code editor (JSONata, GraphQL, JSON) |
| [verify.md](./verify.md) | proving a change landed; screenshots; the Dev Console MCP; reporting |

**Before you conclude a defect is real, check it is not a known one.** Most of what
looks broken in a first UI run is a documented silent failure, not a platform bug:

- `fuuz-screen-design/silent-failures.md` — blank screens, dropped elements,
  filters that filter nothing, formats that render plausible nonsense
- `fuuz-data-flow/runtime-rules.md` — flows that run and write nothing, and the
  fact that a web flow's definition is fetched at **screen load** (so reload
  before judging a redeploy)
- `fuuz-data-model/deploy-rules.md` — deploys that report success with fields
  missing
