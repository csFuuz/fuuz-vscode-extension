# Plex Connectors

Four connectors for Plex Manufacturing Cloud. The Classic SOAP and UX connectors execute datasources and share the same outbound shape and pagination model. The API and IAM API connectors use standard REST patterns.

---

## Shared Outbound Shape (Classic SOAP + UX)

Each payload item returns:

```json
{
  "Parameters": {},
  "Rows": [{}],
  "Errors": [{ "request": {}, "message": "string", "statusCode": 0 }]
}
```

- `Parameters` -- Output parameters from the datasource
- `Rows` -- Array of result row objects
- `Errors` -- Present when `returnErrors: true` and a request fails

## Shared Pagination Model (Classic SOAP + UX)

Two pagination modes are available:

### Key-Based Pagination

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `keyColumn` | string | Y | Column to use as cursor for next page |
| `keyParameter` | string | Y | Datasource parameter to pass cursor value |
| `rowLimit` | integer (min 1) | Y | Rows per page (injected as `Top_N` parameter) |
| `maxPages` | integer (min 1) | N | Max pages before stopping. Default 500. Exceeding throws error. |

### Offset Pagination

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `offsetPagination` | boolean | Y | Must be `true` |
| `rowLimit` | integer (min 1) | Y | Rows per page (injected as `Limit` parameter) |
| `initialOffset` | integer (min 0) | N | Starting offset. Default 0. |
| `maxPages` | integer (min 1) | N | Max pages before stopping. Default 500. Silently stops. |

---

## Plex Classic SOAP

| | |
|---|---|
| UUID | `464e9c3f-dd6c-47af-8078-cda1ff25e966` |
| Auth | Basic (Username + Password) |
| Credentials | `Username`, `Password` |

Executes Plex datasources via SOAP XML `ExecuteDataSource` endpoint.

### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `datasourceKey` | integer | Y | Plex datasource key |
| `datasourceName` | string | N | Optional datasource name for the XML element |
| `parameters` | object | Y | Input parameters (keys map to Plex `@`-prefixed params, minus the `@`) |
| `options.pagination` | object | N | See pagination model above |

### Behavior Notes

- 5-minute HTTP timeout
- Checks `@Result_Error` output parameter for datasource-level errors
- `undefined` parameter values are omitted from the SOAP request

### Example

```jsonata
$integrate({
  "connectionName": "Plex Classic",
  "payload": [
    {
      "datasourceKey": 12345,
      "parameters": {
        "Part_No": "ABC-100",
        "Part_Status": "Active"
      },
      "options": {
        "pagination": {
          "keyColumn": "Part_Key",
          "keyParameter": "Part_Key_Start",
          "rowLimit": 1000
        }
      }
    }
  ]
})
```

---

## Plex UX

| | |
|---|---|
| UUID | `72974b11-897f-47bd-896d-133962ef7bbb` |
| Auth | Basic (Username + Password) |
| Credentials | `Username`, `Password` |

Executes Plex datasources via JSON REST API. Supports two modes.

### Execute Mode (standard datasource execution)

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `datasourceKey` | integer | Y | Plex datasource key |
| `datasourceName` | string | N | Optional name |
| `parameters` | object | Y | Input parameters |
| `options.pagination` | object | N | See pagination model above |

Posts to `/api/datasources/{datasourceKey}/execute` with `{ inputs: parameters }`.

### GET Mode (metadata/search)

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | string | Y | Must be `"get"` or `"GET"` |
| `parameters.datasourceKey` | integer | N | Fetch datasource by key |
| `parameters.datasourceName` | string | N | Search datasource by name |

Gets `/api/datasources/{key}` or `/api/datasources/search?name={name}`. No pagination in this mode.

### Behavior Notes

- 5-minute HTTP timeout
- Response columns/rows arrays are zipped into row objects
- Checks `response.outputs.Result_Error` for errors

### Example

```jsonata
$integrate({
  "connectionName": "Plex UX",
  "payload": [
    {
      "datasourceKey": 67890,
      "parameters": { "Status": "Active" },
      "options": {
        "pagination": {
          "offsetPagination": true,
          "rowLimit": 500,
          "maxPages": 10
        }
      }
    }
  ]
})
```

---

## Plex API

| | |
|---|---|
| UUID | `1cc8888c-bc12-4545-b354-d26f9493f0ac` |
| Auth | API Key (`consumerKey`) |
| Credentials | `consumerKey` |
| Connection Options | `tenantId` (optional, overrideable per-request) |

Generic REST connector for Plex Connect APIs.

### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `patch`, `delete` |
| `path` | string | Y | API path |
| `params` | object | N | Query string parameters |
| `tenantId` | string | N | Override connection-level tenant ID |
| `body` | any | N | Request body (object, array, string, number, null) |

### Response Shape

Array of raw API response bodies.

### Behavior Notes

- Sets `X-Plex-Connect-Api-Key` header from `consumerKey`
- Sets `X-Plex-Connect-Tenant-Id` from connection or per-request `tenantId`
- No built-in pagination

### Example

```jsonata
$integrate({
  "connectionName": "Plex Connect API",
  "payload": [
    {
      "method": "get",
      "path": "/api/v1/parts",
      "params": { "status": "active" },
      "tenantId": "my-tenant-id"
    }
  ]
})
```

---

## Plex IAM API

| | |
|---|---|
| UUID | `9db652bf-9f99-472e-ada2-71f8e92f973f` |
| Auth | OAuth2 Client Credentials (token cached ~9.5 minutes) |
| Credentials | `clientId`, `clientSecret` |

REST connector for Plex Identity & Access Management API.

### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `patch`, `delete` |
| `path` | string | Y | API path |
| `params` | object | N | Query string parameters |
| `body` | any | N | Request body (object, array, string, number, null) |

### Response Shape

Array of `{ body, errors }`. When `returnErrors: true`, failed requests return `{ body: {}, errors: [{ statusCode, error }] }`.

### Example

```jsonata
$integrate({
  "connectionName": "Plex IAM",
  "payload": [
    {
      "method": "get",
      "path": "/api/v1/users",
      "params": { "limit": 50 }
    }
  ]
})
```
