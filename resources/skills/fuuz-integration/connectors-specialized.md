# Specialized Connectors

15 connectors with unique schemas that do not follow the standard REST method+path pattern.

---

## File Transfer

### FTP/SFTP

| | |
|---|---|
| UUID | `396f9092-0c1e-4b3b-ac6d-760094c9466c` |
| Auth | Username/Password (or SSH Key for SFTP) |
| Credentials | `Username`, `Password` (or `SSH Key`) |
| Connection Options | `Protocol` (`FTP`, `FTPS`, `SFTP`), `Port` |

Action-based file operations over FTP, FTPS, or SFTP.

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | enum | Y | `get`, `getAllInDir`, `post`, `put`, `delete`, `move`, `list` |
| `file` | string | * | File path. Required for `get`, `post`, `put`, `delete`, `move`. |
| `data` | string | * | File content. Required for `post`, `put`. |
| `destination` | string | * | Destination path. Required for `move`, `getAllInDir`. |
| `options.limit` | number | N | Max files for `list` |
| `options.first` | number | N | First N files for `list` |
| `options.last` | number | N | Last N files for `list` |
| `options.match` | string | N | Regex filter for `list` file names |
| `options.encoding` | string | N | File encoding (`utf8`, `base64`, `binary`, `hex`, `ascii`) |
| `options.createDirs` | boolean | N | Create directories if missing |

Required fields by action:
- `get`, `delete`: requires `file`
- `post`, `put`: requires `file` + `data`
- `move`: requires `file` + `destination`
- `getAllInDir`: requires `destination`
- `list`: no additional required fields

#### Example

```jsonata
$integrate({
  "connectionName": "SFTP Server",
  "payload": [
    { "action": "list", "options": { "match": ".*\\.csv$" } },
    { "action": "get", "file": "/incoming/data.csv", "options": { "encoding": "utf8" } },
    { "action": "post", "file": "/outgoing/report.csv", "data": "col1,col2\nval1,val2" }
  ]
})
```

---

## Email

### SMTP

| | |
|---|---|
| UUID | `749e15c7-b1d6-4438-9466-7dfe27271573` |
| Auth | Username/Password |
| Credentials | `Username`, `Password` |
| Connection Options | `Secure` (boolean), `Port` (default 587), `Ignore TLS`, `Require TLS` |
| Endpoint URL | SMTP server hostname |

#### Payload Fields

Each item must include either `text` or `html`.

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `from` | string | Y | Sender email address |
| `to` | string | Y | Recipient email address(es) |
| `subject` | string | Y | Email subject |
| `text` | string | * | Plain text body (required if no `html`) |
| `html` | string | * | HTML body (required if no `text`) |
| `attachments` | array | N | File attachments |

Attachment item fields:

| Field | Type | Description |
|-------|------|-------------|
| `filename` | string | Attachment file name |
| `content` | string | Attachment content |
| `href` | string | URL to fetch attachment from |
| `httpHeaders` | object | Headers for fetching `href` |
| `contentType` | enum | `text/plain`, `application/pdf` |
| `contentDisposition` | string | Content disposition header |
| `cid` | string | Content ID for inline attachments |
| `encoding` | string | Content encoding |
| `headers` | object | Custom attachment headers |
| `raw` | string | Raw attachment data |

#### Example

```jsonata
$integrate({
  "connectionName": "Email Server",
  "payload": [
    {
      "from": "noreply@company.com",
      "to": "user@example.com",
      "subject": "Order Confirmation",
      "html": "<h1>Order Confirmed</h1><p>Your order has been placed.</p>",
      "attachments": [
        { "filename": "invoice.pdf", "href": "https://example.com/invoices/123.pdf" }
      ]
    }
  ]
})
```

---

## AI

### OpenAI Chat

| | |
|---|---|
| UUID | `e86501cd-80b4-46ea-97c8-33d31cfef632` |
| Auth | API Key |
| Credentials | `apiKey` |

Connection options are deep-merged with each request as defaults (useful for default system messages).

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `model` | string | Y | Model name (e.g. `gpt-4`, `gpt-3.5-turbo`) |
| `messages` | array | Y | Chat messages array |

Additional OpenAI API parameters (`temperature`, `max_tokens`, etc.) can be passed as extra properties -- they are forwarded directly.

Message roles:

