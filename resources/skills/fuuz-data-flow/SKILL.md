---
name: fuuz-data-flow
description: Design and build Fuuz data flows. Use when the user needs to create data flows, understand flow structure, connect nodes, configure environments, or implement common flow patterns. For specific node configuration, use the fuuz-data-flow-nodes skill.
---

# Data Flow Design

Data flows are the primary automation mechanism in the Fuuz/MFGx platform. A flow is a directed graph of nodes that processes data through transformations, queries, mutations, conditionals, and actions.

## Flow Structure

### Version Container

Every data flow is wrapped in a version container with a header and a version:

```json
{
  "header": {
    "id": "myFlowId",
    "name": "My Flow",
    "description": "Processes incoming orders",
    "active": true,
    "dataFlowTypeId": "System",
    "logLevelId": "Debug",
    "moduleId": "myModule"
  },
  "version": {
    "id": "versionCuid",
    "number": "0.0.1",
    "description": "Initial version",
    "dataFlowId": "myFlowId",
    "flow": { },
    "diagram": { }
  }
}
```

### Flow Types

| Type | Environment | Purpose |
|------|-------------|---------|
| **System** | Backend | General-purpose automation, scheduled tasks, orchestration |
| **Document** | Backend | React to data model changes (creates, updates, deletes) |
| **Integration** | Backend | External system communication (HTTP, EDI, webhooks) **and any flow that must be callable as an API / MCP tool / endpoint** |
| **Screen** | Web | User-driven screen actions (button clicks, form saves, navigation) |
| **Edge** | Gateway | Device interaction (tag reads/writes, printing, PLC control) |

#### Choosing the type (REQUIRED — pick by how the flow is invoked)

- **Callable as an MCP tool / API / endpoint** (e.g. "an OEE tool my app or plant manager can call", "expose this as a tool", "a flow I can run with parameters") → **`Integration`**. This is the type the platform exposes as a callable tool; do NOT use `System` for a callable tool.
- **Triggered from a screen** (button click, form save, navigation) → `Screen`.
- **Reacts to data-model changes** (on create/update/delete) → `Document`.
- **Runs on a schedule or is orchestrated internally** (no external caller) → `System`.
- **Talks to a device / gateway** (PLC, printer, tag) → `Edge`.

`header.dataFlowTypeId` and `flow.type` must be the SAME value.

#### MCP-exposed flows: keep the tool schema JSON-representable (REQUIRED)

When a flow is exposed as an MCP tool (`mcpToolConfiguration.enabled = true`), that config
carries an explicit **`inputSchema`** and **`outputSchema`** (both JSON Schema). **Define
BOTH.** If `outputSchema` is left **null/unset**, the platform tries to **infer** the output
schema from the flow's actual return types — and flow nodes return **custom GraphQL types**
(DataModels, `EntityMatch*`, mutation results, …) that **cannot be represented in JSON
Schema**, so building the tool throws:

```
-32603  "Custom types cannot be represented in JSON Schema"
```

