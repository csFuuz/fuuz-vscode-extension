---
name: fuuz-integration
description: Configure and use Fuuz integration connectors. Use when the user needs to connect to external systems, configure REST APIs, databases, FTP, Plex, or other third-party services using the $integrate() function or integration nodes in data flows.
---

# Integration Service

The integration service routes payloads to connectors, validates schemas, and executes external API calls. There are 42 connectors organized into four groups: REST (21), Database (2), Plex (4), and Specialized (15).

---

## How Integration Works

All integrations are invoked through the `$integrate()` function, which posts a payload to a named connection and returns the response body. Each item in the payload array becomes one request, and results are returned as an array in the same order.

```jsonata
$integrate({
  "connectionName": "My HTTP Connection",
  "options": {
    "degreeOfParallelism": 10,
    "returnErrors": true
  },
  "payload": [
    { "method": "get", "path": "/api/users" }
  ]
})
```

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `connectionName` | string | Y | Name of the configured connection |
| `options.degreeOfParallelism` | integer | N | Concurrent requests. Default 10. |
| `options.returnErrors` | boolean | N | When `true`, failed requests return error objects instead of aborting. Default `false`. |
| `payload` | array | Y | Array of request items (shape depends on connector) |

The `payload` array is validated against the connector's inbound JSON schema before execution.

---

## Execution Context

Integration connections are defined per-tenant. Each connection specifies:

- **Connector type** -- determines the UUID and which connector module handles the request
- **Endpoint URL** -- the base URL for the external system
- **Credentials** -- authentication details (varies per connector type)
- **Connection options** -- connector-specific configuration (default headers, timeouts, etc.)

The `connectionName` in your `$integrate()` call references a configured connection by name. Authentication is handled automatically by the connection -- you do not pass credentials in the payload.

---

## Standard REST Pattern

21 connectors share a common REST inbound shape. Each payload item contains:

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `method` | enum | Y | HTTP method (varies per connector -- lowercase or UPPERCASE) |
| `path` | string | Y | API endpoint path (some use `endpoint` or `action` instead) |
| `data` or `body` | varies | N | Request body (some accept object only, others accept any JSON type) |
| `headers` | object | N | Custom headers (not all connectors support this) |
| `params` | object | N | Query string parameters (not all connectors support this) |

Per-connector variations are documented in [connectors-rest.md](connectors-rest.md).

---

## Authentication Patterns

Connections handle authentication automatically. The 11 authentication patterns are:

| Pattern | Example Connectors | Description |
|---------|-------------------|-------------|
| Basic Auth | HTTP, Confluence, Infor, Magento | Username + Password sent as Basic header |
| OAuth2 Client Credentials | Dynamics 365, CH Robinson, Plex IAM, UPS OAuth | clientId + clientSecret, token cached with TTL |
| OAuth2 Refresh Token | QuickBooks, Zoho, ChannelAdvisor | Refresh token grant, some rotate tokens |
| OAuth2 Password Grant | Salesforce | Username + Password + clientId + clientSecret |
| OAuth1 TBA | NetSuite REST | Token-Based Auth with consumer/token key pairs |
| SAML 2.0 Bearer | SuccessFactors | SAML assertion signed with private key |
| API Key | SAP Cloud, Spiro, Clover, OpenAI | Static key in header |
| Mutual TLS | ADP, ADP Vista | Client certificate + key for mTLS |
| Session Token | Arena | Login with email/password, session cookie |
| Service Account | Google API | JWT signed with service account key |
| AWS Credentials | Amazon SP-API, AWS Lambda | Access key + secret + optional role ARN |

---

## Connector Groups Overview

### REST Connectors (21)

Standard method + path + body pattern with per-connector variations in field names, method casing, body types, and extra fields.

| Sub-Pattern | Connectors |
|-------------|-----------|
| Minimal REST | HTTP, Confluence, Arena, Infor, ChannelAdvisor, CH Robinson |
| Uppercase Methods | Dynamics 365, SuccessFactors, WooCommerce |
| Extended Methods | Salesforce, QuickBooks, Square |
| Pagination/Filter | Magento, Zoho CRM, Spiro, SAP Cloud, Clover |
| Different Field Names | NetSuite REST, UPS OAuth |
| Mutual TLS | ADP, ADP Vista |

