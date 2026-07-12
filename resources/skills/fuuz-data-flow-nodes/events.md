# Events

Nodes for subscribing to and publishing messages through the event system -- data changes, topics, webhooks, and request/response patterns.

---

## Data Changes

| | |
|---|---|
| **Name** | `dataChanges` |
| **Title** | Data Changes |
| **Responsibility** | source |
| **Description** | Subscribes to data change events. In an upcoming release, this node will not process changes made by the flow where it is defined. Leave fields blank to subscribe to all APIs, types, or operations. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `api` | string | -- | No | Which Fuuz API to subscribe to. Options: `Application`, `System`. Default: `"Application"`. |
| `type` | string | -- | No | The GraphQL type to subscribe to (e.g., `ItemRevision`). Leave blank for all types. |
| `operations` | array | -- | No | Operations to filter on. Options: `Create`, `Update`, `Delete`. |

Standard output port.

**Validation:** requireChangedName, requireOutputNode

### Example Configuration

```json
{
  "api": "Application",
  "type": "ItemRevision",
  "operations": ["Create", "Update"]
}
```

---

## Topic

| | |
|---|---|
| **Name** | `topic` |
| **Title** | Topic |
| **Responsibility** | source |
| **Description** | Subscribes to messages from a specific topic. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `topicName` | string | -- | Yes | The topic to subscribe to. |

Standard output port.

**Validation:** requireChangedName, requireOutputNode

---

## Publish

| | |
|---|---|
| **Name** | `publish` |
| **Title** | Publish |
| **Responsibility** | transition |
| **Description** | Publishes a message to a topic. When bulk publishing is enabled, an array input is published as individual messages. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `topicId` | string | -- | Yes | The topic to publish to. |
| `bulkPublishing` | boolean | -- | No | When enabled, an array input is published as individual messages. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode

---

## Request

| | |
|---|---|
| **Name** | `request` |
| **Title** | Request |
| **Responsibility** | source |
| **Description** | Initiates a flow from an external request. The flow must include a Response node to send a reply back to the requestor. |

No configurable properties.

Standard output port.

**Validation:** requireOutputNode

---

## Response

| | |
|---|---|
| **Name** | `response` |
| **Title** | Response |
| **Responsibility** | transition |
| **Description** | Sends a response to a flow execution initiated through a Request node. When the flow was not initiated through a Request node, this node does nothing. The node always outputs the payload it received. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `responseTransform` | string | jsonata | No | Transform on the input for the response sent back to the requestor. Default: `"$"`. |

Standard output port.

**Validation:** requireInputNode

---

## Webhook

| | |
|---|---|
| **Name** | `webhook` |
| **Title** | Webhook |
| **Responsibility** | source |
| **Description** | Subscribes to messages from a specific topic that is webhook accessible. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `topicName` | string | -- | Yes | The webhook-accessible topic to listen on. |

Standard output port.

**Validation:** requireChangedName, requireOutputNode

---

## Subscribe (Legacy) -- *Deprecated*

| | |
|---|---|
| **Name** | `subscribe` |
| **Title** | Subscribe |
| **Responsibility** | source |
| **Description** | Legacy event subscription node. Deprecated: use the Topic node (`topic`) instead. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `topicName` | string | -- | Yes | The topic to subscribe to. |

Standard output port.

---

## Integration Request Data Changes -- *Deprecated*

| | |
|---|---|
| **Name** | `integrationRequestDataChanges` |
| **Title** | Integration Request Data Changes |
| **Responsibility** | source |
| **Description** | Legacy node for subscribing to data changes on integration requests. Deprecated: no longer supported. |

Standard output port.