| Role | Required Fields | Description |
|------|----------------|-------------|
| `system` / `user` | `content`, `role` | Content can be string or array of strings |
| `assistant` | `role` | Optional: `content`, `refusal`, `audio`, `tool_calls`, `name` |
| `tool` | `role`, `content`, `tool_call_id` | Tool response message |

Response: Array of OpenAI ChatCompletion response objects.

#### Example

```jsonata
$integrate({
  "connectionName": "OpenAI",
  "payload": [
    {
      "model": "gpt-4",
      "messages": [
        { "role": "system", "content": "You are a helpful assistant." },
        { "role": "user", "content": "Summarize this order data." }
      ],
      "temperature": 0.7,
      "max_tokens": 500
    }
  ]
})
```

---

## E-Commerce / Marketplace

### Amazon SP-API

| | |
|---|---|
| UUID | `085c0e1b-e0f2-47ae-a81f-1af51f90aeea` |
| Auth | AWS credentials + OAuth |
| Credentials | `SELLING_PARTNER_APP_CLIENT_ID`, `SELLING_PARTNER_APP_CLIENT_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SELLING_PARTNER_ROLE` |
| Connection Options | `region`, `refresh_token`, `access_token`, `use_sandbox`, etc. |

Three action modes for the Amazon Selling Partner API.

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | enum | Y | `callAPI`, `download`, `upload` |
| `data` | any | Y | Action-specific data |

Action-specific `data`:
- `callAPI`: Object with API call parameters
- `download`: `{ report_document: {}, options?: {} }`
- `upload`: `{ feed_upload_details: {}, feed: {} }`

Response: `{ Results: [], Errors: [] }` per item.

---

## Cloud Services

### AWS Lambda

| | |
|---|---|
| UUID | `37766115-8263-4d3c-bae1-984d97372221` |
| Auth | AWS credentials |
| Credentials | `accessKeyId`, `secretAccessKey`, `sessionToken` (optional) |

Execute AWS Lambda SDK commands.

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | string | Y | Lambda SDK command name (e.g. `InvokeCommand`, `ListFunctionsCommand`) |
| `region` | string | N | AWS region (default `us-east-1`) |
| `body` | object | N | Command input |

`body` for `InvokeCommand`:

| Field | Type | Description |
|-------|------|-------------|
| `FunctionName` | string | Lambda function name |
| `Payload` | any | Automatically JSON-stringified and encoded |
| `InvocationType` | string | `RequestResponse` (default), `Event`, `DryRun` |
| `LogType` | string | `None`, `Tail` |
| `Qualifier` | string | Function version/alias |

Response: `{ results, errors }` per item. `InvokeCommand` response `Payload` is decoded back to JSON.

#### Example

```jsonata
$integrate({
  "connectionName": "AWS Lambda",
  "payload": [
    {
      "action": "InvokeCommand",
      "region": "us-east-1",
      "body": {
        "FunctionName": "processOrder",
        "Payload": { "orderId": "12345" }
      }
    }
  ]
})
```

---

### Google API

| | |
|---|---|
| UUID | `2ab3d71a-2b81-4253-8428-8c359a26f082` |
| Auth | Service Account (JWT) |
| Credentials | `clientEmail`, `privateKey` |
| Connection Options | `scopes` (OAuth2 scopes array) |

Dynamic Google API client supporting Drive, BigQuery, and other Google APIs.

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `api` | string | Y | Google API name (e.g. `drive`, `bigquery`) |
| `resource` | string | Y | API resource (e.g. `files`, `datasets`) |
| `action` | string | Y | Resource action (e.g. `create`, `get`, `list`, `delete`) |
| `body` | object | N | Request body |
| `body.requestBody` | object | N | Request payload |
| `body.media` | object | N | File upload: `{ body: "base64string", mimeType: "..." }` |
| `body.resource` | object | N | Resource metadata |
| `options` | object | N | Additional request options |
| `version` | string | N | API version (e.g. `v3`, `v2`) |

Drive file uploads: When `api=drive`, `resource=files`, `action=create` with `body.media.body`, the base64 content is converted to a stream for upload.

Response: `{ results, errors }` per item.

#### Example

```jsonata
$integrate({
  "connectionName": "Google Drive",
  "payload": [
    {
      "api": "drive",
      "resource": "files",
      "action": "list",
      "version": "v3",
      "body": { "pageSize": 10 }
    }
  ]
})
```

