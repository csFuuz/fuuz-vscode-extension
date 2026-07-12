---
name: fuuz-data-flow-nodes
description: Configure data flow nodes in Fuuz. Use when the user needs to configure a specific node type, understand what nodes are available, or look up node properties. Covers all 85+ node types across 12 categories (Conditionals, Context, Debugging, Device Gateway, Events, Flow Control, Fuuz, Integration, Notification, Scripts, Transformation, Validation).
---

# Data Flow Nodes Reference

## Concepts

A **Flow** defines an execution pipeline with an id, name, version, type, and an array of nodes. Flow types include System, Document, Integration, Screen, and Edge.

A **Node** is an instance within a flow, configured with an id, name, type, note, data, debug, and logging properties. The `type` references a NodeType name. The `data` object holds the configuration conforming to the NodeType's `dataSchema`.

A **NodeType** defines a node's capabilities:

| Field | Description |
|-------|-------------|
| `name` | Unique identifier (string, required) |
| `title` | Display name shown in the designer (string, required) |
| `category` | Grouping label (e.g., "Flow Control", "Integration") |
| `description` | What the node does (string, required) |
| `responsibility` | Role in the flow: `source` (starts a flow), `transition` (processes data), or `sink` (terminal) |
| `parallel` | Whether the node can execute in parallel (boolean) |
| `dataSchema` | JSON Schema defining configurable properties (object, required) |
| `validation` | Flow validation rules (object) |

### State Model

The workflow state passed between nodes contains:

- **payload** -- the current data being processed
- **context** -- persistent key-value store (set via Set Context / Merge Context, read via `$state.context`)
- **claims** -- authentication claims from the initiating user or system
- **batches** -- tracking info for broadcast/fork parallel execution


## Common Property Patterns

**Standard Output Port** -- Most transition nodes have a `nextNodes` property with `format: "port"`. When a node only has this standard port, documentation notes "Standard output port" rather than listing it in the properties table.

**JSONata Transform** -- Properties with `format: "jsonata"` accept a JSONata expression. In JSONata, `$` refers to the current scope. At the root level this is the input payload, but inside a nested expression (e.g., `$.test.( $.value )`) it shifts to the nested object. Use `$$` to escape back to the root input payload from within a nested scope. The `$state` binding provides access to the full workflow state (e.g., `$state.context`, `$state.claims`).

**Connection** -- Integration nodes typically have a `connectionName` or `connectionNameTransform` property referencing a named integration connection (HTTP, ODBC, FTP, etc.).

**Return Errors** -- `returnErrors` (boolean): when true, failed requests return `{ error: { statusCode, message, info } }` as payload instead of aborting the flow.

**Degree of Parallelism** -- `degreeOfParallelism` (integer, default 10): when the payload is an array, controls how many parallel requests execute simultaneously.

**Combination Strategies** -- Used by Combine and Collect nodes:

| Strategy | Behavior |
|----------|----------|
| `index` | Results ordered by branch index (default for payload) |
| `first` (labeled "Last") | Uses the last received result (default for context) |
| `merge` | Deep merges all results |


## Format Glossary

| Format | Meaning |
|--------|---------|
| `jsonata` | JSONata expression |
| `javascript` | JavaScript code block |
| `graphql` | GraphQL query or mutation string |
| `port` | Output port connecting to downstream nodes |
| `sql` | SQL query (used in inputProps mode) |


## Validation Rules

NodeTypes may specify these validation rules:

| Rule | Description |
|------|-------------|
| `requireChangedName` | Node must be renamed from default |
| `requireInputNode` | Must have at least one input connection |
| `requireOutputNode` | Must have at least one output connection |
| `requireWalkthrough` | Must have a completed walkthrough/note |
| `minimumNoteLength` | Minimum character length for the node note (integer) |


## Category Index

| Category | Count | Reference File | Description |
|----------|-------|----------------|-------------|
| Conditionals | 4 | [conditionals.md](./conditionals.md) | Conditional routing and filtering |
| Context | 3 | [context.md](./context.md) | Workflow context manipulation |
| Debugging | 2 | [debugging.md](./debugging.md) | Logging and echo for development |
| Device Gateway | 11 | [device-gateway.md](./device-gateway.md) | Device functions, printing, tags, workcenter modes |
| Events | 8 | [events.md](./events.md) | Event sources, pub/sub, webhooks |
| Flow Control | 12 | [flow-control.md](./flow-control.md) | Parallel execution, delays, error handling |
| Fuuz | 10 | [fuuz.md](./fuuz.md) | Platform queries, mutations, documents |
| Integration | 27 | [integration.md](./integration.md) | External system connectors |
| Notification | 2 | [notification.md](./notification.md) | Push notification send/receive |
| Scripts | 6 | [scripts.md](./scripts.md) | Custom transforms (JSONata, JS, saved scripts) |
| Transformation | 10 | [transformation.md](./transformation.md) | Data format conversion and array operations |
| Validation | 1 | [validation.md](./validation.md) | Schema validation |


## Performance Notes

The **Broadcast + Combine** pattern is acceptable for small datasets but performs poorly over large datasets. When processing large arrays, prefer using nodes with built-in `degreeOfParallelism` support (such as HTTP, Integrate, ODBC, Plex Datasource) or handle iteration within a JSONata or JavaScript transform instead.
