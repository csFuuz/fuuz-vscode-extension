# Changelog

All notable changes to **Fuuz for VS Code**.

## 0.37.0

Industrial best-practice checks across data models, flows and screens (type-aware,
cross-referenced against the live tenant; all suggestions flow into the Fix Plan).

- **Data models** (when the model type is known):
  - *Setup* models should have `color`, an `active`/`isActive` flag, and a `code` (with `id == code`, both immutable).
  - *Master/Transactional* models should reference a standard setup type (status/type/group/category) and carry a `status`/`isActive` (prefer soft-state over hard delete).
  - A model **named** like a setup type (…Status/Type/Group/Category/State) that isn't a setup model is flagged.
  - **Units of measure**: bare-number measurement fields should use the `Measure`/`Ratio` scalar or relate to the system `Unit` model.
- **Flows**:
  - Every `mutexLock` must have a matching `mutexUnlock` (deadlock guard).
  - Multi-write flows need a Try/Catch **transaction boundary**.
  - **Create-in-script** mutation values flagged as a data-import/integration risk (set defaults in triggers / data-change flows).
  - References to **deprecated** saved transforms flagged.
  - Error-handling flows should return a **standardized error response**.
- **Screens**:
  - `$integrate` in any screen element transform → use a Connection + integration flow.
  - A Form/Table bound to a **large transactional model with no server-side filter** is flagged for perf.
- **Duration** stays a composite scalar (from 0.36) and is never flagged as a missing-unit measure.

_Deferred pending live schema confirmation_: data-change-capture retention/disable rules
(history/telemetry), composite-index suggestions via the model trigger, app "no roles configured",
and deployment hygiene — these need exact Fuuz field names verified over MCP before shipping.

## 0.36.0

- **AI-assisted remediation — "Generate Fix Plan (Claude)"**: turn compliance findings
  into an actionable, Claude-ready Markdown brief that you review/accept, then run with
  Claude Code, which applies the changes via the Fuuz MCP. The extension never mutates the
  tenant itself. Available per-flow (tree context menu) and per-tenant (command palette).
  The plan groups work into concrete steps with **node ids**, **heuristic name suggestions**
  (Claude refines), and the exact `system_*` mutation tools to use — renames, descriptions,
  extracting long/duplicated scripts to Saved Scripts, similar queries to Saved Queries,
  adding payload-contract (`validate`) nodes, scoping/paginating queries, `$integrate`→http,
  credential fixes, and release-notes — then redeploy.
- **Highly-similar (not just identical) cross-flow detection**: scripts and queries embedded
  across flows are now clustered by token-shingle similarity (≈80%+), so near-duplicates that
  drifted apart are still surfaced for extraction into Saved Scripts / Saved Queries.