---

## Shipping

### FedEx

| | |
|---|---|
| UUID | `d16be6b2-ad5e-4b32-8e54-03f168b947f4` |
| Auth | Multi-level keys (parent credentials, user credentials, client detail) |
| Credentials | `parentCredentials.key`, `parentCredentials.password`, `userCredentials.key`, `userCredentials.password`, `clientDetail.accountNumber`, `clientDetail.meterNumber`, `clientDetail.integratorId` |
| Connection Options | `transactionDetail`, `labelDefaults`, `shipper` (address/company info) |

XML SOAP connector for FedEx shipping APIs.

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | enum | Y | `Address Validation`, `Rates`, `Shipping Validation`, `Shipment Create`, `Shipment Delete`, `POST` |
| `data` | string or object | N | XML body or data object. For `POST`, raw data is sent as-is. |

All requests use `Content-Type: text/xml`. Responses are parsed from XML to JSON.

---

### UPS Legacy

| | |
|---|---|
| UUID | `920e8e71-1de6-4160-8129-f16612c0d694` |
| Auth | UserId/Password/License |
| Credentials | `UsernameToken.Username`, `UsernameToken.Password`, `TransactionSrc`, `ServiceAccessToken.AccessLicenseNumber` |
| Connection Options | `Shipping_Defaults` |

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | enum | Y | `GET`, `POST`, `DELETE`, `Address Validation`, `Create Shipment` |
| `path` | string | N | API path |
| `data` | object | N | Request body |
| `version` | enum | N | `v1` |

---

### Fuuz-UPS

| | |
|---|---|
| UUID | `906f591e-0cac-41f7-9fc3-bdbae5d6117a` |
| Auth | Server-managed (credentials from server config, not the connection) |
| Credentials | Optional `AccessLicenseNumber` override |

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | enum | Y | `GET`, `POST`, `DELETE`, `License Agreement`, `License Request` |
| `path` | string | N | API path |
| `data` | object | N | Request body |
| `version` | enum | N | `v1` |

---

### USPS

| | |
|---|---|
| UUID | `c1ce6d2d-0e76-4683-9b06-00812f5514f4` |
| Auth | UserId |
| Credentials | `UserId` |

XML-based USPS postal API.

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | enum | Y | `POST` |
| `path` | string | N | URL path |
| `api` | string | N | USPS API name (sent as `API` query parameter) |
| `data` | string or object | N | XML data. Must contain `USERID=''` attribute -- the connector fills it in. |

Note: Data is sent as a URL query parameter (`XML=...`), not in the request body. Responses are parsed from XML to JSON.

---

## ERP / SOAP

### NetSuite SOAP

| | |
|---|---|
| UUID | `3c94fb0e-0767-11ec-9a03-0242ac130003` |
| Auth | OAuth1 Token-Based Auth |
| Credentials | `account`, `consumerKey`, `consumerSecret`, `tokenId`, `tokenSecret` |
| Connection Options | `endpointVersion` |

SOAP connector with 40+ actions for NetSuite.

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | enum | Y | SOAP action (see list below) |
| `requestBody` | string | Y | XML body content |
| `options.returnXML` | boolean | N | When `true`, return raw XML instead of parsed JSON |

Available actions: `add`, `delete`, `search`, `searchMore`, `searchMoreWithId`, `searchNext`, `update`, `upsert`, `addList`, `deleteList`, `updateList`, `upsertList`, `get`, `getList`, `getAll`, `getSavedSearch`, `getCustomizationId`, `initialize`, `initializeList`, `getSelectValue`, `getItemAvailability`, `getBudgetExchangeRate`, `getCurrencyRate`, `getDataCenterUrls`, `getPostingTransactionSummary`, `getServerTime`, `attach`, `detach`, `updateInviteeStatus`, `updateInviteeStatusList`, `asyncAddList`, `asyncUpdateList`, `asyncUpsertList`, `asyncDeleteList`, `asyncGetList`, `asyncInitializeList`, `asyncSearch`, `getAsyncResult`, `checkAsyncStatus`, `getDeleted`, `loginasd`, `ssoLogin`, `mapSso`, `changePassword`, `changeEmail`, `logout`

Response: `{ data: { headers, body }, error }` per item. When `returnXML: true`, `data` is raw XML string.

#### Example

