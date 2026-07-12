# Conditionals

Nodes for branching and filtering flow execution based on conditions.

---

## If Else

| | |
|---|---|
| **Name** | `ifElse` |
| **Title** | If Else |
| **Responsibility** | transition |
| **Description** | Conditionally selects one of two output ports based on a single JSONata transform. When the transform returns true, the True port executes; when false, the False port executes. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `transform` | string | jsonata | Yes | A JSONata transform that should return a boolean value. |
| `onTrueNextNodes` | array | port | Yes | Nodes to route to when the transform evaluates to true. |
| `onFalseNextNodes` | array | port | Yes | Nodes to route to when the transform evaluates to false. |

**Validation:** requireInputNode

### Example Configuration

```json
{
  "transform": "payload.quantity > 0",
  "onTrueNextNodes": [],
  "onFalseNextNodes": []
}
```

---

## Route (Switch)

| | |
|---|---|
| **Name** | `switch` |
| **Title** | Route |
| **Responsibility** | transition |
| **Description** | Conditionally routes to one of many ports based on a list of transformations. Branch transforms are evaluated in order from top to bottom. The first branch that returns true receives the payload, and evaluation stops. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `branches` | array | -- | Yes | A list of conditional branches. At least one branch must match. |

**Branch items:**

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `name` | string | -- | Yes | The name of this branch. |
| `transform` | string | jsonata | Yes | A JSONata transform returning a boolean. |
| `nextNodes` | array | port | Yes | Nodes to route to when this branch's transform evaluates to true. |

**Validation:** requireInputNode

### Example Configuration

```json
{
  "branches": [
    { "name": "High Priority", "transform": "priority = 'high'", "nextNodes": [] },
    { "name": "Default", "transform": "true", "nextNodes": [] }
  ]
}
```

---

## Accept (When)

| | |
|---|---|
| **Name** | `when` |
| **Title** | Accept |
| **Responsibility** | transition |
| **Description** | Conditionally accepts messages from the flow. If the transform returns true, the message passes to the next nodes. If false, the message is dropped. This is the logical opposite of the Reject node. Previously called "Filter". |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `transform` | string | jsonata | Yes | A JSONata transform returning a boolean. True = proceed; false = terminate branch. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireOutputNode

### Example Configuration

```json
{
  "transform": "status = 'active'"
}
```

---

## Reject (Unless)

| | |
|---|---|
| **Name** | `unless` |
| **Title** | Reject |
| **Responsibility** | transition |
| **Description** | Conditionally rejects messages from the flow. If the transform returns true, the message is dropped. If false, the message passes to the next nodes. This is the logical opposite of the Accept node. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `transform` | string | jsonata | Yes | A JSONata transform returning a boolean. True = terminate branch; false = proceed. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireOutputNode

### Example Configuration

```json
{
  "transform": "status = 'deleted'"
}
```
