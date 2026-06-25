# Changelog

All notable changes to **Fuuz for VS Code**.

## 0.29.0

- **Unified QA result view**: a new **Open QA Result** action on each run renders
  the agent's findings (per-persona step pass/fail, defects with severity + fixes,
  UI/UX grooming) merged with the Fuuz logs collected over MCP — in one webview,
  with clickable evidence (screenshots/GIFs).
- The QA brief now asks the agent to write a structured `result.json` (schema
  included) into the run directory, which the view ingests tolerantly.
- Fixed the brief's artifacts path to be tenant-scoped (`.fuuz/qa/<tenant>/<run>/`).

## 0.28.0

- **Simpler Connections panel**: connections are managed entirely by **API key**.
  Removed the "Add enterprise", "Add tenant", and "Edit environment & endpoints"
  controls — paste a key at the top and the enterprise/tenant/environment are
  detected automatically. Environment and endpoints are shown read-only (they
  shouldn't change). Pruned the now-unused message handlers and state.

## 0.27.0

- **QA Runs scoped to the active tenant**: runs are now stored under
  `.fuuz/qa/<tenant>/<run>/` and the **QA Runs** view shows only the active
  tenant's runs, refreshing when you switch tenants.
- **Delete a QA run**: a trash action on each run removes it and all its files
  (brief, plan, logs, artifacts) after confirmation (sent to the OS trash).

## 0.26.0

- **QA launches from the workspace root**: the Claude Code QA session now runs
  from your (already-trusted) workspace folder instead of the per-run directory,
  so Claude no longer prompts to "trust this folder" on every run. The brief,
  MCP config, and artifacts are referenced at `.fuuz/qa/<run>/`.

## 0.25.0

- **Fix QA launch command**: the `claude --mcp-config` flag is variadic, so the
  positional prompt was being swallowed as a config path ("MCP config file not
  found"). The prompt now precedes the flag, and `--strict-mcp-config` limits the
  QA session to exactly the Playwright + tenant Fuuz servers.
- Removed the deprecated `baseUrl`/unused `paths` from tsconfig.

## 0.24.0

- **QA runs use Claude Code, not Copilot**: **QA this Screen / QA this App** now
  generate the brief and launch a supervised **Claude Code** session directly (the
  headed-browser Playwright run) instead of handing off to VS Code Copilot chat.
- **Tenant-aware QA sessions**: the run targets the **active tenant's** environment
  (e.g. `https://build.mfgx.fuuz.app`) and the Claude Code session is wired with
  that tenant's **Fuuz MCP server**, so Claude can cross-reference schema, data, and
  logs while testing. The token is passed via the terminal environment
  (`${FUUZ_QA_TOKEN}`) and is never written to disk.

## 0.23.0

QA harness — run it in the browser.

- **Run QA in Browser**: from a QA run, launches a supervised Claude Code session
  wired to the **Playwright MCP** (headed browser, persistent profile) that
  executes the run's brief against the target app. The browser is headed so you
  log each persona in manually; Claude drives everything else and saves
  screenshots/GIFs + a report to the run's `artifacts/`. The Playwright MCP config
  is written to the run dir; the session runs in an integrated terminal so logins
  and progress stay visible.

## 0.22.0

QA harness — log correlation & runs view.

- **QA Runs view**: a new view in the Fuuz sidebar lists each run under
  `.fuuz/qa/<run>/` and its artifacts (brief, plan, collected logs); click to open.
- **Collect Fuuz Logs for Run**: pulls Fuuz-side logs over MCP (the developer's
  connection — the persona under test may lack log access) for the run's time
  window and writes `logs.json`. Sources: `ApplicationSpanEventLog` (activity/
  trace), `DataFlowDeploymentLog` (data-flow logs), `IntegrationRequestLog`
  (integration errors). Each source degrades independently; errors sort first.

## 0.21.0

Testing & QA tooling — first cut.

- **Schema Doctor (local compliance)**: check a data model, or a local artifact
  outline, against the platform's conventions and get an explainable 0–100 score
  with fix recommendations — **before** pushing to Fuuz.
  - **Check Schema Compliance** (data-model node) audits a deployed model over MCP.
  - **Scaffold Compliant Outline** writes a convention-correct starting skeleton
    for a data model, screen, flow, script, or query.
  - **Check Outline Compliance** (editor action on `*.model/query/flow/screen.jsonc`
    and `*.script.js`) scores a local outline you scaffolded or hand-authored.
  - Results open in a new **compliance report** webview (score gauge, findings
    with fixes, per-rule breakdown, re-check).
- **QA harness (preview)**: **QA this Screen** / **QA this App** generate a
  driver-agnostic **test brief** for an AI agent to drive the running app —
  per-persona manual login, click/fill/CRUD coverage, screenshots + GIFs, browser
  console + Fuuz log capture, and UI/UX grooming. Destructive steps are gated to
  test environments. The brief + plan are written to `.fuuz/qa/<run>/` and handed
  to the agent chat. (Headless Playwright driver + MCP-side log correlation land
  next.)

## 0.20.0

- **Design system, by default**: **Generate App Context File** now also writes
  `.fuuz/DESIGN_SYSTEM.md` — the canonical Fuuz UI design system (DM Sans,
  neutral-charcoal/white surfaces, violet `#5B30DF` accent, the shared status
  palette) plus a paste-ready theme helper that reads live tokens from
  `$appConfig.designSystem`. `AVAILABLE.md` points at it, so any widget an AI
  copilot builds through the MCP is themed like core Fuuz unless you ask for
  something unique.

## 0.19.0

- **Query a model from the ERD**: each entity in the ERD now has a **⌕** button
  in its header. Click it to run **Query Data Model** for that model — pick the
  fields, enter an optional JSON filter, and the matching records open in an
  editor tab. Same flow as the Resources tree, now reachable straight from the
  diagram.

## 0.18.0

Performance, reliability, and usability pass.

- **Safer Claude config writes**: `~/.claude.json` and the Claude Desktop config
  are now written **atomically** (temp file + rename) and only when their contents
  actually change. This stops per-startup churn and closes the corruption/lost-write
  window against Claude's own writes to those files. An unconfigured workspace no
  longer touches them at all.
- **Faster MCP calls**: on-demand calls (tree expansion, ERD field/relation loads,
  queries) reuse a pooled MCP session instead of a full handshake each time, with a
  one-shot retry when a reused session has gone stale.
- **Cancellable operations**: Execute Flow, Send Webhook, Query Data Model, the
  ERD builds, and Deploy now show a **Cancel** button that aborts the in-flight
  request.
- **Deploy version picker**: **Deploy Component Version** offers a quick-pick of the
  component's recent versions instead of requiring a hand-typed id (falls back to
  manual entry).
- **Lighter startup**: activation skips legacy migration, Claude auto-register, and
  the stale-cache refresh entirely when no connections are configured.
- **Config panel rebuilt in React**: the Connections panel is now a bundled React
  webview instead of a hand-written HTML string — same features, easier to evolve.
- **Robustness**: fixed a TRON parsing edge case where a value containing
  `Letter(` could spawn phantom records; sync failures now surface in the **Fuuz**
  output channel instead of being swallowed.
- **Internals**: the extension host is now bundled with esbuild (faster activation,
  smaller package); shared config-merge and abort logic extracted and unit-tested.

## 0.17.0

- **Flows grouped by type**: the **Flows** node now groups data flows by their
  type (e.g. **Edge**, **Webflow**, **Backend**) when the type is known, so a
  module's flows are easier to scan.
- **Web flows can't be executed from VS Code**: web flows run in the Fuuz web UI,
  so the **Execute** action is hidden for them (and blocked with an explanatory
  message if invoked another way). They're marked `web · run in Fuuz` with a
  globe icon.
- Flow types are resolved best-effort from `DataFlowType`; if a tenant's schema
  doesn't expose them, flows simply render ungrouped (as before).

## 0.16.0

- **Interactive ERDs (React Flow)**: the entity-relationship diagrams are now a
  draggable node graph instead of a static Mermaid image. **Drag** entities to
  arrange them, **click** a node to expand its `field : type` table (loaded
  lazily so big diagrams stay fast), **double-click** a node to **expand its
  related entities** into the graph, **click** an entity to highlight its
  relationships and dim the rest, and **search** to jump to a model. A minimap,
  zoom controls, and an **Auto-layout** button are built in.
- **Crow's-foot cardinality**: each relationship shows one/many markers at both
  ends, so it's clear which side is the "many".
- **No more duplicate links**: a foreign key and its object twin (`areaId` +
  `area`) and a key + its reverse collection now collapse to a **single** edge.
  Two models are only joined by multiple edges when there are genuinely distinct
  foreign keys (e.g. `shipFromAddressId` and `shipToAddressId`).
- **Persisted layouts**: your manual arrangement is saved per diagram (per
  tenant) and restored next time you open it.
- **Removed** the Mermaid renderer and **Export .mmd** action. The diagram is now
  rendered by a bundled React app (`media/erd/`); the extension host still ships
  with **no runtime dependencies**.

## 0.15.0

- **Auto-register with Claude**: the Fuuz MCP servers are now kept in sync with
  **Claude** automatically whenever a connection or its token changes — connect
  an API key and Claude can use it after a restart, no command or env-var setup
  needed. Controlled by the new `fuuz.claudeAutoRegister` setting
  (`userAndDesktop` by default; `user`, or `off`).
- **Tokens embedded for private scopes**: Claude Code **user** (`~/.claude.json`)
  and **Claude Desktop** entries now embed the live token directly (their config
  lives mode-600 in your home dir and is never committed — like every other MCP
  server). On **Replace API Key**, the embedded token is refreshed automatically.
- **Project scope stays env-ref**: the project `.mcp.json` is never written
  automatically and never embeds a token — it references `Bearer ${FUUZ_TOKEN_…}`
  so it remains safe to commit. The **Register MCP Server with Claude** command
  still offers it (with **Copy export commands**) for sharing with a team.

## 0.14.0

- **Register MCP Server with Claude**: new command that makes the Fuuz MCP
  servers reachable from **Claude** (Claude Code project `.mcp.json` and user
  `~/.claude.json`, and Claude Desktop). VS Code's native MCP registration is
  only visible to VS Code's own Copilot — Claude reads its own config — so the
  servers are now written there too. Only `fuuz-*` keys are managed; everything
  else in those files is preserved.
- The **token stays off disk**: Claude Code entries reference
  `Bearer ${FUUZ_TOKEN_…}`; Claude Desktop runs the bundled stdio proxy with
  `FUUZ_TOKEN_ENV` indirection so the proxy reads the secret from the
  environment at launch. The command can copy the matching `export …` lines to
  your clipboard.
- The stdio proxy now resolves its token from `FUUZ_TOKEN` **or** the env var
  named by `FUUZ_TOKEN_ENV`, for clients that don't expand `${VAR}`.

## 0.13.4

- **Discovery diagnostics**: when the MCP server returns errors (e.g. a key
  lacks query permissions), the failures are now **surfaced** — a "Couldn't load
  some resources" node in the Resources view lists each one, and every sync logs
  to the **Fuuz** output channel — instead of silently showing only tools.
- **Permission warning**: if the API User isn't authorized, a notification names
  the affected modules and explains the fix — grant a read/query policy (or
  policy group) to the API User in Fuuz, then **issue a new API key** (existing
  keys don't inherit newly-granted policies) and **Replace API Key**.
- Documented the per-tenant authorization requirement (README → Permissions).
- Discovery model queries are **serialized** (not concurrent) to avoid
  throttling on busy tenants.

## 0.13.3

- **Interactive ERDs**: pan (drag), zoom (scroll), and **Fit**, with **Export .mmd**.
- Mermaid is now **bundled** (renders offline; fixes the blank diagram caused by a
  blocked CDN import).
- **Pre-ship hardening**:
  - **Sync** now clears the ERD/field caches so re-syncing reloads everything.
  - **Deploy** is gated behind the `fuuz.enableDeploy` setting (off by default).
  - MCP sessions **retry with backoff** when the server throttles rapid calls.

## 0.13.0

- **ERD expansion**: module-level and application-level entity-relationship
  diagrams, inbound references on the per-model ERD, and **Export .mmd**.
- **Query Data Model**: read-only `system_query_model` runner (pick fields +
  JSON filter → results in a JSON view).
- **Deploy Component Version**: guarded `system_deploy_app_component_version`
  (explicit type + version + modal confirm; data-model deploys flagged as
  destructive/async).
- **Open in Fuuz**: opens the active tenant's app host.
- **Find Data Model**: quick-pick search that opens a model's ERD.
- **Last-synced** indicator on the Resources view + auto-refresh on startup when
  the cache is stale (>30 min).
- Repository metadata fixed; this changelog added.

## 0.12.0

- **Real tool gating** via a local stdio MCP proxy that filters `tools/list` and
  blocks disabled `tools/call`.
- Tool classification: System = `system_*`; Custom (Data Flows) = `data_flow_*`
  and tenant flows.

## 0.11.0

- Agent Tools enable/disable, **Create New Tool** (guided Copilot chat), and lazy
  data-model field loading.

## 0.10.x

- MCP-driven resource discovery: Application tree
  (moduleGroup → module → screens/flows/data models), System Data Models,
  Environment, and MCP Tools; per-data-model ERD.
- Connection health + re-auth (Replace API Key); unit tests for the pure helpers.

## 0.9.x

- API-key onboarding (JWT-derived tenant/enterprise/environment), SecretStorage
  tokens, native MCP server registration, `.vscode/mcp.json`, per-endpoint health
  probing, sidebar welcome, and the connection-management panel.

## 0.8.0

- Initial MCP connection UI, SecretStorage, and native MCP registration.
