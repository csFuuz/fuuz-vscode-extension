# REST-Pattern Connectors

21 connectors follow the standard method + path + body pattern. They share a common base shape with per-connector variations in field names, method casing, body types, and extra fields.

## Base Inbound Shape

All REST connectors accept an array of items. The common fields are:

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` (or `action`) | enum | Y | HTTP method -- lowercase or UPPERCASE depending on connector |
| `path` (or `endpoint`) | string | Y | API endpoint path |
| `data` (or `body`) | varies | N | Request body |

Outbound: All REST connectors return an array. The exact item shape varies -- some return raw response bodies, others return `{ body, errors }` or `{ data, errors }`.

---

## Minimal REST Connectors

These connectors use the base shape with few extras.

### HTTP

| | |
|---|---|
| UUID | `05e0b880-7b0d-4ca1-9b8f-30126ffd305a` |
| Auth | Basic (Username + Password, optional) |
| Credentials | `Username`, `Password` |
| Connection Options | `Headers` (default headers merged into every request) |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `data` | object, array, string, number, null | N | Request body |
| `headers` | object | N | Custom headers (merged with connection defaults) |
| `responseType` | enum | N | `json` (default), `binary`, `text`. Binary returns base64 string. |
| `options.returnHeaders` | boolean | N | When `true`, returns `{ response, headers }` instead of just the body |

Example:
```jsonata
$integrate({
  "connectionName": "My REST API",
  "payload": [
    { "method": "get", "path": "/api/items", "headers": { "Accept": "application/json" } },
    { "method": "post", "path": "/api/items", "data": { "name": "Widget" } }
  ]
})
```

---

### Confluence

| | |
|---|---|
| UUID | `d7ca2d1a-cc71-47fb-8b26-d316bfaedaf9` |
| Auth | Basic (email:apiKey) |
| Credentials | `email`, `apiKey` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `body` | object, array, string, number, null | N | Request body |
| `headers` | object | N | Custom headers |
| `responseType` | enum | N | `binary`, `json`, `text` |
| `options.returnHeaders` | boolean | N | Return response headers alongside body |

---

### Arena PLM

| | |
|---|---|
| UUID | `c6a47b3d-5740-4cec-a9d1-dfba96249d03` |
| Auth | Session token via email/password login |
| Credentials | `Username` (email), `Password`, `Client ID` (workspaceId) |
| Connection Options | `Token URL`, `API URL` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `data` | object | N | Request body |

---

### Infor

| | |
|---|---|
| UUID | `07ba704-0eef-11eb-adc1-0242ac120002` |
| Auth | OAuth2 password grant (token cached ~2 hours) |
| Credentials | `clientId`, `clientSecret`, `grantType`, `accessTokenUrl`, `userName`, `password`, `scope` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `data` | object, array, string, number, null | N | Request body |

Note: Checks Infor-specific error fields (`cErrorMessage`, `errorMessage`) in successful responses.

---

### ChannelAdvisor

| | |
|---|---|
| UUID | `1bbd8c15-601e-43f5-b584-e898ba58bfd2` |
| Auth | OAuth2 refresh token (token cached ~58 minutes) |
| Credentials | `clientId`, `clientSecret`, `grantType`, `refreshToken` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `data` | object | N | Request body |

---

### CH Robinson

| | |
|---|---|
| UUID | `3c751b02-b23c-4615-9eba-c7a5dc33c507` |
| Auth | OAuth2 client credentials (token cached ~23.5 hours) |
| Credentials | `clientId`, `clientSecret`, `audience`, `grantType` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `data` | object | N | Request body |

---

## Uppercase Method Connectors

These connectors use UPPERCASE HTTP methods in the `method` field.

### Dynamics 365

| | |
|---|---|
| UUID | `808fce4c-6e38-4db8-b4b4-5c45a5a6f1cb` |
| Auth | OAuth2 client credentials |
| Credentials | `clientID`, `clientSecret`, `scope` |
| Connection Options | `accessTokenUrl` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `GET`, `POST`, `DELETE`, `PUT`, `PATCH` |
| `path` | string | Y | API path |
| `body` | object, array, boolean, null, string, number | N | Request body (accepts any JSON type) |
| `headers` | object | N | Custom headers |

Outbound: `{ body, errors }` per item.

---

### SuccessFactors

| | |
|---|---|
| UUID | `165219c4-830b-49af-828f-7964d4e4bd08` |
| Auth | SAML 2.0 Bearer Assertion (token cached ~8.3 minutes) |
| Credentials | `companyId`, `apiKey`, `certificate`, `privateKey`, `username`, `userType`, `audiences`, `issuer`, `newToken` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `GET`, `POST`, `DELETE`, `PUT`, `PATCH` |
| `path` | string | Y | API path |
| `body` | object, array, boolean, null, string, number | N | Request body |
| `headers` | object | N | Custom headers |

Outbound: `{ body, errors }` per item.

---

### WooCommerce

| | |
|---|---|
| UUID | `09fb753b-6b94-48b6-b70e-31ce7acdddac` |
| Auth | Basic (consumerKey:consumerSecret) |
| Credentials | `consumerKey`, `consumerSecret` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `GET`, `PUT`, `POST`, `DELETE` |
| `path` | string | Y | API path (prepended with `/wp-json/wc/{version}/`) |
| `data` | object | N | Request body |
| `version` | enum | N | `v2`, `v3` (default `v3`) |
| `parameters` | object | N | Query string parameters |

Outbound: `{ data }` or `{ error }` per item.

---

## Extended Method Connectors

These connectors support additional HTTP methods or extra options beyond the base shape.

### Salesforce

| | |
|---|---|
| UUID | `44ff6253-ca43-4429-955a-2907803178b8` |
| Auth | OAuth2 password flow (token cached ~59 minutes) |
| Credentials | `Username`, `Password`, `Client ID`, `Client Secret` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `patch`, `put`, `post`, `delete`, `head` |
| `path` | string | Y | API path |
| `data` | object | N | Request body |
| `params` | object | N | Query string parameters |
| `options.pagination` | boolean | N | When `true`, auto-follows `nextRecordsUrl` to get all pages |

Outbound: `{ data, errors }` per item.

Example:
```jsonata
$integrate({
  "connectionName": "Salesforce Prod",
  "payload": [
    {
      "method": "get",
      "path": "/services/data/v58.0/query",
      "params": { "q": "SELECT Id, Name FROM Account" },
      "options": { "pagination": true }
    }
  ]
})
```

---

### QuickBooks

| | |
|---|---|
| UUID | `88c548f7-4944-4eed-a948-9ce683e02a6f` |
| Auth | OAuth2 refresh token with token rotation (new refresh token saved back to connection) |
| Credentials | `clientId`, `clientSecret`, `refreshToken` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `patch`, `delete` |
| `path` | string | Y | API path |
| `body` | object, array, string, number, null | N | Request body |
| `headers` | object | N | Custom headers |
| `params` | object | N | Query string parameters |

---

### Square

| | |
|---|---|
| UUID | `c125d58f-41f5-41f5-b42e-3a63e3441526` |
| Auth | Static Bearer token |
| Credentials | `Personal Access Token` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `patch`, `post`, `delete` |
| `path` | string | Y | API path |
| `data` | object | N | Request body |
| `params` | object | N | Query string parameters |
| `version` | enum | N | `v2` (default) |
| `options.pagination` | boolean | N | Auto-follows cursor-based pagination (default `true`) |

Outbound: `{ records, errors, cursor }` per item.

---

## Pagination/Filter Extension Connectors

These connectors add built-in pagination, filtering, or OData query support.

### Magento

| | |
|---|---|
| UUID | `3d3b20ea-f261-40c1-9094-a556e60ce5e9` |
| Auth | Token-based (token cached ~59 minutes) |
| Credentials | `Username`, `Password` (or `Token` for pre-authenticated) |
| Connection Options | `Token URL` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `data` | object or array | N | Request body |
| `filters` | array | N | Magento search criteria filters |
| `pagination` | object | N | Magento pagination options |
| `options.returnErrors` | boolean | N | Per-item error handling |

Filter item fields:

| Field | Type | Description |
|-------|------|-------------|
| `field` | string | Field name |
| `value` | string | Filter value |
| `condition_type` | enum | `eq`, `finset`, `from`, `gt`, `gteq`, `in`, `like`, `lt`, `lteq`, `moreq`, `neq`, `nin`, `notnull`, `null`, `to` |

Pagination fields:

| Field | Type | Description |
|-------|------|-------------|
| `currentPage` | integer | Current page number |
| `pageSize` | integer | Results per page |
| `sortOrders` | array | `[{ field, direction }]` |

---

### Zoho CRM

| | |
|---|---|
| UUID | `4ff8769a-bdea-11e8-a355-529269fb1459` |
| Auth | OAuth2 refresh token (token cached ~59 minutes) |
| Credentials | `Authorization Token` (refresh token), `Client ID`, `Client Secret` |
| Connection Options | `API URL`, `Token URL`, `Redirect URL`, `Scope` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `data` | object | N | Request body |
| `modifiedSince` | string (date-time) | N | `If-Modified-Since` header value |
| `options.pages.start` | integer (min 1) | N | Starting page |
| `options.pages.stop` | integer (min 1) | N | Ending page (default Infinity) |

---

### Spiro

| | |
|---|---|
| UUID | `fa98a8d9-74f3-4ce1-8ef9-4455c31d3ce4` |
| Auth | Static Bearer token (JSON:API content type) |
| Credentials | `Authorization Token` |
| Connection Options | `API URL` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `data` | object | N | Request body |
| `filter` | string | N | Filter query string |
| `modifiedSince` | string (date-time) | N | `If-Modified-Since` header value |
| `options.returnErrors` | boolean | N | Per-item error handling |
| `options.pages.itemsPerPage` | integer (1-500) | N | Items per page (required for pagination) |
| `options.pages.start` | integer (min 1) | N | Starting page |
| `options.pages.stop` | integer (min 1) | N | Ending page |

---

### SAP Cloud

| | |
|---|---|
| UUID | `34e36d24-64f3-4d59-a764-bab5b851f72d` |
| Auth | API Key sent as `APIKey` header |
| Credentials | `Authorization Token` (API Key) |
| Connection Options | `API URL` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `data` | object | N | Request body |
| `top` | string | N | OData `$top` -- max records |
| `skip` | string | N | OData `$skip` -- records to skip |
| `filter` | string | N | OData `$filter` expression |
| `inlinecount` | enum | N | `""`, `allpages`, `none` |
| `orderby` | string | N | OData `$orderby` |
| `select` | string | N | OData `$select` -- fields to return |
| `expand` | string | N | OData `$expand` -- related entities |

Example:
```jsonata
$integrate({
  "connectionName": "SAP Cloud",
  "payload": [
    {
      "method": "get",
      "path": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner",
      "top": "100",
      "skip": "0",
      "filter": "BusinessPartnerCategory eq '1'",
      "select": "BusinessPartner,BusinessPartnerFullName"
    }
  ]
})
```

---

### Clover

| | |
|---|---|
| UUID | `2d259032-b9ea-4904-afbf-d30d4fc142a9` |
| Auth | Static Bearer token |
| Credentials | `Authorization Token` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `data` | object | N | Request body |
| `filters` | array | N | Clover filter array |
| `expand` | array of strings | N | Related entities to expand |
| `limit` | string | N | Result limit (default `"100"`) |
| `orderBy` | string | N | Sort field |

Filter item: `{ field, value, condition_type }` where `condition_type` is one of `==`, `!=`, `>`, `<`, `>=`, `<=`.

---

## Different Field Name Connectors

These connectors use `endpoint`/`action` instead of the standard `path`/`method`.

### NetSuite REST

| | |
|---|---|
| UUID | `ac61106b-72c6-4fca-8bc7-0ba3d54fb574` |
| Auth | OAuth 1.0 Token-Based Auth (HMAC-SHA256) |
| Credentials | `account`, `consumerKey`, `consumerSecret`, `tokenId`, `tokenSecret` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `endpoint` | string | Y | API path (used instead of `path`) |
| `action` | string | Y | HTTP method (used instead of `method`) |
| `body` | object, array, or string | N | Request body |
| `headers` | object | N | Custom headers |
| `parameters` | object | N | Query string parameters |

Outbound: `{ headers, data, error }` per item.

---

### UPS OAuth

| | |
|---|---|
| UUID | `c13ebe14-08f3-4c6a-bb1d-c717d8430ab9` |
| Auth | OAuth2 client credentials (token cached ~4 hours) |
| Credentials | `clientId`, `clientSecret`, `accountNumber` (merchantId) |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | enum | Y | `GET`, `POST`, `DELETE`, `PUT`, `PATCH` |
| `path` | string | N | API path |
| `data` | object | N | Request body |

Outbound: `{ body, errors }` per item.

---

## Mutual TLS Connectors

These connectors use client certificates for mutual TLS authentication.

### ADP

| | |
|---|---|
| UUID | `6a6da1f8-b69c-11e8-96f8-529269fb1459` |
| Auth | Mutual TLS + OAuth2 client credentials |
| Credentials | `Client ID`, `Client Secret` |
| Connection Options | `SSL Certificate`, `SSL Key`, `Token URL`, `API URL` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `put`, `post`, `delete` |
| `path` | string | Y | API path |
| `params` | object | N | Query string parameters |
| `data` | object | N | Request body |
| `options.masked` | boolean | N | Mask sensitive data (default `true`) |
| `options.roleCode` | enum | N | `employee`, `manager`, `practitioner`, `administrator`, `supervisor` |

---

### ADP Vista

| | |
|---|---|
| UUID | `5b2ed01a-628e-413e-8baf-f6d4c01fb53b` |
| Auth | Mutual TLS + OAuth2 client credentials (token cached ~30 minutes) |
| Credentials | `clientId`, `clientSecret`, `companyCode`, `scope`, `loginId` |
| Connection Options | `country`, `paymentUnit`, `legalEntity` |

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | `get`, `post` (only two methods) |
| `path` | string | Y | API path |
| `data` | array of objects | **Y** | Request body (required, must be array) |

Note: Connection options (`country`, `paymentUnit`, `legalEntity`) are sent as request headers.