See [connectors-rest.md](connectors-rest.md) for full details.

### Database Connectors (2)

| Connector | Description |
|-----------|-------------|
| MSSQL | Typed parameters, stored procedures, connection pooling, retry |
| ODBC | Worker pool, supports Plex and NetSuite drivers |

See [connectors-database.md](connectors-database.md) for full details.

### Plex Connectors (4)

| Connector | Description |
|-----------|-------------|
| Plex Classic SOAP | Execute datasources via SOAP XML |
| Plex UX | Execute datasources via JSON REST API |
| Plex API | Generic REST for Plex Connect APIs |
| Plex IAM API | REST for Plex Identity & Access Management |

See [connectors-plex.md](connectors-plex.md) for full details.

### Specialized Connectors (15)

| Category | Connectors |
|----------|-----------|
| File Transfer | FTP/SFTP |
| Email | SMTP |
| AI | OpenAI Chat |
| E-Commerce | Amazon SP-API |
| Cloud | AWS Lambda, Google API |
| Shipping | FedEx, UPS Legacy, Fuuz-UPS, USPS |
| ERP/SOAP | NetSuite SOAP |
| EDI | EDI Nation |
| TecCom | File Upload, Web Services |
| Multi-Action | Fuuz |

See [connectors-specialized.md](connectors-specialized.md) for full details.

---

## Common Usage

### $integrate() in JSONata

Used in data flow transform nodes:

```jsonata
(
  $result := $integrate({
    "connectionName": "My Salesforce",
    "payload": [
      {
        "method": "get",
        "path": "/services/data/v58.0/query",
        "params": { "q": "SELECT Id, Name FROM Account LIMIT 10" }
      }
    ]
  });
  $result[0].data
)
```

### $integrate() in JavaScript

Used in script nodes within data flows:

```javascript
const result = await $integrate({
  connectionName: "My MSSQL DB",
  payload: [
    {
      query: "SELECT * FROM Orders WHERE Status = @Status",
      parameters: [
        { name: "Status", dataType: "NVarChar", length: 50, value: "Active" }
      ]
    }
  ]
});
return result[0].resultSets[0];
```

### Integration Nodes in Data Flows

Integration nodes in the data flow designer call `$integrate()` behind the scenes. Configure:

1. Select the connection name from the dropdown
2. Build the payload using the node's form fields or a JSONata expression
3. Map the response into downstream nodes

---

## Connector Quick Reference

