# Validation

Nodes for validating payloads against schemas.

---

## Validate Schema

| | |
|---|---|
| **Name** | `validate` |
| **Title** | Validate |
| **Responsibility** | transition |
| **Description** | Validates the payload against a provided JSON Schema. If the payload does not conform to the schema, the node throws an error. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `schema` | object | -- | Yes | The JSON Schema to validate the payload against. |

Standard output port.

**Validation:** requireInputNode, requireOutputNode

### Example Configuration

```json
{
  "schema": {
    "type": "object",
    "required": ["orderId", "items"],
    "properties": {
      "orderId": { "type": "string" },
      "items": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "required": ["sku", "quantity"],
          "properties": {
            "sku": { "type": "string" },
            "quantity": { "type": "integer", "minimum": 1 }
          }
        }
      }
    }
  }
}
```
