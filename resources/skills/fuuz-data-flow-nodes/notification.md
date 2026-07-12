# Notification

Nodes for sending and receiving messages through notification channels.

---

## Send Push Notification

| | |
|---|---|
| **Name** | `sendNotification` |
| **Title** | Send Notification |
| **Responsibility** | transition |
| **Description** | Sends messages to a notification channel. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `notificationChannelId` | string | -- | Yes | The notification channel to send messages to. |
| `transform` | string | jsonata | No | Transform producing an array of notifications to send. Default: `"{}"`. |

Standard output port.

### Example Configuration

```json
{
  "notificationChannelId": "my-channel",
  "transform": "[{ \"title\": \"Order Complete\", \"body\": \"Order \" & orderId & \" has been processed.\" }]"
}
```

---

## Receive Push Notification

| | |
|---|---|
| **Name** | `receiveNotification` |
| **Title** | Receive Notification |
| **Responsibility** | source |
| **Description** | Receives notifications from a notification channel. This is a source node that starts the flow when a notification arrives. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `notificationChannel` | string | -- | Yes | The notification channel to subscribe to. |

Standard output port.
