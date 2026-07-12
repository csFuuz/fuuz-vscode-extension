# Flow Control

Nodes for controlling the execution path and timing of a flow -- broadcasting, forking, combining, collecting, delaying, scheduling, error handling, and mutex locking.

---

## Broadcast

| | |
|---|---|
| **Name** | `broadcast` |
| **Title** | Broadcast |
| **Responsibility** | transition |
| **Description** | Outputs a stream of individual messages from an input array or object. Implements "for-each" or "map" style logic where subsequent nodes operate on each element individually. Non-object values are wrapped in a single-element array. Use a Combine node to recombine the results. |

No configurable properties beyond the standard output port.

Standard output port.

**Validation:** requireInputNode, requireOutputNode

---

## Fork

| | |
|---|---|
| **Name** | `fork` |
| **Title** | Fork |
| **Responsibility** | transition |
| **Description** | Creates batches of messages based on configurable branch outputs. Each branch executes in parallel with the full payload. Use a Combine node to recombine forked branches. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `branches` | array | -- | Yes | A list of branches to fork to. Each branch executes in parallel. |

**Branch items:**

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `name` | string | -- | No | Branch name. When recombined, results are keyed by this name. |
| `nextNodes` | array | port | Yes | Nodes to route a copy of the input payload to. |

**Validation:** requireInputNode, requireOutputNode

### Example Configuration

```json
{
  "branches": [
    { "name": "inventory", "nextNodes": [] },
    { "name": "pricing", "nextNodes": [] }
  ]
}
```

---

## Combine

| | |
|---|---|
| **Name** | `combine` |
| **Title** | Combine |
| **Responsibility** | transition |
| **Description** | Combines batches of messages created by Fork or Broadcast nodes back into a single message. If the batch count does not match, the node throws an error. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `executionTimeout` | integer | -- | Yes | Seconds to wait for the next message in a batch. Throws an error on timeout. Default: `10`. Min: 1, Max: 900. |
| `payloadCombinationStrategy` | string | -- | No | How payloads are combined. Options: `Index`, `Last`, `Merge`. Default: `"index"`. |
| `contextCombinationStrategy` | string | -- | No | How contexts are combined. Options: `Index`, `Last`, `Merge`. Default: `"first"`. |

Standard output port.

**Validation:** requireInputNode, requireOutputNode

---

## Collect

| | |
|---|---|
| **Name** | `collect` |
| **Title** | Collect |
| **Responsibility** | transition |
| **Description** | Collects messages by time or count, emitting an array when the threshold is reached. Both batch count and timeout should be provided to ensure emission. This node should generally not follow a Broadcast or Fork -- use Combine for those. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `batchCount` | integer | -- | No | Number of messages to collect before emitting. Default: 1000. Min: 2, Max: 1000. |
| `batchTimeMs` | integer | -- | No | Milliseconds to collect messages before emitting. Default: 300000 (5 min). Min: 1000, Max: 300000. |
| `payloadCombinationStrategy` | string | -- | No | How payloads are combined. Options: `Index`, `Last`, `Merge`. Default: `"index"`. |
| `contextCombinationStrategy` | string | -- | No | How contexts are combined. Options: `Index`, `Last`, `Merge`. Default: `"first"`. |

Standard output port.

**Validation:** requireInputNode, requireOutputNode

---

## Delay

| | |
|---|---|
| **Name** | `delay` |
| **Title** | Delay |
| **Responsibility** | transition |
| **Description** | Delays execution of the next nodes by a specified number of milliseconds. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `delay` | integer | -- | Yes | Milliseconds to delay. Minimum: 0. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireOutputNode

---

## Mutex Lock

| | |
|---|---|
| **Name** | `mutexLock` |
| **Title** | Mutex Lock |
| **Responsibility** | transition |
| **Description** | Prevents downstream nodes from executing until the lock is released. Only one message can process a shared resource at a time. The lock is released by a Mutex Unlock node or when the TTL expires. Locks are scoped to the specific flow version. If the lock cannot be acquired after all retries, the message is either discarded silently or an error is thrown. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `resourceIdTransform` | string | jsonata | Yes | Unique identifier for the resource being locked. Messages with the same Resource ID wait for each other. |
| `lockTTLms` | integer | -- | Yes | Milliseconds the lock is held before auto-release. Default: `30000`. Min: 30000, Max: 300000. |
| `lockRetries` | integer | -- | Yes | Max attempts to acquire the lock. Set to -1 for infinite retries (use with caution). Default: `3`. Min: -1. |
| `throwErrorWhenLockNotAcquired` | boolean | -- | Yes | When true, throws an error instead of silently discarding. Enable for explicit lock failure handling (e.g., with Try/Catch). Default: `false`. |

Standard output port.

**Validation:** requireInputNode, requireOutputNode

### Example Configuration

```json
{
  "resourceIdTransform": "'order-' & orderId",
  "lockTTLms": 60000,
  "lockRetries": 5,
  "throwErrorWhenLockNotAcquired": true
}
```

---

## Mutex Unlock

| | |
|---|---|
| **Name** | `mutexUnlock` |
| **Title** | Mutex Unlock |
| **Responsibility** | transition |
| **Description** | Unlocks the last lock placed by a Mutex Lock node. |

No configurable properties beyond the standard output port.

Standard output port.

**Validation:** requireInputNode

---

## Schedule

| | |
|---|---|
| **Name** | `schedule` |
| **Title** | Schedule |
| **Responsibility** | source |
| **Description** | Receives the payload from schedules attached to the data flow. Schedules are configured through the flow's schedule settings (not on the node itself). |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `configure` | display | -- | No | A link to configure a schedule for this flow. |

Standard output port.

**Validation:** requireChangedName, requireOutputNode

---

## Try Catch (Catch Error)

| | |
|---|---|
| **Name** | `tryCatch` |
| **Title** | Try Catch |
| **Responsibility** | transition |
| **Description** | Catches errors from downstream nodes. When an error occurs on the Try port's route, that branch stops and the Catch port's nodes execute. When no nodes are linked to the Catch port, Try Catch handling is cleared for downstream nodes. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `tryNextNodes` | array | port | Yes | Nodes to attempt during normal operation. |
| `catchNextNodes` | array | port | Yes | Nodes to route to if an error occurs on the Try route. |

**Validation:** requireInputNode, requireOutputNode

---

## Throw Error

| | |
|---|---|
| **Name** | `throwError` |
| **Title** | Throw Error |
| **Responsibility** | transition |
| **Description** | Throws a ThrowBindingError which halts execution. The error uses the provided message, and the data includes an object with an `info` property holding the Error Info value. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `messageTransform` | string | jsonata | Yes | The error message. |
| `errorInfoTransform` | string | jsonata | No | Transform producing an object with properties included with the error. Default: `"{}"`. |

No standard output port (execution halts on throw).

**Validation:** requireInputNode

### Example Configuration

```json
{
  "messageTransform": "'Invalid order: missing required field'",
  "errorInfoTransform": "{ \"orderId\": orderId, \"missingFields\": missingFields }"
}
```

---

## Periodic (Legacy) -- *Deprecated*

| | |
|---|---|
| **Name** | `periodic` |
| **Title** | Periodic |
| **Responsibility** | source |
| **Description** | Legacy scheduling node that ran on a fixed interval. Deprecated: use the Schedule node (`schedule`) instead, which allows changing frequency and payload without redeployment. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `interval` | integer | -- | Yes | Interval in milliseconds between executions. |

Standard output port.
