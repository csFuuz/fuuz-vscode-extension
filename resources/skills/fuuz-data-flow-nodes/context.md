# Context

Nodes for reading, writing, and removing data from the flow execution context. The context is a persistent key-value store accessible via `$state.context` in JSONata expressions.

---

## Set Context

| | |
|---|---|
| **Name** | `setContext` |
| **Title** | Set Context |
| **Responsibility** | transition |
| **Description** | Sets (replaces) the flow execution context with the output of the transform. Any existing context values not in the transform output are removed. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `transform` | string | jsonata | Yes | A JSONata transform run on the payload. The output replaces the state context. Access existing context with `$state.context`. |

Standard output port.

### Example Configuration

```json
{
  "transform": "{ \"orderId\": id, \"timestamp\": $now() }"
}
```

---

## Merge Context

| | |
|---|---|
| **Name** | `mergeContext` |
| **Title** | Merge Context |
| **Responsibility** | transition |
| **Description** | Deep-merges the transform output into the existing state context, concatenating arrays where possible. Unlike Set Context, existing context values are preserved. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `transform` | string | jsonata | Yes | A JSONata transform run on the payload. The output is deep-merged into `$state.context`. |

Standard output port.

### Example Configuration

```json
{
  "transform": "{ \"lastProcessed\": $now() }"
}
```

---

## Remove From Context

| | |
|---|---|
| **Name** | `removeFromContext` |
| **Title** | Remove From Context |
| **Responsibility** | transition |
| **Description** | Removes specified key paths from the state context. The transform must return an array of key path strings. If the result is not an array, no changes are made. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `transform` | string | jsonata | Yes | A JSONata transform that should return an array of key paths to remove from `$state.context`. Default: `"[]"`. |

Standard output port.

### Example Configuration

```json
{
  "transform": "[\"tempData\", \"scratchpad\"]"
}
```
