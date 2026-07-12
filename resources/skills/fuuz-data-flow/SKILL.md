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