| Connector | UUID | Group | Auth |
|-----------|------|-------|------|
| HTTP | `05e0b880-7b0d-4ca1-9b8f-30126ffd305a` | REST | Basic |
| Confluence | `d7ca2d1a-cc71-47fb-8b26-d316bfaedaf9` | REST | Basic |
| Salesforce | `44ff6253-ca43-4429-955a-2907803178b8` | REST | OAuth2 Password |
| Dynamics 365 | `808fce4c-6e38-4db8-b4b4-5c45a5a6f1cb` | REST | OAuth2 Client Cred |
| QuickBooks | `88c548f7-4944-4eed-a948-9ce683e02a6f` | REST | OAuth2 Refresh |
| Zoho | `4ff8769a-bdea-11e8-a355-529269fb1459` | REST | OAuth2 Refresh |
| SAP Cloud | `34e36d24-64f3-4d59-a764-bab5b851f72d` | REST | API Key |
| Infor | `07ba704-0eef-11eb-adc1-0242ac120002` | REST | OAuth2 Password |
| SuccessFactors | `165219c4-830b-49af-828f-7964d4e4bd08` | REST | SAML 2.0 |
| Spiro | `fa98a8d9-74f3-4ce1-8ef9-4455c31d3ce4` | REST | API Key |
| ADP | `6a6da1f8-b69c-11e8-96f8-529269fb1459` | REST | Mutual TLS |
| ADP Vista | `5b2ed01a-628e-413e-8baf-f6d4c01fb53b` | REST | Mutual TLS + OAuth2 |
| Magento | `3d3b20ea-f261-40c1-9094-a556e60ce5e9` | REST | Token Auth |
| WooCommerce | `09fb753b-6b94-48b6-b70e-31ce7acdddac` | REST | Basic |
| NetSuite REST | `ac61106b-72c6-4fca-8bc7-0ba3d54fb574` | REST | OAuth1 TBA |
| Arena | `c6a47b3d-5740-4cec-a9d1-dfba96249d03` | REST | Session Token |
| ChannelAdvisor | `1bbd8c15-601e-43f5-b584-e898ba58bfd2` | REST | OAuth2 Refresh |
| CH Robinson | `3c751b02-b23c-4615-9eba-c7a5dc33c507` | REST | OAuth2 Client Cred |
| Clover | `2d259032-b9ea-4904-afbf-d30d4fc142a9` | REST | API Key |
| Square | `c125d58f-41f5-41f5-b42e-3a63e3441526` | REST | API Key |
| UPS OAuth | `c13ebe14-08f3-4c6a-bb1d-c717d8430ab9` | REST | OAuth2 Client Cred |
| Plex Classic SOAP | `464e9c3f-dd6c-47af-8078-cda1ff25e966` | Plex | Basic |
| Plex UX | `72974b11-897f-47bd-896d-133962ef7bbb` | Plex | Basic |
| Plex API | `1cc8888c-bc12-4545-b354-d26f9493f0ac` | Plex | API Key |
| Plex IAM API | `9db652bf-9f99-472e-ada2-71f8e92f973f` | Plex | OAuth2 Client Cred |
| MSSQL | `bb612514-2129-4fa9-849d-f9f8f6ec1c8e` | Database | Connection String |
| ODBC | `914c3b05-7d13-4fd2-a0f8-fe925e67f066` | Database | Driver-specific |
| FTP/SFTP | `396f9092-0c1e-4b3b-ac6d-760094c9466c` | Specialized | Username/Password |
| SMTP | `749e15c7-b1d6-4438-9466-7dfe27271573` | Specialized | Username/Password |
| OpenAI Chat | `e86501cd-80b4-46ea-97c8-33d31cfef632` | Specialized | API Key |
| Amazon SP-API | `085c0e1b-e0f2-47ae-a81f-1af51f90aeea` | Specialized | AWS + OAuth |
| AWS Lambda | `37766115-8263-4d3c-bae1-984d97372221` | Specialized | AWS Credentials |
| Google API | `2ab3d71a-2b81-4253-8428-8c359a26f082` | Specialized | Service Account |
| FedEx | `d16be6b2-ad5e-4b32-8e54-03f168b947f4` | Specialized | Multi-level Keys |
| UPS Legacy | `920e8e71-1de6-4160-8129-f16612c0d694` | Specialized | UserId/Password |
| USPS | `c1ce6d2d-0e76-4683-9b06-00812f5514f4` | Specialized | UserId |
| NetSuite SOAP | `3c94fb0e-0767-11ec-9a03-0242ac130003` | Specialized | OAuth1 TBA |
| EDI Nation | `01ebf215-8d6a-4516-a058-16cc40a25773` | Specialized | API Key |
| TecCom File Upload | `e2c23250-2da3-41af-8ea5-abe14a4aa77c` | Specialized | OAuth2 Client Cred |
| TecCom Web Services | `395ab4e2-2ef4-471c-ad42-5fdad7f22d6f` | Specialized | OAuth2 Client Cred |
| Fuuz | `43b90e5f-48a5-437c-b968-6f35a1663257` | Specialized | JWT API Key |
| Fuuz-UPS | `906f591e-0cac-41f7-9fc3-bdbae5d6117a` | Specialized | Server-managed |

---

## Reference Files

| File | Contents |
|------|----------|
| [connectors-rest.md](connectors-rest.md) | 21 REST-pattern connectors with field details |
| [connectors-plex.md](connectors-plex.md) | 4 Plex Manufacturing Cloud connectors |
| [connectors-database.md](connectors-database.md) | MSSQL and ODBC database connectors |
| [connectors-specialized.md](connectors-specialized.md) | 15 connectors with unique schemas |
