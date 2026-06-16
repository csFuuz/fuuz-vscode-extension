# Development Guide

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- VS Code 1.101+ (for the MCP server definition API)

### Initial Setup
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile
```

### Development Workflow

#### Watch Mode
While developing, run the TypeScript compiler in watch mode:
```bash
npm run watch
```

#### Running the Extension
1. Press `F5` in VS Code to launch the extension in a new window
2. The extension host will open with your extension loaded
3. Changes to TypeScript files will be automatically compiled by the watch task
4. Reload the extension window (`Ctrl+R` or `Cmd+R`) to test changes

#### Debugging
1. Set breakpoints in your TypeScript code
2. Press `F5` to start debugging
3. Use the Debug Console to evaluate expressions
4. Step through code with F10 (step over), F11 (step into), etc.

### Code Quality

#### Linting
```bash
npm run lint
```

Fix linting issues:
```bash
npm run lint -- --fix
```

### Testing

Currently, no automated tests are configured. To add tests:

```bash
npm run test
```

## Architecture Overview

### Services

#### `tenantConfigurationManager.ts`
Connection config: read/write enterprises & tenants in settings, track the
active selection, derive endpoints from the `environment` slug, manage the
globalState resource cache, and migrate legacy plaintext keys to SecretStorage.

#### `tokenStore.ts`
Per-tenant access tokens in VS Code SecretStorage (keyed by `enterpriseId:tenantId`).

#### `connectionImporter.ts`
Onboard a connection from an API key: decode the JWT claims (tenant, enterprise,
environment), validate against MCP, and upsert the enterprise + tenant.

#### `fuuzMcpClient.ts`
MCP/JSON-RPC over streamable HTTP: `initialize` handshake (captures
`Mcp-Session-Id`), `tools/list`, `tools/call`; endpoint probing (per-endpoint
availability); and the MCP snapshot (environment + tool catalog). Parses both
`application/json` and `text/event-stream` responses.

#### `fuuzApiClient.ts`
POST client for runtime actions: flow execution and webhooks.

#### `mcpServerProvider.ts`
Registers enabled tenants as HTTP MCP servers via
`vscode.lm.registerMcpServerDefinitionProvider`.

#### `mcpJsonWriter.ts` / `contextDocWriter.ts`
Generate `.vscode/mcp.json` (token via password `input`) and `.fuuz/AVAILABLE.md`.

#### `tenantDataService.ts`
Sync resources for a tenant (MCP snapshot first, manual fallback) and cache them.

### Providers

#### `tenantSelectorProvider.ts`
The **Connections** view: enterprises and tenants, with the active one marked.

#### `resourceTreeProvider.ts`
The **Resources** view: Environment + MCP Tools from the snapshot, plus the
flow-configured module-group hierarchy when present.

### UI

`ui/configPanel.ts` (webview), `ui/statusBar.ts`, `ui/runtimeCommands.ts`.

### Extension Entry Point

#### `extension.ts`
Initialize services/providers, register commands and the MCP provider, wire the
`onChanged` refresh, and manage context flags.

## Configuration Structure

Connection metadata lives in user settings (`scope: application`); tokens live in
SecretStorage; the resource cache lives in globalState.

```json
{
  "fuuz.enterprises": [
    {
      "id": "fuuz-administration",
      "name": "Fuuz Administration",
      "environment": "admin",
      "tenants": [ { "id": "fuuzAdministrationBuild", "name": "Build" } ]
    }
  ],
  "fuuz.activeEnterprise": "fuuz-administration",
  "fuuz.activeTenant": "fuuzAdministrationBuild"
}
```

No `apiKey` (SecretStorage) and no `resourceCache` (globalState) in settings.
Optional per-enterprise overrides: `mcpEndpoint`, `mcpServerUrl`,
`flowExecutionUrl`, `webhookUrl`. A tenant may have `"disabled": true`.

## MCP integration

Endpoints derive from `https://api.{environment}.fuuz.app`: `…/mcp` (registered
with VS Code + used to validate keys and load resources), `…/orchestration/executeFlow`
(flows), `…/webhook/post/{topic}` (webhooks). All requests send
`Authorization: Bearer <token>`. The MCP transport is streamable HTTP (JSON-RPC),
not REST. MCP-dependent features require a subscription that includes MCP.

## Extending the Extension

### Adding a runtime endpoint

1. Add the derived URL in `EnterpriseEndpoints` + `endpointsFor`.
2. Add a method to `fuuzApiClient.ts` (or `fuuzMcpClient.ts` for MCP calls).
3. Register a command in `ui/runtimeCommands.ts` and declare it in `package.json`.
4. Add it to the endpoint prober if it should appear in **Test endpoints**.

### Adding New Commands

1. Define the command in `package.json` in the `contributes.commands` section
2. Register the command handler in `extension.ts` using `vscode.commands.registerCommand()`
3. Implement the command logic

### Adding New Views

1. Add view configuration in `package.json` under `contributes.views` or `contributes.viewsContainers`
2. Create a new TreeDataProvider class
3. Register the provider in `extension.ts` using `vscode.window.registerTreeDataProvider()`

## Debugging Tips

### Console Output
Use `console.log()` for debugging. Output appears in the "Fuuz Extension" output channel in the Debug Console.

### Extension Diagnostics
Check the "Fuuz Extension" output channel for diagnostic messages from the extension.

### Configuration Debugging
Inspect the actual configuration stored:
1. Open Command Palette (Ctrl+Shift+P)
2. Run "Preferences: Open User Settings (JSON)" or "Preferences: Open Workspace Settings (JSON)"
3. Search for "fuuz" to see stored configuration

### Network Debugging
If having issues with MCP calls:
1. Check the environment slug / MCP URL is correct (`https://api.<slug>.fuuz.app/mcp`)
2. Verify the API key is valid and not expired/inactive
3. Test the MCP endpoint manually with an `initialize` handshake:
   ```bash
   curl -X POST "https://api.<slug>.fuuz.app/mcp" \
     -H "Authorization: Bearer <key>" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"c","version":"1"}}}'
   ```
4. Or use the per-tenant **Test endpoints** action and hover each badge for the URL + status
5. Check the `Fuuz` output channel and VS Code Output panel for messages

## Building for Distribution

### Creating a VSIX Package
```bash
npm install -g vsce
npm run compile
vsce package
```

This creates a `.vsix` file that can be installed in VS Code or published to the VS Code Marketplace.

### Versioning
Update the version in `package.json` before creating a new VSIX release.

## Troubleshooting

### Extension won't activate
- Check that all dependencies are installed: `npm install`
- Ensure TypeScript is compiled: `npm run compile`
- Check the Debug Console for error messages

### Tree views not showing
- Make sure configuration context flags are set correctly
- Run "Fuuz: Configure Tenants" to ensure enterprises are configured
- Run "Fuuz: Select Active Tenant" to select a tenant

### Commands not working
- Reload the extension window (Ctrl+R or Cmd+R)
- Check the Command Palette to ensure commands are listed
- Verify the command is properly registered in `extension.ts`

### API calls failing
- Check the MCP endpoint URL in settings
- Verify the API key is correct
- Test the endpoint manually with curl
- Check VS Code Output for error messages
