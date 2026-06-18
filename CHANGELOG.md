# Changelog

All notable changes to **Fuuz for VS Code**.

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
