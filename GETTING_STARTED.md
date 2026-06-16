# Getting Started with Fuuz for VS Code

## Use it (the normal path)

1. Install the extension, then click the **Fuuz** icon in the activity bar.
2. Click **Add Connection by API Key** (or run **Fuuz: Add Connection by API Key**).
3. Paste a Fuuz API key.

The extension decodes the key to find the tenant, enterprise and environment,
validates it against the Fuuz MCP server, stores the token in SecretStorage,
makes it the active tenant, and auto-loads resources into the **Resources** view.

No manual host/tenant/JSON entry is required. The token is **never** written to
`settings.json`.

> Some features require a Fuuz subscription that includes **MCP** (server
> registration for your copilot, automatic resource loading, key validation).
> The per-connection **Test endpoints** badges show which endpoints your key can
> reach. See the README's "Subscription & feature availability".

## Manage connections

Open **Fuuz: Configure Connections**. For each tenant you can:

- **Set active** — choose which tenant the Resources view and MCP target
- **Test endpoints** — probe MCP / flow execution / webhook independently
- **Replace key** — paste a new API key (stored securely, then re-probed)
- **Disable / Enable** — keep config but exclude from MCP registration
- **Remove**

You can also **Edit environment & endpoints** to set the environment slug or
override any endpoint.

## Build from source

```bash
cd apps/vsCodeFuuzExtension
npm install
npm run compile        # or: npm run watch
```

Press `F5` in VS Code to launch an Extension Development Host with the extension
loaded. Requires VS Code **1.101+**.

## Next steps

- **Execute Flow** / **Send Webhook** run against the active tenant.
- **Write MCP Server Config** emits `.vscode/mcp.json` for portability.
- **Generate App Context File** writes `.fuuz/AVAILABLE.md` for your copilot.
