# Debugging

Nodes for logging and inspecting data during flow execution.

---

## Log

| | |
|---|---|
| **Name** | `log` |
| **Title** | Log |
| **Responsibility** | transition |
| **Description** | Creates persistent log entries at runtime. If logs are not appearing, verify that the Data Flow log level is set to the same level or lower than the node's configured level. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `messageTransform` | string | jsonata | Yes | A JSONata transform producing a loggable string. Default: `""`. |
| `level` | string | -- | Yes | The logging level. Options: `Debug`, `Info`, `Warn`, `Error`. |
| `includeContext` | boolean | -- | Yes | When enabled, logs include the current state context. Default: `false`. |
| `includePayload` | boolean | -- | Yes | When enabled, logs include the payload passed into this node. Default: `false`. |

Standard output port.

### Example Configuration

```json
{
  "messageTransform": "'Processing order: ' & orderId",
  "level": "Info",
  "includeContext": false,
  "includePayload": true
}
```

---

## Echo

| | |
|---|---|
| **Name** | `echo` |
| **Title** | Echo |
| **Responsibility** | transition |
| **Description** | Routes the unmodified payload to the next nodes. Useful as a passthrough or placeholder during development. |

No configurable properties.

Standard output port.
