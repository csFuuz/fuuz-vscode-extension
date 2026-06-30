# Fuuz for VS Code

Connect VS Code to your Fuuz environments. Add a connection from an API key, and
the extension registers the **Fuuz MCP server** so your AI copilot (Copilot Chat /
agent mode) can work with your app, pulls in what the server exposes, and gives
you runtime actions (execute flows, send webhooks).

> Some features depend on your **Fuuz subscription including MCP** — see
> [Subscription & feature availability](#subscription--feature-availability).

## Requirements

- **VS Code 1.101+** (for the MCP server-definition API).
- A **Fuuz API key** for the tenant you want to connect (the key encodes the
  tenant/enterprise/environment). Keys can expire or be deactivated — the
  extension flags a rejected key and offers **Replace API Key**.
- For the AI features: the **GitHub Copilot** extension with **agent mode**, and a
  Fuuz subscription that includes **MCP**.

## Install (team)

Share the packaged `.vsix` and install it:

```bash
code --install-extension fuuz-vscode-extension-<version>.vsix
```

(`.vsix` installs don't auto-update — re-run on new versions. See
[Publishing](#publishing) for the Marketplace alternative.)

> **Tip:** add `.fuuz/` to your repo's `.gitignore` (the generated
> `AVAILABLE.md` is tenant-specific). `.vscode/mcp.json` is safe to commit — the
> token is referenced via a password prompt, not stored.

## Permissions (important)

Connecting and **listing** MCP tools needs no special authorization — but
**using** the tools (loading resources, querying data, running flows) requires
the API key's **API User** to be authorized **inside Fuuz**, per tenant/app.

In each Fuuz tenant/app you want to use, assign a **policy or policy group**
directly to the **API User record** that owns the key, granting at least the
**read/query** actions for the modules the extension reads:

- `accessControl` — environment/current-user info
- `configuration` — module groups, modules, screens, the model catalog
- `dataModeling` — data models
- `orchestration` — data flows
- (plus any business modules whose data you want to **Query Data Model**)

To **execute flows**, **send webhooks**, or **deploy**, the API User also needs
the corresponding write/execute permissions for those modules.

> **After granting policies, issue a *new* API key** for that tenant and update
> the connection with **Replace API Key**. An existing key does **not** pick up
> newly-assigned policies — permissions are bound when the key is issued.

> If the API User isn't authorized, the MCP server still **lists** the tools, so
> the **MCP Tools** section appears — but every data call is rejected with
> *"not authorized to execute the query action…"*, leaving the **Application**,
> **System Data Models**, and **Environment** sections empty. The extension shows
> these denials under a **"Couldn't load some resources"** node and in the
> **Fuuz** output channel (View → Output → Fuuz). The fix is to grant the policy
> in Fuuz — it is **not** a VS Code/extension setting. Authorization is
> **per tenant**, so it must be assigned in each tenant/app separately.

## Quick start

1. Install the extension and open the **Fuuz** icon in the activity bar.
2. Click **Add Connection by API Key** and paste a Fuuz API key.
3. The extension decodes the key (tenant, enterprise and environment), validates
   it against the MCP server, stores the token securely, sets it active, and
   auto-loads resources into the **Resources** view.

That's it — no manual host/tenant entry. You can also run **Fuuz: Add Connection
by API Key** from the Command Palette.

## How a connection is defined

Each enterprise is identified by an **environment slug** — the `{env}.{account}`
segment of the host, e.g. `build.mfgx` or `admin`. Every endpoint derives from
`https://api.{slug}.fuuz.app`:

| Purpose | URL | Notes |
| --- | --- | --- |
| MCP server | `…/mcp` | Registered with VS Code; used to validate keys and load resources |
| Flow execution | `…/orchestration/executeFlow` | `Execute Flow` action |
| Webhook | `…/webhook/post/{topic}` | `Send Webhook` action |

When you onboard with an API key, the slug, tenant and enterprise are read from
the token's claims. Any endpoint can be overridden per enterprise in the config
panel (**Edit environment & endpoints**). Every call authenticates with the
tenant's Bearer token, stored in VS Code **SecretStorage** — never in
`settings.json` or source control.

> **GraphQL** has no runtime endpoint. Saved queries/mutations are run by building
> a **data flow** that references the operation and executing that flow.

## What you get

- **Add by API key** — auto-detects tenant/enterprise/environment, validates, and
  stores the token securely.
- **Per-endpoint health** — onboarding and the per-tenant **Test endpoints**
  action probe MCP, flow execution and webhook independently and show which are
  available for your key (hover a badge for the exact URL checked).
- **Native MCP registration** — each enabled tenant with a token is registered as
  an HTTP MCP server so Copilot/agent mode can use it. **Write MCP Server Config**
  also emits a portable `.vscode/mcp.json` (the token is referenced via a password
  `input`, not written to disk).
- **Register with Claude** — VS Code's MCP registration is **only visible to VS
  Code's own Copilot**; Claude reads its own config. **Register MCP Server with
  Claude** writes the Fuuz servers into Claude Code (`.mcp.json` and/or user
  `~/.claude.json`) and Claude Desktop. See
  [Use with Claude](#use-with-claude-claude-code--claude-desktop).
- **Auto-loaded resources** — on connect, the extension opens an MCP session and
  pulls the environment/context info and the catalog of available MCP tools into
  the **Resources** view.
- **Runtime actions** — **Execute Flow** (`{ flowId, payload }`; also inline on
  Flow nodes) and **Send Webhook** (`{topic}` + JSON body). Responses open in a
  JSON editor; the `Fuuz` output channel logs each call. Flows are grouped by
  type (Edge / Webflow / Backend); **web flows** run in the Fuuz web UI, so
  Execute is hidden for them.
- **Connection management** — set active, **Replace key**, **Disable/Enable**, and
  remove connections from the config panel.
- **Agent tool control** — the config panel's **Agent Tools** section lists the
  tools the MCP server exposes — **System** (`system_*` platform tools) and
  **Custom (Data Flows)** (`data_flow_*` and any tenant flow) — and lets you
  enable/disable each. Disabling re-registers the connection through a local
  **gating proxy** that hides the tool from `tools/list` and blocks calls to it
  (enforced, not advisory). Data models lazy-load their fields when expanded.
- **Create New Tool** — kicks off a guided Copilot Chat (agent mode) that uses the
  Fuuz MCP tools to design and build a new **data flow** (exposed as a tool),
  gathering schema/context and confirming the design before making changes.
- **App context file** — **Generate App Context File** writes
  `.fuuz/<enterprise>-<tenant>/AVAILABLE.md`, a copilot-readable snapshot of the
  **active** tenant. Each connected tenant gets its own folder (created on demand),
  so context and generated files for one tenant never collide with another's —
  point your copilot at the active tenant's folder for new work. The snapshot
  carries a **stale-context banner** when the tenant hasn't been synced in 24h.
- **AI providers** — the *Fuuz Connections* panel lists the AI hosts the Fuuz MCP
  servers wire into (GitHub Copilot, Claude Code, Claude Desktop). Enable any
  number independently; the Claude providers offer **Sign in** via OAuth (see
  [Use with Claude](#use-with-claude-claude-code--claude-desktop)).

## Sidebar

The **Fuuz** activity-bar container has two stacked views:

- **Connections** — your enterprises and their tenants; click one to make it
  active. On a fresh install it shows a welcome with setup buttons.
- **Resources** — populated for the active tenant after a sync. With MCP it shows:
  - **Environment** — context/tenant details from the server
  - **MCP Tools** — the server's available tools (capabilities)
  - the flow-configured module-group hierarchy when present:

```
moduleGroup
├─ module
│  ├─ screens
│  ├─ flows
│  └─ data models
├─ documents
├─ scripts
└─ graphql (queries / mutations)
```

## Use with Claude (Claude Code / Claude Desktop)

VS Code's MCP registration (`registerMcpServerDefinitionProvider`) is consumed
**only by VS Code's own Copilot/agent mode** — Claude can't see it. Each MCP
client reads its own config, so to make Fuuz reachable from Claude the extension
writes the servers into Claude's config files.

### Sign in to Claude (OAuth)

In the **AI providers** card of *Fuuz Connections*, the Claude providers (Claude
Code, Claude Desktop) have a **Sign in** action that runs an OAuth 2.0 + PKCE
flow in the browser and stores the session in SecretStorage — no key to paste.
Signing in also enables that provider and registers the Fuuz servers into its
config.

OAuth is **client-configurable** so your organization can point it at the Claude
OAuth application it has registered:

| Setting | Purpose |
| --- | --- |
| `fuuz.claudeOAuth.clientId` | OAuth client id (**required** to enable sign-in) |
| `fuuz.claudeOAuth.authorizeUrl` | Authorization endpoint (default `https://claude.ai/oauth/authorize`) |
| `fuuz.claudeOAuth.tokenUrl` | Token endpoint (default `https://console.anthropic.com/v1/oauth/token`) |
| `fuuz.claudeOAuth.scopes` | Requested scopes (default `["profile"]`) |

> Until `fuuz.claudeOAuth.clientId` is set, **Sign in** reports that OAuth is not
> configured. Registering the Fuuz MCP servers into Claude's config (below) works
> independently of OAuth sign-in.

### Automatic (default)

With `fuuz.claudeAutoRegister` set to `userAndDesktop` (the default), the
extension keeps Claude in sync for you: whenever you **add a connection**,
**replace a key**, or **enable/disable** one, it rewrites the Claude config. So
the whole flow is just **connect an API key → restart Claude**. No command, no
env vars, no copy/paste.

| Target | Where it writes | Token |
| --- | --- | --- |
| Claude Code — user | `~/.claude.json` | **Embedded** (private home-dir config, mode 600, never committed) |
| Claude Desktop | `claude_desktop_config.json` | **Embedded** via the bundled stdio proxy (`proxy/mcp-proxy.js`) |

The live token is embedded into these private files exactly the way every other
MCP server stores its auth — and it's **refreshed automatically** when you
**Replace API Key**. Set `fuuz.claudeAutoRegister` to `user` (Claude Code only)
or `off` (manual only) to change this. Only `fuuz-*` keys are managed; everything
else in the files is preserved.

> **Restart Claude** after a change — Claude loads MCP servers at startup, so a
> running session won't see new/updated Fuuz servers until it's restarted.

> **Claude Desktop** launched from Finder uses the absolute `node` path the
> extension bakes into the config (it needs **Node 18+**). If no `node` is found
> it falls back to a bare `node`, which must be on the launch environment's PATH.

### Project scope (shareable, opt-in)

Run **Fuuz: Register MCP Server with Claude** and also tick **Claude Code — this
project** to write a `.mcp.json` at the workspace root. This file is meant to be
**committed and shared**, so the token is **never embedded** — entries reference
`Bearer ${FUUZ_TOKEN_<ENTERPRISE>_<TENANT>}`. The command's **Copy export
commands** action copies the matching `export FUUZ_TOKEN_…='<token>'` lines to
your clipboard; paste them into your shell profile (e.g. `~/.zshrc`) and restart
Claude.

> A project-scope server **shadows** a user-scope server with the same name in
> Claude Code. If you commit a project `.mcp.json`, make sure collaborators export
> the env vars, or that entry won't connect.

## Subscription & feature availability

The Fuuz MCP server is gated by your subscription. **If your subscription does not
include MCP**, MCP-dependent features are unavailable:

- registering the Fuuz MCP server for your AI copilot,
- automatic resource loading (environment + tool catalog),
- validating a key via the MCP handshake.

A connection's **Test endpoints** badges show exactly which endpoints your key can
reach. When MCP isn't available, you can still configure connections and use flow
execution / webhooks (subject to your key's permissions), and the **Resources**
view falls back to a manual state — you provide resource details by configuring
flows in Fuuz. Per-endpoint results can also differ by key: a key may be valid for
MCP but not for flow/webhook (or vice-versa), and the badges make that explicit.

Separately from your subscription, what the extension can load depends on the API
User's **authorization in Fuuz** — see [Permissions](#permissions-important). MCP
*reachable* but resources *empty* almost always means the API User lacks the
read/query policy in that tenant.

## Commands

- **Fuuz: Add Connection by API Key** — onboard a connection from a key
- **Fuuz: Configure Connections** — open the connection management panel
- **Fuuz: Sign in to AI Provider (Claude)** / **Sign out of AI Provider (Claude)** — Claude OAuth sign-in for the Claude providers
- **Fuuz: Select Active Tenant** — quick-pick the active enterprise/tenant
- **Fuuz: Sync Tenant Data** — refresh the Resources view for the active tenant
- **Fuuz: Show ERD** / **Show Module ERD** / **Show Application ERD** — interactive entity-relationship diagrams (drag nodes, expand fields, persisted layout)
- **Fuuz: Find Data Model** — quick-pick search that opens a model's ERD
- **Fuuz: Query Data Model** — read-only data query (pick fields + JSON filter)
- **Fuuz: Execute Flow** — run a data flow
- **Fuuz: Send Webhook** — post to a webhook topic
- **Fuuz: Deploy Component Version** — guarded deploy (screen / data flow / data model / saved transform); **off until you enable `fuuz.enableDeploy`**
- **Fuuz: Create New Tool (Data Flow)** — guided Copilot chat to build a tool
- **Fuuz: Open in Fuuz** — open the active tenant's app
- **Fuuz: Write MCP Server Config (.vscode/mcp.json)** — emit/refresh workspace MCP config
- **Fuuz: Register MCP Server with Claude** — write the Fuuz servers into Claude Code / Claude Desktop config
- **Fuuz: Generate App Context File** — write `.fuuz/AVAILABLE.md`
- **Fuuz: Replace API Key** / **Open Settings**

## Troubleshooting

- **Key reports unauthorized / "not active"** — the per-endpoint badges show the
  HTTP status and server message per endpoint. An inactive/expired key returns
  401; request a fresh key.
- **Only "MCP Tools" show / Application & data models empty** — the API User
  isn't authorized in that tenant. Open the **"Couldn't load some resources"**
  node (or View → Output → **Fuuz**); messages like *"not authorized to execute
  the query action on … in the configuration module"* tell you exactly which
  modules to grant. Assign the read/query **policy/policy group** to the API User
  in Fuuz for that tenant — see [Permissions](#permissions-important) — then
  **Sync Tenant Data**.
- **Resources view still empty after granting access** — run **Sync Tenant Data**
  (it clears caches). If MCP itself isn't available for your subscription, the
  view falls back to a manual state; configure flows in Fuuz instead.
- **MCP server not appearing for Copilot** — confirm the tenant is enabled (not
  disabled) and has a token, then reload the window. You can also run **Write MCP
  Server Config** to materialize `.vscode/mcp.json`.

## Development

```bash
npm install          # install dev dependencies
npm run compile      # tsc → dist/ AND bundle the ERD webview → media/erd/
npm run watch        # rebuild extension host on change
npm run watch:webview # rebuild the ERD webview on change
npm run lint         # eslint
npx @vscode/vsce package --no-dependencies   # build a .vsix
```

The **extension host** has **no runtime dependencies** — it uses the VS Code API
and the runtime's global `fetch`. The **ERD webview** is a separate React + React
Flow app under `src/webview/erd/`, bundled by esbuild into `media/erd/` (a build
asset, like an image); React etc. are devDependencies, not host runtime deps.
Requires VS Code **1.101+** (for the MCP server definition API). Run `npm test`
for the unit suite (pure parsing/derivation/ERD helpers, via `node:test`).

### Publishing

Distribute the `.vsix` directly, or publish under the `cscott` publisher:

```bash
npx @vscode/vsce login cscott     # one-time, needs a Marketplace PAT
npx @vscode/vsce publish
```

`publisher` is intentionally personal (not the company) so it isn't tied to an
org SLA. To re-home it, change `publisher` in `package.json`.

### Architecture

- **Services**
  - `tenantConfigurationManager.ts` — enterprises/tenants in settings; endpoint derivation
  - `tokenStore.ts` — tokens in SecretStorage
  - `connectionImporter.ts` — decode JWT, validate, upsert connection
  - `fuuzMcpClient.ts` — MCP session (initialize/tools), endpoint probing, MCP snapshot
  - `fuuzApiClient.ts` — flow execution / webhook POST client
  - `mcpServerProvider.ts` — registers Fuuz MCP servers with VS Code
  - `mcpJsonWriter.ts` — generates `.vscode/mcp.json`
  - `claudeMcpWriter.ts` — registers the Fuuz servers into Claude Code / Claude Desktop config
  - `aiProviderManager.ts` — enabled AI hosts (keyed-array state; multi-provider safe)
  - `claudeAuthProvider.ts` — `vscode.AuthenticationProvider` implementing Claude OAuth (PKCE)
  - `tenantWorkspace.ts` — per-tenant `.fuuz/<enterprise>-<tenant>/` repo folder + sync freshness (`util/syncFreshness.ts`)
  - `contextDocWriter.ts` — generates the active tenant's `AVAILABLE.md` in its repo folder
  - `tenantDataService.ts` — sync + cache resources
- **Providers**: `tenantSelectorProvider.ts` (Connections), `resourceTreeProvider.ts` (Resources)
- **UI**: `ui/configPanel.ts` (webview), `ui/statusBar.ts`, `ui/runtimeCommands.ts`, `ui/erdPanel.ts` (hosts the ERD webview)
- **ERD webview**: `src/webview/erd/` — React + React Flow app, bundled to `media/erd/` by esbuild; consumes the `ErdGraph` from `util/erdTypes.ts`
- **Entry point**: `extension.ts`

## License

See LICENSE file in the root of the repository.
