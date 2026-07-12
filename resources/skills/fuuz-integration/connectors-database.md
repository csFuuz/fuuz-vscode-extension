# Database Connectors

Two connectors for direct database access: Microsoft SQL Server and ODBC.

---

## MSSQL

| | |
|---|---|
| UUID | `bb612514-2129-4fa9-849d-f9f8f6ec1c8e` |
| Auth | Connection string (Username + Password) |
| Credentials | `username`, `password` |
| Connection Options | `port`, `database`, `connectionTimeout` (seconds, default 30), `requestTimeout` (seconds, default 30), `encrypt` (boolean, default false) |
| Endpoint URL | SQL Server hostname |

### Payload Fields

Each payload item:

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `query` | string | Y | SQL query or stored procedure name |
| `parameters` | array | N | Typed SQL parameters (see below) |
| `procedure` | boolean | N | When `true`, executes as stored procedure |
| `options.retry.retries` | integer | N | Max retry attempts (default 0) |
| `options.retry.factor` | integer | N | Exponential backoff factor (default 2) |
| `options.retry.minTimeout` | integer | N | Min retry delay in ms (default 100) |

### Parameter Types

All parameters share these base fields:

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `name` | string | Y | Parameter name |
| `dataType` | string | Y | SQL data type (see categories below) |
| `value` | any | N | Parameter value. Null if omitted. |
| `output` | boolean | N | When `true`, registers as output parameter |

Parameters are categorized by which sizing fields apply:

**No sizing parameters:**
`BigInt`, `Bit`, `Date`, `DateTime`, `Int`, `Float`, `Money`, `NText`, `Real`, `SmallDateTime`, `SmallInt`, `SmallMoney`, `Text`, `TinyInt`, `UniqueIdentifier`, `Xml`

**Length parameter** (add `length: integer`):
`Char`, `NChar`, `NVarChar`, `VarChar`

**Scale parameter** (add `scale: integer`):
`DateTime2`, `DateTimeOffset`, `Time`

**Precision + Scale parameters** (add `precision: integer`, `scale: integer`):
`Decimal`, `Numeric`

### Response Shape

```json
{
  "resultSets": [[]],
  "output": {},
  "rowsAffected": [0]
}
```

- `resultSets` -- Array of record set arrays (one per SELECT statement or result set)
- `output` -- Output parameter values
- `rowsAffected` -- Array of affected row counts

When `returnErrors: true`, failed items include an `errors` array: `[{ "message": "...", "info": {}, "code": 0 }]`

### Behavior Notes

- Connection pooling: max 10, min 2, idle timeout 30s
- Requests are executed sequentially (not in parallel)
- Non-retryable errors (containing "syntax", "invalid", "permission") abort immediately
- Retry uses exponential backoff

### Examples

Simple query:
```jsonata
$integrate({
  "connectionName": "My SQL Server",
  "payload": [
    {
      "query": "SELECT * FROM Orders WHERE CustomerID = @CustomerID",
      "parameters": [
        { "name": "CustomerID", "dataType": "Int", "value": 12345 }
      ]
    }
  ]
})
```

Stored procedure with output parameter:
```jsonata
$integrate({
  "connectionName": "My SQL Server",
  "payload": [
    {
      "query": "usp_GetOrderTotal",
      "procedure": true,
      "parameters": [
        { "name": "OrderID", "dataType": "Int", "value": 100 },
        { "name": "Total", "dataType": "Decimal", "precision": 18, "scale": 2, "output": true }
      ]
    }
  ]
})
```

---

## ODBC

| | |
|---|---|
| UUID | `914c3b05-7d13-4fd2-a0f8-fe925e67f066` |
| Auth | Driver-specific (connection string components) |
| Credentials | Driver-specific. Optional `netsuiteOAuth` object for NetSuite JWT auth. |
| Connection Options | `driver` (ODBC driver name) |

### Payload Fields

Each payload item:

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `query` | string | Y | SQL query |
| `variables` | array | N | Positional bind variables (substituted into `?` placeholders) |
| `options.retry.retries` | integer | N | Max retry attempts |
| `options.retry.factor` | integer | N | Exponential backoff factor |
| `options.retry.minTimeout` | integer | N | Min retry delay in ms |

### Response Shape

Array of result row objects (flat array, no wrapper).

### Behavior Notes

- Uses a worker pool to execute queries in separate processes
- Supports Plex and NetSuite ODBC drivers
- NetSuite OAuth: When credentials include a `netsuiteOAuth` object, fetches a JWT token before executing queries
- Task timeout applied per query execution

### Example

```jsonata
$integrate({
  "connectionName": "Plex ODBC",
  "payload": [
    {
      "query": "SELECT Part_Key, Part_No FROM Part_v_Part WHERE Part_Status = ?",
      "variables": ["Active"]
    }
  ]
})
```