**This one failure blanks the ENTIRE tenant's tool catalog** — every tool, including the
`system_*` tools, disappears from `tools/list`, so AI assistants (Claude/Copilot) see *no*
callable tools for that tenant. (Direct, by-name calls still succeed, which is why the flow
"works" but no agent can discover it, and why the VS Code extension's Resources tree can
still load while agents can't.)

What's confirmed vs. still open:
- **Confirmed correlation:** every failing flow had `inputSchema` defined and valid but
  `outputSchema: **null**` (site1/site2 ctx-proto flows). A sibling tenant with **no** MCP-tool
  flows built its catalog fine. So a null `outputSchema` + custom return types is the trigger.
- **Not yet a proven remote fix:** setting `outputSchema` on the flow's config **via the API
  header alone did NOT clear `tools/list`** in testing — it likely must be baked into a
  **redeployed version**, and the flow graph can't be faithfully round-tripped through
  `system_query_model` (nodes come back as TRON, not JSON), so this is **not** safely fixable
  by blind remote mutation. Do it in the **flow designer**: set an explicit `outputSchema`
  (a permissive `{"type":"object","additionalProperties":true}` if the output is free-form)
  on the MCP-tool config and **redeploy** the flow.

Rules:
- **Always define an explicit `outputSchema`** (and keep `inputSchema` JSON-representable) on
  an MCP-exposed flow, in the designer, and redeploy — don't leave `outputSchema` null.
- Best fixed at the platform level too: Fuuz should treat a null `outputSchema` as "omit"
  rather than inferring a custom-typed one, and `tools/list` should skip an unrepresentable
  tool instead of failing the whole tenant's catalog.
- Diagnosis: the Fuuz VS Code extension surfaces the exact `-32603` message under **"Couldn't
  load some resources"** and the **Fuuz** output channel. A tenant that connects but shows an
  empty tool catalog while a sibling tenant is fine is the signature of this bug.

### Flow Schema

The flow is the execution model -- what the engine runs. Required fields: `id`, `type`.

```json
{
  "id": "versionCuid",
  "name": "My Flow",
  "type": "System",
  "version": "0.0.1",
  "nodes": [
    { "id": "node-1", "name": "Start", "type": "request", "data": { "nextNodes": ["node-2"] } },
    { "id": "node-2", "name": "Process", "type": "transform", "data": { "transform": "$", "nextNodes": [] } }
  ]
}
```

## Node Schema

Each node in the `nodes` array. Required fields: `id`, `name`, `type`.

```json
{
  "id": "2bb4855c-e400-432e-9504-b0a9eb8b8209",
  "name": "Get Records",
  "type": "query",
  "data": {
    "api": "Application",
    "query": "{ items { edges { node { id name } } } }",
    "variablesTransform": "{}",
    "nextNodes": ["next-node-uuid"]
  },
  "note": "Optional documentation string",
  "debug": {
    "breakpointEnabled": false,
    "publishSubscribeClient": false,
    "publishToMFGx": false
  },
  "logging": {
    "executionMetrics": false,
    "executionStarted": false,
    "executionSucceeded": false,
    "executionFailed": true,
    "enableTraceLogging": false
  }
}
```

- `debug.breakpointEnabled` -- Pause execution at this node
- `debug.publishSubscribeClient` / `debug.publishToMFGx` -- Publish debug events
- `logging.executionFailed` -- Typically always enabled; other logging fields enable granular tracing

### Common `data` Object Shapes

| Pattern | Example |
|---------|---------|
| Transform | `{ "transform": "$", "nextNodes": [...] }` |
| Query | `{ "api": "Application", "query": "...", "variablesTransform": "{}", "nextNodes": [...] }` |
| Mutation | `{ "api": "Application", "mutation": "...", "variablesTransform": "{}", "nextNodes": [...] }` |
| Event source | `{ "topic": "myTopic", "nextNodes": [...] }` |
| Conditional (ifElse) | `{ "transform": "expr", "onTrueNextNodes": [...], "onFalseNextNodes": [...] }` |

## Node Connections

Nodes connect via `data.nextNodes` -- an array of downstream node IDs. Terminal nodes have `"nextNodes": []`.

```json
{ "id": "A", "data": { "nextNodes": ["B"] } }
{ "id": "B", "data": { "nextNodes": ["C", "D"] } }
```

### Named Output Ports

| Port Pattern | Node Types | Description |
|-------------|------------|-------------|
| `nextNodes` | Most nodes | Standard single output |
| `onTrueNextNodes` / `onFalseNextNodes` | `ifElse` | Conditional branching |
| `onConfirmNextNodes` / `onDeclineNextNodes` | `confirm` (web only) | User confirmation branching |
| `branches[].nextNodes` | `switch` (route) | Multi-way routing |
| `nextNodes` / `catchNode` | `catchError` | Normal flow + error handler |

## Diagram Schema

The diagram is the visual layout for the flow designer UI. It runs parallel to the flow -- every flow node has a corresponding diagram node with the **same ID**.

```json
{
  "id": "versionCuid",
  "offsetX": 97.54, "offsetY": -70.01, "zoom": 77.15, "gridSize": 5,
  "layers": [
    { "id": "layer-1", "type": "diagram-links", "isSvg": true, "transformed": true, "models": {
      "link-uuid": {
        "id": "link-uuid", "type": "default",
        "source": "source-node-id", "sourcePort": "port-id",
        "target": "target-node-id", "targetPort": "port-id",
        "width": 3, "curvyness": 50,
        "points": [
          { "id": "p1", "type": "point", "x": 224, "y": 334 },
          { "id": "p2", "type": "point", "x": 259, "y": 334 }
        ]
      }
    }},
    { "id": "layer-2", "type": "diagram-nodes", "isSvg": false, "transformed": true, "models": {
      "node-uuid": {
        "id": "node-uuid", "type": "query", "x": 350, "y": 110, "name": "Get Records",
        "data": {}, "debug": {}, "logging": {},
        "ports": [{
          "id": "port-uuid", "type": "default", "x": 342, "y": 141,
          "parentNode": "node-uuid", "links": ["link-uuid"],
          "in": true, "fieldLabel": "Output", "fieldPath": "data.nextNodes"
        }]
      }
    }}
  ]
}
```

Key relationships:
- The diagram node duplicates `data`, `debug`, and `logging` from the flow node
- Diagram nodes add visual properties: `x`, `y`, `ports`, `selected`
- Port `in: true` = input port; `in: false` = output port
- Port `fieldPath` maps to the node data property storing connections (e.g., `data.nextNodes`)
- The flow is the source of truth for execution; the diagram is the source of truth for layout

## Execution State

The engine passes state between nodes:

```json
{
  "payload": {},
  "context": {},
  "claims": {},
  "nextNodes": [],
  "depth": 0,
  "messageId": "unique-execution-id",
  "metadata": { "tenantId": "..." },
  "catchErrorNode": "node-id-or-null",
  "lastError": { "message": "...", "stack": "...", "node": "..." },
  "batches": {},
  "trace": []
}
```

- `payload` -- Current data being processed; each node can replace or transform it
- `context` -- Persistent key-value store shared across all nodes in the flow
- `claims` -- Authentication claims from the initiating user or system
- `depth` -- Incremented each hop (max 1000 by default)
- `catchErrorNode` -- Set by `catchError`; routes errors to the specified handler
- `lastError` -- Error details when routed through a catch handler

### Node Output

Whatever data a node returns is provided directly as the input to the next node. There is no requirement to wrap output in a `payload` object — the return value itself becomes `$$` (the root input) for downstream nodes.

Return `null` to stop execution at the current node.

## Environments

### Backend (Document, Integration, System)

- Runs on the server in the orchestration service
- Uses RabbitMQ work queues for distributed, durable execution
- Supports conductor mode (source/event nodes) and worker mode (processing nodes)
- Access to GraphQL APIs, topic pub/sub, email, document generation
- Flows persist across restarts via the message queue

### Web (Screen)

- Runs in the browser; flow orchestration is client-side, data nodes dispatch to the backend
- Adds UI-specific nodes for dialogs, navigation, and screen element manipulation
- Short-lived: triggered by user action, executes, completes
- Access to screen context (`$components`, form data, screen state)

| Category | Nodes |
|----------|-------|
| **Dialogs** | `alert`, `confirm`, `form`, `screen`, `snackbar` |
| **Navigation** | `navigateTo`, `navigateBack`, `navigateReload` |
| **Form Elements** | `loadFormData`, `saveFormData`, `deleteFormData`, `validateFormData`, `setFieldValue`, `focusBlurField`, `enableDisableField` |
| **Table Elements** | `searchTable`, `changeTableData`, `changeTableSelection` |
| **Container Elements** | `hideShowContainer`, `collapseExpandContainer`, `hideShowLoading` |
| **Screen Elements** | `executeAction` |

### Gateway (Edge)

- Runs on the Device Gateway -- a native on-premises application
- Bridges the platform with physical devices (PLCs, printers, sensors, databases)
- Uses local EventEmitter for pub/sub (not RabbitMQ)
- Device nodes: `deviceSubscription`, `tagChanges`, `getTagValue`, `setTagValue`, `executeDeviceFunctionV2`, `devicePrintDocument`, `devicePrintFile`, `devicePrintRaw`, `getWorkcenterMode`, `setWorkcenterMode`

### Core Nodes (All Environments)

| Category | Nodes |
|----------|-------|
| **Fuuz** | `query`, `mutate`, `executeFlow`, `aggregate`, `email`, `generateDocument`, `integrationRequest`, `savedQuery` |
| **Transformation** | `transform` (JSONata), `javascript` |
| **Conditionals** | `ifElse`, `when` (accept/reject), `switch` (route) |
| **Context** | `setContext`, `getContext` |
| **Flow Control** | `catchError`, `fork`, `broadcast`, `delay`, `stop`, `merge` |
| **Events** | `topic`, `subscribe`, `publish`, `dataChanges`, `request`, `response`, `webhook` |

## Common Patterns

### Backend: Scheduled Query + Transform + Mutate

```
schedule -> query -> when -> transform -> mutate
```

```json
[
  { "id": "a", "name": "Schedule", "type": "schedule", "data": { "nextNodes": ["b"] } },
  { "id": "b", "name": "Get Records", "type": "query", "data": {
    "api": "Application",
    "query": "{ items(where: {status: {_eq: \"pending\"}}) { edges { node { id name } } } }",
    "variablesTransform": "{}",
    "nextNodes": ["c"]
  }},
  { "id": "c", "name": "Has Records?", "type": "when", "data": {
    "transform": "$count(items.edges) > 0", "nextNodes": ["d"]
  }},
  { "id": "d", "name": "Build Payload", "type": "transform", "data": {
    "transform": "items.edges.node.{ \"where\": {\"id\": id}, \"update\": {\"status\": \"processed\"} }",
    "nextNodes": ["e"]
  }},
  { "id": "e", "name": "Update Records", "type": "mutate", "data": {
    "api": "Application",
    "mutation": "mutation ($payload: [ItemUpdatePayloadInput!]!) { updateItem(payload: $payload) { id } }",
    "variablesTransform": "{ \"payload\": $ }",
    "nextNodes": []
  }}
]
```

### Backend: Event-Driven (Data Changes)

```json
[
  { "id": "a", "name": "Data Changes", "type": "dataChanges", "data": {
    "api": "Application", "type": "ProductionHistory", "operations": ["Create"], "nextNodes": ["b"]
  }},
  { "id": "b", "name": "Extract ID", "type": "transform", "data": {
    "transform": "{ \"workunitId\": value.after.workunitId }", "nextNodes": ["c"]
  }}
]
```

Data changes payload: `{ "value": { "before": null, "after": {...} }, "operation": "Create" }`

### Backend: Error Handling (catchError)

```json
[
  { "id": "a", "name": "Catch Errors", "type": "catchError", "data": {
    "nextNodes": ["b"], "catchNode": "e"
  }},
  { "id": "b", "name": "Risky Query", "type": "query", "data": {
    "api": "Application", "query": "...", "variablesTransform": "{}", "nextNodes": ["c"]
  }},
  { "id": "e", "name": "Handle Error", "type": "transform", "data": {
    "transform": "{ \"error\": lastError.message }", "nextNodes": ["f"]
  }},
  { "id": "f", "name": "Log Error", "type": "log", "data": {
    "messageTransform": "\"Error: \" & lastError.message", "level": "Error", "nextNodes": []
  }}
]
```

On error, `state.lastError` contains `{ "message", "stack", "node" }`.

### Backend: Fan-Out and Sub-Flows

```json
{ "id": "a", "name": "Fork", "type": "fork", "data": { "nextNodes": ["b", "c"] } }
{ "id": "d", "name": "Merge", "type": "merge", "data": { "nextNodes": ["e"] } }

{ "id": "x", "name": "Run Child", "type": "executeFlow", "data": {
  "flowId": "otherFlowId", "payloadTransform": "{ \"input\": $ }", "waitForResponse": true, "nextNodes": ["y"]
}}
```

### Web: Request -> SetContext -> Route

The canonical Screen flow pattern:

```json
[
  { "id": "a", "name": "Request", "type": "request", "data": { "nextNodes": ["b"] } },
  { "id": "b", "name": "Set Context", "type": "setContext", "data": { "transform": "$", "nextNodes": ["c"] } },
  { "id": "c", "name": "Route", "type": "switch", "data": {
    "branches": [
      { "name": "Save", "transform": "ACTION = \"save\"", "nextNodes": ["d"] },
      { "name": "Delete", "transform": "ACTION = \"delete\"", "nextNodes": ["e"] }
    ]
  }}
]
```

### Web: Form Save

```json
[
  { "id": "a", "name": "Request", "type": "request", "data": { "nextNodes": ["b"] } },
  { "id": "b", "name": "Validate", "type": "validateFormData", "data": { "elementName": "MyForm", "nextNodes": ["c"] } },
  { "id": "c", "name": "Save", "type": "saveFormData", "data": { "elementName": "MyForm", "nextNodes": ["d"] } },
  { "id": "d", "name": "Success", "type": "snackbar", "data": { "messageTransform": "\"Record saved\"", "variant": "success", "nextNodes": [] } }
]
```

### Web: Confirm Before Action

```json
[
  { "id": "a", "name": "Request", "type": "request", "data": { "nextNodes": ["b"] } },
  { "id": "b", "name": "Confirm Delete", "type": "confirm", "data": {
    "titleTransform": "\"Delete Record\"",
    "messageTransform": "\"This cannot be undone. Continue?\"",
    "onConfirmNextNodes": ["c"], "onDeclineNextNodes": []
  }},
  { "id": "c", "name": "Delete", "type": "mutate", "data": {
    "api": "Application",
    "mutation": "mutation ($id: ID!) { deleteItem(id: $id) { id } }",
    "variablesTransform": "{ \"id\": context.itemId }", "nextNodes": ["d"]
  }},
  { "id": "d", "name": "Done", "type": "snackbar", "data": { "messageTransform": "\"Deleted\"", "variant": "success", "nextNodes": [] } }
]
```

### Web: Other Common Actions

```json
{ "type": "navigateTo", "data": { "urlTransform": "\"/myModule/items\"", "nextNodes": [] } }

{ "type": "hideShowLoading", "data": { "elementName": "MyContainer", "actionTransform": "\"show\"", "nextNodes": ["b"] } }

{ "type": "ifElse", "data": { "transform": "status = \"active\"", "onTrueNextNodes": ["b"], "onFalseNextNodes": ["c"] } }

{ "type": "setFieldValue", "data": { "elementName": "statusField", "valueTransform": "\"approved\"", "nextNodes": [] } }

{ "type": "searchTable", "data": { "elementName": "itemsTable", "searchTransform": "{ \"status\": { \"_eq\": \"active\" } }", "nextNodes": [] } }

{ "type": "hideShowContainer", "data": { "elementName": "detailsPanel", "actionTransform": "\"show\"", "nextNodes": [] } }
```

### Gateway: Tag Change -> Process -> Write

```json
[
  { "id": "a", "name": "Watch Temp", "type": "tagChanges", "data": { "deviceId": "...", "tagId": "...", "nextNodes": ["b"] } },
  { "id": "b", "name": "Calculate", "type": "transform", "data": {
    "transform": "{ \"value\": value > 100 ? \"HIGH\" : \"NORMAL\" }", "nextNodes": ["c"]
  }},
  { "id": "c", "name": "Write Status", "type": "setTagValue", "data": {
    "deviceIdTransform": "\"...\"", "tagIdTransform": "\"...\"", "valueTransform": "value", "nextNodes": []
  }}
]
```

### Gateway: Device Function Execution

```json
{ "type": "executeDeviceFunctionV2", "data": {
  "deviceIdTransform": "context.printerId",
  "functionNameTransform": "\"printLabel\"",
  "payloadTransform": "{ \"data\": $ }",
  "nextNodes": ["b"]
}}
```

## Testability: the Source (debugSource) node

Every flow you build should be runnable in the designer **without waiting on a live trigger**. Fuuz provides a dedicated node for exactly this: the **Source** node (node type **`debugSource`**). Add one, give it a **representative sample payload**, and wire it into the node your real trigger feeds — then "Run" from it to execute the whole flow with that sample.

**Critical facts about the Source node:**

1. **It is a real node type — `debugSource`, displayed as "Source".** It is *not* a `request`/`transform`/anything else. (`request`, `schedule`, `topic`, `dataChanges`, `webhook`, `tagChanges` are the *live* trigger types — none of them carries a sample payload; a `request` node's `data` is strict and rejects any extra key like `samplePayload`.)
2. **It lives in the flow's `diagram`, NOT the executable `flow`.** `DataFlowVersion` has two content fields: `flow` (what the engine runs) and `diagram` (the designer graph). The Source node exists only in `diagram`, so it **never runs in production** — it's pure designer tooling. Querying `flow.nodes` will never show it; query the `diagram` field.
3. **It carries both a sample `payload` and a sample `context`.** Its `data` is `{ "payload": { …sample input… }, "context": { …sample $state.context… }, "nextNodes": ["<target node id>"] }`. `payload` seeds the flow input (`$`); `context` seeds `$state.context`. `nextNodes` (and a diagram link from its Output port to that node's input port) point at the node your live trigger feeds.

Shape, as stored in the `diagram` (mirror this exactly — the `name` is literally "Source"):

```json
"<uuid>": {
  "id": "<uuid>", "type": "debugSource", "name": "Source", "x": 35, "y": 170,
  "ports": [ { "id": "<port-id>", "type": "default", "parentNode": "<uuid>",
              "links": ["<link-id>"], "in": false,
              "fieldLabel": "Output", "fieldPath": "data.nextNodes" } ],
  "data": { "payload": { "orderId": "SO-1001", "quantity": 5 }, "context": {}, "nextNodes": ["<target node id>"] }
}
```
plus a `diagram` link `{ "source": "<uuid>", "sourcePort": "<port-id>", "target": "<target node id>", "targetPort": "<target's input port id>", … }`.

**How to add it — in the designer, not via MCP.** The `system_data_flow_mutations` tool explicitly warns **do not hand-construct the `diagram`** (manually built diagrams get port/layout wrong and break the designer UI). When you push a flow via MCP, omit `diagram` and the platform auto-generates it — then **add the Source node in the flow designer UI** (drag a Source node onto the canvas, paste the sample payload/context into it, and connect its Output to the node the trigger feeds). This is the supported path and takes seconds in the designer.

**Branch coverage.** Add **more than one** Source node to exercise different conditions — place an extra Source *before each route/switch or ifElse* with a payload/context that steers into that branch, so every path can be tested in isolation:

```
Source (payload: save action)   -> switch -> Save path
Source (payload: delete action) -> switch -> Delete path
```

The sample `payload`/`context` should mirror the real **contract** — the fields, types, and shape the flow expects — so the Source node doubles as living documentation of the expected input.

## General Design Principles

1. **Source nodes start the flow** -- `schedule`, `dataChanges`, `topic`, `request`, `tagChanges`, `deviceSubscription` trigger execution.
2. **Every flow needs at least one source** -- The entry point that triggers execution.
3. **Terminal nodes have empty nextNodes** -- `"nextNodes": []` means execution ends.
4. **`when` acts as a gate** -- If false, execution stops silently (no error).
5. **`ifElse` always branches** -- Both true and false paths should be defined (even if empty).
6. **`switch` routes by first match** -- Branches evaluated in order; first match executes.
7. **Keep flows linear when possible** -- Simpler flows are easier to debug.
8. **Use `setContext` for shared state** -- Especially in Screen flows where branches need the same data.
9. **Use `catchError` for external calls** -- Wrap queries and mutations that might fail.
10. **Name nodes descriptively** -- Names appear in logs and the designer; clear names simplify debugging.

## Before you run it: read [runtime-rules.md](./runtime-rules.md)

Why a wrong flow usually *runs* and does nothing. The request payload is out of
scope after the first node (so a gate reading `$.mode` after an http node makes
every run a silent dry run); `setContext` **replaces** the context while
`mergeContext` merges; `$metadata` is web-flows-only and the wrong form yields
nothing instead of erroring; a query node builds variables from its **own**
`variablesTransform`; the node type is `mutate`, not `mutation`, and an invalid
type deploys clean then answers `NotFoundError`; `flow.id` must equal the version
id or `executeFlow` hangs for 300 s. Also there: flow-type↔invocation pairing,
`DataFlowDeploymentLog` logging setup, schedules, topics, MCP tool exposure, and
how to push a flow too large to pass through a tool argument.