- **Heuristic naming suggestions** seeded into findings (e.g. a query on `productionRun` →
  "Query Production Run"; a script's jsdoc title → its name) and carried into the fix plan.
- **Long-script threshold raised to 300 lines** before suggesting extraction to a Saved Script.
- **Duration is a scalar**: `Duration` (`{ milliseconds, text }`, text ISO) is no longer treated
  as a relation in the ERD or schema compliance — no phantom edge / FK requirement.

## 0.35.0

- **View saved script/query content from the tree**: click a Script or Query in the
  resource tree (or use its inline "View Content" button) to open its real body in a
  read-only editor — `SavedTransform.transform` for scripts (opened as JavaScript /
  JSONata) and `SavedQuery.queryText` for queries (GraphQL). Fetched on demand over the
  platform `system_query_model` tool via a read-only `fuuz:` virtual document.

## 0.34.0

- **Flow compliance rebuilt on the real Fuuz node model** (validated against a live
  tenant). The analyzers now read `DataFlowElement` over the platform
  `system_query_model` tool and decode each node's real `configuration` (a new
  recursive TRON/JSON decoder), reasoning about the actual node types — `request`,
  `fork`, `collect`, `ifElse`, `switch`, `javascriptTransform`, `transform`,
  `savedTransformV2`, `query`, `http`, `tryCatch`, `validate`, … New & revised rules:
  - **Entry points** surfaced — multiple `request` nodes = separate paths (info, not an error).
  - **Fork/collect**: forks need NOT always recombine (parallel terminal paths are fine);
    a collect's batch count should match its fork's branch count; orphan collects flagged.
  - **Payload contract**: a saved script/query fed the whole context (`# Changelog

All notable changes to **Fuuz for VS Code**.

 pass-through) with
    no `validate` node — escalated when the saved transform declares an input schema.
  - **Query scoping**: an unfiltered query (no `where` / variable transform) is flagged on
    master/transactional models (cross-referenced against `DataModel` type + estimated record
    count), exempted for `setup` models; large models recommend a pagination cycle.
  - **Query page size**: `first: > 500` (and nested result sets) flagged as long-running.
  - `$integrate` in scripts → http (integration) node; hard-coded credentials; long inline
    scripts → saved script; error handling; node/flow naming; release-notes (devops) gaps.
- **Screen compliance** (new): **Check Screen Compliance** on a screen — flags > 5 action
  buttons, > 75 elements, oversized element configuration, inline transforms on table columns
  / form fields (move to table/form transforms), ambiguous names, and missing version notes.
  Folded into **Audit Entire Tenant** alongside models + flows.
- **System tools only**: all analysis reads platform `system_*` tools; the extension no longer
  depends on user-built `data_flow_*` flows (which can be unreliable/incomplete). The guided
  tool-builder prompt was updated to say the same.

## 0.33.0

- **Fix Claude /mcp auth errors from a shadowing project .mcp.json**: a project
  `.mcp.json` registers Fuuz servers with **env-var token refs** (safe to commit),
  but Claude Code gives project scope precedence over the embedded `~/.claude.json`
  servers — so if the `FUUZ_TOKEN_*` vars aren't exported, those token-less entries
  shadow the working ones and fail to authenticate.
  - On activation the extension now **detects** this and offers to remove the
    shadowing project entries (the embedded user-scoped servers keep working).
  - New command **Fix Claude MCP Conflicts (.mcp.json shadowing)**.
  - The extension's own access (resource tree, ERD, QA, etc.) and VS Code Copilot
    are unaffected either way — they use SecretStorage + in-memory registration,
    not `.mcp.json`.

## 0.32.0

- **Flow diagram compliance (Check Flow Compliance)**: analyzes a real deployed
  flow's nodes over MCP and flags: branch/collect payload mismatches, missing
  names/descriptions, scripts >100 lines (→ Saved Script), missing try/catch or
  error-response nodes, **delay** nodes (warning), `$integrate` in scripts (→ use
  an Integration node + Connection), **hard-coded credentials** (api key / token /
  password / passphrase — flagged as a risk), and hard-coded URLs / stray console
  logging. Broadcast nodes are surfaced. The node fetch discovers the
  `DataFlowElement` fields at runtime so it adapts to the tenant's schema.
- **Cross-flow checks (Check All Flows)**: finds the same query used across flows
  (→ Saved Query) and duplicated scripts (→ Saved Script).
- **Audit Entire Tenant**: runs model + flow compliance across the whole tenant
  and shows a summary — overall score, a per-artifact scorecard (worst first), and
  consolidated findings.

## 0.31.0

- **QA logs are bounded to the run**: log collection now uses the run window
  (start = plan time, end = result.json mtime or now) **capped to 3h**, instead of
  "createdAt → now" — so collecting days later no longer sweeps in unrelated logs.
- **Dropped deploy-log noise**: removed `DataFlowDeploymentLog` (deploy-time
  build logs like `addVersion`/version-validation) from QA collection; runtime
  flow activity is already captured via `ApplicationSpanEventLog`. QA logs now =
  span (runtime) + integration.
- **Cleaner result header**: the QA result view no longer renders an empty
  `( )` target when a run has no URL/environment.

## 0.30.0

- **Authority mode**: when starting a QA run you choose **Autonomous** (Claude
  proceeds with full authority once each persona is logged in — launched with
  per-action permission prompts bypassed) or **Manual** (supervised, confirms
  each step). Fixes the "prompts me too much" friction.
- **Security & RBAC probes**: every run now includes authorized front-end
  security objectives — forced browsing to unauthorized screens, client-only RBAC
  bypass, console/API probing, and (when destructive is enabled) XSS/injection —
  to surface RBAC leaks where the UI hides what the server still permits.
- **Artifacts stay with the run**: the brief now insists screenshots/GIFs and
  result.json are written under `.fuuz/qa/<tenant>/<run>/artifacts` (never the
  workspace root). Deleting a run already removes its entire directory — artifacts
  included.

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
