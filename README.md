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
- **Auto-loaded resources** — on connect, the extension opens an MCP session and
  pulls the environment/context info and the catalog of available MCP tools into
  the **Resources** view.
- **Runtime actions** — **Execute Flow** (`{ flowId, payload }`; also inline on
  Flow nodes) and **Send Webhook** (`{topic}` + JSON body). Responses open in a
  JSON editor; the `Fuuz` output channel logs each call.
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
- **App context file** — **Generate App Context File** writes `.fuuz/AVAILABLE.md`,
  a copilot-readable snapshot of the active tenant.

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

## Commands

- **Fuuz: Add Connection by API Key** — onboard a connection from a key
- **Fuuz: Configure Connections** — open the connection management panel
- **Fuuz: Select Active Tenant** — quick-pick the active enterprise/tenant
- **Fuuz: Sync Tenant Data** — refresh the Resources view for the active tenant
- **Fuuz: Show ERD** / **Show Module ERD** / **Show Application ERD** — entity-relationship diagrams (with Export .mmd)
- **Fuuz: Find Data Model** — quick-pick search that opens a model's ERD
- **Fuuz: Query Data Model** — read-only data query (pick fields + JSON filter)
- **Fuuz: Execute Flow** — run a data flow
- **Fuuz: Send Webhook** — post to a webhook topic
- **Fuuz: Deploy Component Version** — guarded deploy (screen / data flow / data model / saved transform); **off until you enable `fuuz.enableDeploy`**
- **Fuuz: Create New Tool (Data Flow)** — guided Copilot chat to build a tool
- **Fuuz: Open in Fuuz** — open the active tenant's app
- **Fuuz: Write MCP Server Config (.vscode/mcp.json)** — emit/refresh workspace MCP config
- **Fuuz: Generate App Context File** — write `.fuuz/AVAILABLE.md`
- **Fuuz: Replace API Key** / **Open Settings**

## Troubleshooting

- **Key reports unauthorized / "not active"** — the per-endpoint badges show the
  HTTP status and server message per endpoint. An inactive/expired key returns
  401; request a fresh key.
- **Resources view empty** — run **Sync Tenant Data**. If it stays empty, MCP may
  not be available for your subscription/key; configure flows in Fuuz to provide
  resources manually.
- **MCP server not appearing for Copilot** — confirm the tenant is enabled (not
  disabled) and has a token, then reload the window. You can also run **Write MCP
  Server Config** to materialize `.vscode/mcp.json`.

## Development

```bash
npm install        # install dev dependencies
npm run compile    # type-check + build to dist/
npm run watch      # rebuild on change
npm run lint       # eslint
npx @vscode/vsce package --no-dependencies   # build a .vsix
```

The extension has **no runtime dependencies** — it uses the VS Code API and the
runtime's global `fetch`. Requires VS Code **1.101+** (for the MCP server
definition API). Run `npm test` for the unit suite (pure parsing/derivation/ERD
helpers, via `node:test`).

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
  - `contextDocWriter.ts` — generates `.fuuz/AVAILABLE.md`
  - `tenantDataService.ts` — sync + cache resources
- **Providers**: `tenantSelectorProvider.ts` (Connections), `resourceTreeProvider.ts` (Resources)
- **UI**: `ui/configPanel.ts` (webview), `ui/statusBar.ts`, `ui/runtimeCommands.ts`
- **Entry point**: `extension.ts`

## License

See LICENSE file in the root of the repository.