```jsonata
$integrate({
  "connectionName": "NetSuite SOAP",
  "payload": [
    {
      "action": "search",
      "requestBody": "<ns:TransactionSearchBasic><ns:type operator='anyOf'><ns:searchValue>salesOrder</ns:searchValue></ns:type></ns:TransactionSearchBasic>"
    }
  ]
})
```

---

## EDI

### EDI Nation

| | |
|---|---|
| UUID | `01ebf215-8d6a-4516-a058-16cc40a25773` |
| Auth | API Key |
| Credentials | `accessToken` (API key) |
| Endpoint URL | EDI Nation API URL |

EDI read/write/validate/acknowledge operations.

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | enum | Y | `read`, `write`, `ack`, `validate` |
| `format` | enum | Y | `x12`, `edifact` |
| `data` | varies | Y | For `read`: `{ fileContents, fileName? }`. For others: EDI data object. |
| `options.apiOptions` | object | N | Additional API options |

---

## TecCom

### TecCom File Upload

| | |
|---|---|
| UUID | `e2c23250-2da3-41af-8ea5-abe14a4aa77c` |
| Auth | OAuth2 client credentials |
| Credentials | `clientId`, `clientSecret` |
| Connection Options | `buyerGLN`, `supplierGLN` |

Converts JSON data to CSV, zips it, and uploads to TecCom.

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `requestMode` | enum | Y | `REPLACE`, `MODIFY` |
| `files` | array | Y | Files to upload |

File item:

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `fileName` | enum | Y | One of: `article`, `assortment`, `article_data`, `sales_uom`, `buyer_grouping`, `availability`, `article_description`, `article_buyer`, `alternative`, `condition_group`, `price`, `alc`, `packaging`, `external_document` |
| `data` | array | Y | Array of row objects to convert to CSV |

---

### TecCom Web Services

| | |
|---|---|
| UUID | `395ab4e2-2ef4-471c-ad42-5fdad7f22d6f` |
| Auth | OAuth2 client credentials |
| Credentials | `clientId`, `clientSecret` |
| Connection Options | `buyerGLN`, `supplierGLN` |

SOAP web service calls to TecCom.

#### Payload Fields

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `functionId` | string | Y | Web service function ID |
| `parameters` | object | Y | Function parameters (each key-value becomes a SOAP parameter) |

Response: `{ Timestamp, Reference, OriginatingFunction, Status }` per item.

---

## Multi-Action Platforms

### Fuuz

| | |
|---|---|
| UUID | `43b90e5f-48a5-437c-b968-6f35a1663257` |
| Auth | JWT API Key (decoded to extract URL and username) |
| Credentials | `ApiKey` (JWT) |

Multi-action connector for external Fuuz instances. Max 100 items per request.

#### Actions

**`query` -- Execute GraphQL query:**

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | | Y | `query` |
| `query` | string | Y | GraphQL query |
| `api` | enum | Y | `application`, `system` |
| `variables` | object | N | Query variables |

**`mutation` -- Execute GraphQL mutation:**

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | | Y | `mutation` |
| `mutation` | string | Y | GraphQL mutation |
| `api` | enum | Y | `application`, `system` |
| `variables` | object | N | Mutation variables |

**`flow` -- Execute a data flow:**

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | | Y | `flow` |
| `flowId` | string | Y | Flow ID to execute |
| `payload` | object | N | Flow payload |

**`savedQuery` -- Execute a saved query:**

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | | Y | `savedQuery` |
| `savedQueryId` | string | Y | Saved query ID |
| `variables` | object | N | Query variables |

**`savedScript` -- Execute a saved script:**

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | | Y | `savedScript` |
| `savedScriptId` | string | Y | Saved script ID |
| `payload` | object | N | Script payload |

**`publish` -- Publish to a topic:**

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `action` | | Y | `publish` |
| `topicName` | string | Y | Topic name |
| `topicMessages` | array | Y | Messages: `[{ value: any }]` |

#### Example

```jsonata
$integrate({
  "connectionName": "External Fuuz",
  "options": { "degreeOfParallelism": 5 },
  "payload": [
    {
      "action": "query",
      "api": "application",
      "query": "{ orders(filter: { status: \"open\" }) { id, orderNumber, total } }"
    },
    {
      "action": "flow",
      "flowId": "abc-123-def",
      "payload": { "orderId": "12345" }
    }
  ]
})
```
