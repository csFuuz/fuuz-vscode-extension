# Changelog

All notable changes to **Fuuz for VS Code**.

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
