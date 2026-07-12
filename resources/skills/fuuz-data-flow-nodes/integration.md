# Integration

Nodes for connecting to external systems and services. Most integration nodes share common properties: `connectionName` (or `connectionNameTransform`) to select a configured connection, `returnErrors` to handle failures gracefully, and `degreeOfParallelism` for batch requests. See [SKILL.md](./SKILL.md) for details on these shared patterns.

---

## HTTP Request

| | |
|---|---|
| **Name** | `http` |
| **Title** | HTTP |
| **Responsibility** | transition |
| **Description** | Makes an HTTP request to an external service. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The HTTP connection to use. |
| `httpMethod` | string | -- | Yes | HTTP method. Options: `get`, `put`, `post`, `delete`. |
| `httpPathTransform` | string | jsonata | Yes | The HTTP path to request. |
| `httpHeadersTransform` | string | jsonata | No | Transform producing HTTP headers. |
| `httpDataTransform` | string | jsonata | No | Transform producing the request body. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload instead of aborting. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

### Example Configuration

```json
{
  "connectionName": "myApiConnection",
  "httpMethod": "post",
  "httpPathTransform": "'/api/orders/' & orderId",
  "httpDataTransform": "{ \"status\": \"shipped\" }",
  "returnErrors": true
}
```

---

## Integrate

| | |
|---|---|
| **Name** | `integrateV2` |
| **Title** | Integrate |
| **Responsibility** | transition |
| **Description** | General-purpose integration node for external systems. Accepts a single payload or an array of payloads for batch requests. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | Yes | The integration connection to use. |
| `requestTransform` | string | jsonata | Yes | Transform to populate the request. Default: `"$"`. |
| `responseTransform` | string | jsonata | Yes | Transform to reformat the response. Default: `"$"`. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload instead of aborting. Default: `false`. |
| `degreeOfParallelism` | integer | -- | Yes | Parallel requests for array payloads. Default: `10`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## SQL Server (Execute SQL)

| | |
|---|---|
| **Name** | `mssql` |
| **Title** | SQL Server |
| **Responsibility** | transition |
| **Description** | Interacts with Microsoft SQL Server. Supports queries and stored procedures with typed parameters. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The ODBC connection to use. |
| `query` | string | -- | Yes | The SQL query to execute. Default: `""`. |
| `parameters` | array | -- | No | Parameters to pass to the query. See sub-table. |
| `procedure` | boolean | -- | Yes | Whether executing a stored procedure. Default: `false`. |
| `maxRetries` | integer | -- | Yes | Max retries for unsuccessful requests. Default: `0`. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload instead of aborting. Default: `false`. |

**Parameter items:**

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `name` | string | -- | Yes | Parameter name. |
| `dataType` | string | -- | Yes | SQL data type. Options: `BigInt`, `Bit`, `Char`, `Date`, `DateTime`, `DateTime2`, `DateTimeOffset`, `Decimal`, `Float`, `Int`, `Money`, `NChar`, `NText`, `NVarChar`, `Numeric`, `Real`, `SmallDateTime`, `SmallInt`, `SmallMoney`, `Text`, `Time`, `TinyInt`, `UniqueIdentifier`, `VarChar`, `Xml`. |
| `valueTransform` | string | jsonata | No | JSONata transform for the parameter value. |
| `length` | integer | -- | No | Data type length. |
| `scale` | integer | -- | No | Data type scale. |
| `precision` | integer | -- | No | Data type precision. |
| `output` | boolean | -- | No | Whether this is an output parameter. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## ODBC (ODBC Data Source)

| | |
|---|---|
| **Name** | `odbcV2` |
| **Title** | ODBC |
| **Responsibility** | transition |
| **Description** | Executes an ODBC query against any ODBC-compatible data source. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | Yes | The ODBC connection to use. |
| `query` | string | -- | Yes | The SQL query to execute. Default: `""`. |
| `variableTransform` | string | jsonata | No | Transform producing an array of bind values. Default: `"[]"`. |
| `maxRetries` | integer | -- | Yes | Max retries. Default: `0`. |
| `responseTransform` | string | jsonata | Yes | Transform to reformat the response. Default: `"$"`. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload instead of aborting. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## FTP

| | |
|---|---|
| **Name** | `ftp` |
| **Title** | FTP |
| **Responsibility** | transition |
| **Description** | Makes FTP requests. Supports get, post, delete, move, and list actions. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The FTP connection to use. |
| `ftpAction` | string | -- | Yes | FTP action. Options: `get`, `post`, `delete`, `move`, `list`. |
| `ftpFileTransform` | string | jsonata | No | Filename for get/move/delete/post actions. |
| `ftpDestinationTransform` | string | jsonata | No | Destination folder for move/list actions. |
| `ftpDataTransform` | string | jsonata | No | Data to post. Visible for post action. |
| `ftpMatch` | string | -- | No | Regex to filter listed filenames. Visible for list action. |
| `ftpFirst` | number | -- | No | Return only the first N files from a list. |
| `ftpLast` | number | -- | No | Return only the last N files from a list. |
| `encoding` | string | -- | No | File encoding. Options: `utf8`, `base64`, `binary`, `hex`, `ascii`. Default: `utf8`. Use `base64` for PDF files. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload instead of aborting. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## Email (SMTP)

| | |
|---|---|
| **Name** | `email` |
| **Title** | Email |
| **Responsibility** | transition |
| **Description** | Sends email via SMTP. Address formats: plain (`sender@server.com`), formatted (`"Name" <sender@server.com>`), or object with `name` and `address`. Lists can be comma-separated strings or arrays. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The SMTP connection to use. |
| `emailFromTransform` | string | jsonata | Yes | Sender address. Must typically match the connection account. |
| `emailToTransform` | string | jsonata | Yes | Recipient addresses. |
| `emailSubjectTransform` | string | jsonata | Yes | Email subject. |
| `emailHtmlTransform` | string | jsonata | Yes | HTML body. |
| `emailAttachments` | array | -- | No | Attachments. See sub-table. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload instead of aborting. Default: `false`. |

**Attachment items:**

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `attachmentFilenameTransform` | string | jsonata | Yes | Filename. |
| `attachmentContentTransform` | string | jsonata | Yes | Content of the attachment. |
| `attachmentEncoding` | string | -- | No | Encoding. Options: `ascii`, `utf8`, `base64`, `hex`, `binary`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## Fuuz (External Fuuz API)

| | |
|---|---|
| **Name** | `fuuz` |
| **Title** | Fuuz |
| **Responsibility** | transition |
| **Description** | Makes requests to an external Fuuz API. Supports GraphQL queries/mutations, topic publishing, flow execution, saved queries, and saved scripts. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | jsonata | Yes | The Fuuz connection to use. |
| `action` | string | jsonata | Yes | Request type. Options: `query`, `mutation`, `publish`, `flow`, `savedQuery`, `savedScript`. |
| `api` | string | -- | No | Fuuz API. Options: `application`, `system`. Default: `"application"`. Visible for query/mutation. |
| `query` | string | graphql | No | GraphQL query. Visible for query action. |
| `mutation` | string | graphql | No | GraphQL mutation. Visible for mutation action. |
| `savedQueryId` | string | jsonata | No | Saved query ID. Visible for savedQuery action. |
| `variables` | string | jsonata | No | Variables for query/mutation/savedQuery. Default: `"{}"`. |
| `savedScriptId` | string | jsonata | No | Saved script ID. Visible for savedScript action. |
| `flowId` | string | jsonata | No | Flow ID. Visible for flow action. |
| `topicName` | string | jsonata | No | Topic name. Visible for publish action. |
| `payloadTransform` | string | jsonata | No | Payload for flow/savedScript. Default: `"{}"`. |
| `topicMessages` | string | jsonata | No | Array of messages for publish. Default: `"[]"`. |
| `responseTransform` | string | jsonata | Yes | Transform to reformat the response. Default: `"$"`. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload instead of aborting. Default: `false`. |
| `degreeOfParallelism` | integer | -- | Yes | Parallel requests for array payloads. Default: `10`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## ADP

| | |
|---|---|
| **Name** | `adp` |
| **Title** | ADP |
| **Responsibility** | transition |
| **Description** | Makes ADP API requests. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The ADP connection. |
| `method` | string | -- | Yes | HTTP method. Options: `get`, `put`, `post`, `delete`. |
| `pathTransform` | string | jsonata | Yes | The request path. |
| `paramsTransform` | string | jsonata | No | URL parameters. |
| `dataTransform` | string | jsonata | No | Request body. |
| `masked` | boolean | -- | No | Mask sensitive data in responses. Default: `true`. |
| `roleCode` | string | -- | No | ADP role code. Options: `employee`, `manager`, `practitioner`, `administrator`, `supervisor`. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## ADP Vista

| | |
|---|---|
| **Name** | `adpVista` |
| **Title** | ADP Vista |
| **Responsibility** | transition |
| **Description** | Makes requests to the ADP Vista API. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | No | The ADP Vista connection. |
| `path` | string | jsonata | Yes | API endpoint path. |
| `method` | string | jsonata | Yes | HTTP method. Options: `POST`, `GET`. |
| `dataTransform` | string | jsonata | Yes | Request body. |
| `responseTransform` | string | jsonata | No | Transform to reformat the response. Default: `"$"`. |
| `returnErrors` | boolean | -- | No | Return errors as payload. Default: `false`. |

Standard output port.

---

## Amazon

| | |
|---|---|
| **Name** | `amazon` |
| **Title** | Amazon |
| **Responsibility** | transition |
| **Description** | Makes requests to the Amazon Selling Partner API. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The Amazon connection. |
| `amazonAction` | string | -- | Yes | Action. Options: `callAPI`, `download`, `upload`. |
| `amazonAPITransform` | string | jsonata | No | Data for the API call. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## AWS Lambda

| | |
|---|---|
| **Name** | `awsLambda` |
| **Title** | AWS Lambda |
| **Responsibility** | transition |
| **Description** | Interacts with AWS Lambda functions. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | Yes | The AWS Lambda connection. |
| `lambdaAction` | string | jsonata | Yes | Command. Options: `InvokeCommand`, `ListFunctionsCommand`. |
| `regionTransform` | string | jsonata | No | AWS region. Default: `"us-east-1"`. |
| `functionNameTransform` | string | jsonata | No | Lambda function name. Visible for InvokeCommand. |
| `bodyTransform` | string | jsonata | No | Request body. Default: `"$"`. |
| `responseTransform` | string | jsonata | No | Transform response. Default: `"$"`. |
| `returnErrors` | boolean | -- | No | Return errors as payload. Default: `false`. |
| `degreeOfParallelism` | integer | -- | No | Parallel requests. Default: `10`. |

Standard output port.

---

## Google BigQuery

| | |
|---|---|
| **Name** | `googleBigQuery` |
| **Title** | Google BigQuery API |
| **Responsibility** | transition |
| **Description** | Makes requests to Google BigQuery. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | Yes | The Google connection. |
| `clientVersion` | string | jsonata | Yes | API version. Options: `v2`. |
| `clientAPIResource` | string | jsonata | Yes | API resource. Options: `datasets`, `jobs`, `models`, `projects`, `routines`, `rowAccessPolicies`, `tabledata`, `tables`. |
| `clientAPIAction` | string | jsonata | Yes | API action. Available actions vary by resource. |
| `projectIdTransform` | string | jsonata | No | Google Cloud project ID. |
| `datasetIdTransform` | string | jsonata | No | Dataset ID. |
| `jobIdTransform` | string | jsonata | No | BigQuery job ID. |
| `modelIdTransform` | string | jsonata | No | BigQuery ML model ID. |
| `routineIdTransform` | string | jsonata | No | Routine ID. |
| `tableIdTransform` | string | jsonata | No | Table ID. |
| `resourceTransform` | string | jsonata | No | Full resource identifier for IAM policy actions. |
| `bodyTransform` | string | jsonata | No | Request body. Expects `{ "requestBody": { ... } }`. Default: `"$"`. |
| `optionsTransform` | string | jsonata | No | Optional parameters. Default: `"{}"`. |
| `responseTransform` | string | jsonata | No | Transform response. Default: `"$"`. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload. Default: `false`. |
| `degreeOfParallelism` | integer | -- | Yes | Parallel requests. Default: `10`. |

Standard output port.

---

## Google Drive

| | |
|---|---|
| **Name** | `googleDrive` |
| **Title** | Google Drive API |
| **Responsibility** | transition |
| **Description** | Makes requests to the Google Drive API. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | Yes | The Google connection. |
| `clientVersionTransform` | string | -- | Yes | API version. Options: `v2`, `v3`. |
| `clientAPIResourceTransform` | string | -- | Yes | API resource. Options: `about`, `changes`, `channels`, `comments`, `drives`, `files`, `permissions`, `replies`, `revisions`. |
| `clientAPIActionTransform` | string | -- | Yes | API action. Options vary by resource (create, get, update, delete, copy, list, etc.). |
| `bodyTransform` | string | jsonata | No | Request body. Default: `"$"`. |
| `optionsTransform` | string | jsonata | No | Optional parameters. Default: `"{}"`. |
| `responseTransform` | string | jsonata | No | Transform response. Default: `"$"`. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload. Default: `false`. |
| `degreeOfParallelism` | integer | -- | Yes | Parallel requests. Default: `10`. |

Standard output port.

---

## Infor

| | |
|---|---|
| **Name** | `infor` |
| **Title** | Infor |
| **Responsibility** | transition |
| **Description** | Makes requests to the Infor (REST) API. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The Infor connection. |
| `path` | string | jsonata | Yes | API endpoint path. |
| `method` | string | -- | Yes | HTTP method. Options: `post`, `get`, `put`, `delete`. |
| `dataTransform` | string | jsonata | No | Request body. |
| `returnErrors` | boolean | -- | No | Return errors as payload. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## Magento

| | |
|---|---|
| **Name** | `magento` |
| **Title** | Magento |
| **Responsibility** | transition |
| **Description** | Makes requests to the Magento (REST) API. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The Magento connection. |
| `path` | string | jsonata | Yes | API endpoint path. |
| `method` | string | -- | Yes | HTTP method. Options: `post`, `get`, `put`, `delete`. |
| `filtersTransform` | string | jsonata | No | Request filters. |
| `dataTransform` | string | jsonata | No | Request body. |
| `returnErrors` | boolean | -- | No | Return errors as payload. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## Netsuite REST

| | |
|---|---|
| **Name** | `netsuiteRest` |
| **Title** | Netsuite REST |
| **Responsibility** | transition |
| **Description** | Makes requests to the Netsuite REST API. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | Yes | The Netsuite REST connection. |
| `netsuiteEndpoint` | string | -- | No | The Netsuite path to query. |
| `netsuiteRestAction` | string | -- | Yes | HTTP action. Options: `GET`, `POST`, `PATCH`, `PUT`, `DELETE`. |
| `headers` | string | jsonata | No | Request headers. |
| `netsuiteRestParameters` | string | jsonata | No | Additional request parameters. |
| `netsuiteRestBody` | string | jsonata | No | Request body. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## Netsuite SOAP

| | |
|---|---|
| **Name** | `netsuiteSoap` |
| **Title** | Netsuite SOAP |
| **Responsibility** | transition |
| **Description** | Makes requests to the Netsuite SOAP API. Supports a wide range of SOAP actions. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The Netsuite SOAP connection. |
| `netsuiteSoapAction` | string | -- | Yes | SOAP action. Extensive list including: `login`, `add`, `delete`, `search`, `update`, `upsert`, `get`, `getAll`, `getSavedSearch`, and many more. |
| `netsuiteSoapTransform` | string | jsonata | Yes | SOAP XML body. |
| `returnXML` | boolean | -- | Yes | When true, responses are returned as XML. Default: `false`. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## OpenAI Chat

| | |
|---|---|
| **Name** | `openaiChat` |
| **Title** | OpenAI Chat |
| **Responsibility** | transition |
| **Description** | Interacts with OpenAI Chat GPT models. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | No | The OpenAI connection. |
| `model` | string | -- | Yes | The model to use (refer to OpenAI documentation). |
| `messages` | string | jsonata | Yes | Transform producing the messages array for chat completions. |
| `additionalOptions` | string | jsonata | No | Additional options for the operation. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## Plex API

| | |
|---|---|
| **Name** | `plexApi` |
| **Title** | Plex API |
| **Responsibility** | transition |
| **Description** | Makes Plex API requests. Supports both Plex API and Plex IAM API connections. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The Plex API or Plex IAM API connection. |
| `method` | string | -- | Yes | HTTP method. Options: `get`, `put`, `post`, `patch`, `delete`. |
| `pathTransform` | string | jsonata | Yes | Request path. |
| `paramsTransform` | string | jsonata | No | URL parameters. |
| `bodyTransform` | string | jsonata | No | Request body. |
| `tenantIdTransform` | string | jsonata | No | Tenant ID (does nothing for Plex IAM API). |
| `returnErrors` | boolean | -- | Yes | Return errors as payload. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## Plex Datasource

| | |
|---|---|
| **Name** | `plexDatasourceV2` |
| **Title** | Plex Datasource |
| **Responsibility** | transition |
| **Description** | Calls a Plex datasource. Supports Plex and Plex UX connections. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | Yes | The Plex integration connection. |
| `datasourceKey` | string | -- | Yes | The datasource key to execute. |
| `parameterTransform` | string | jsonata | Yes | Parameters for the datasource. Keys should match datasource parameter names. Default: `"{}"`. |
| `responseTransform` | string | jsonata | Yes | Transform to reformat the response. Default: `"$"`. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload. Default: `false`. |
| `degreeOfParallelism` | integer | -- | Yes | Parallel requests. Default: `10`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## Quickbooks

| | |
|---|---|
| **Name** | `quickbooks` |
| **Title** | Quickbooks |
| **Responsibility** | transition |
| **Description** | Makes Quickbooks API requests. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The Quickbooks connection. |
| `method` | string | -- | Yes | HTTP method. Options: `get`, `put`, `post`, `patch`, `delete`. |
| `headersTransform` | string | jsonata | No | HTTP headers. |
| `pathTransform` | string | jsonata | Yes | Request path. |
| `paramsTransform` | string | jsonata | No | URL parameters. |
| `bodyTransform` | string | jsonata | No | Request body. |
| `returnErrors` | boolean | -- | Yes | Return errors as payload. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## Salesforce

| | |
|---|---|
| **Name** | `salesforce` |
| **Title** | Salesforce |
| **Responsibility** | transition |
| **Description** | Makes requests to the Salesforce REST API. Supports automatic pagination. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The Salesforce connection. |
| `path` | string | jsonata | Yes | API endpoint path. |
| `method` | string | -- | Yes | HTTP method. Options: `post`, `get`, `put`, `delete`, `patch`, `head`. |
| `dataTransform` | string | jsonata | No | Request body. |
| `paramsTransform` | string | jsonata | No | Request parameters. |
| `returnErrors` | boolean | -- | No | Return errors as payload. Default: `false`. |
| `pagination` | boolean | -- | No | Automatically retrieve and merge paginated results. Default: `false`. |
| `degreeOfParallelism` | integer | -- | No | Parallel requests. Default: `10`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## Success Factors

| | |
|---|---|
| **Name** | `successFactors` |
| **Title** | Success Factors |
| **Responsibility** | transition |
| **Description** | Makes requests to the Success Factors (REST) API. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | No | The Success Factors connection. |
| `path` | string | jsonata | Yes | API endpoint path. |
| `method` | string | jsonata | Yes | HTTP method. Options: `POST`, `GET`, `PUT`, `DELETE`, `PATCH`. |
| `dataTransform` | string | jsonata | No | Request body. |
| `responseTransform` | string | jsonata | No | Transform response. Default: `"$"`. |
| `returnErrors` | boolean | -- | No | Return errors as payload. Default: `false`. |

Standard output port.

---

## TecCom File Upload

| | |
|---|---|
| **Name** | `tecComFileUpload` |
| **Title** | TecCom File Upload |
| **Responsibility** | transition |
| **Description** | Converts JSON to CSV and sends to TecCom. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | No | The TecCom connection. |
| `requestMode` | string | -- | Yes | Mode. Options: `REPLACE`, `MODIFY`. |
| `files` | array | -- | Yes | Files to upload. See sub-table. |
| `responseTransform` | string | jsonata | No | Transform response. Default: `"$"`. |
| `returnErrors` | boolean | -- | No | Return errors as payload. Default: `false`. |

**File items:**

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `fileName` | string | -- | No | File type. Options: `article`, `assortment`, `article_data`, `sales_uom`, `buyer_grouping`, `availability`, `article_description`, `article_buyer`, `alternative`, `condition_group`, `price`, `alc`, `packaging`, `external_document`. |
| `data` | string | jsonata | No | Data to upload. Default: `"$"`. |

Standard output port.

---

## TecCom Web Service

| | |
|---|---|
| **Name** | `tecComWebService` |
| **Title** | TecCom Web Service |
| **Responsibility** | transition |
| **Description** | Makes web service requests to TecCom. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | No | The TecCom connection. |
| `functionId` | string | -- | Yes | Web service function ID. |
| `parameterTransform` | string | jsonata | Yes | Parameters. Each element becomes a separate request. Default: `"{}"`. |
| `responseTransform` | string | jsonata | No | Transform response. Default: `"$"`. |
| `returnErrors` | boolean | -- | No | Return errors as payload. Default: `false`. |

Standard output port.

---

## UPS (United Parcel Service)

| | |
|---|---|
| **Name** | `ups` |
| **Title** | United Parcel Service |
| **Responsibility** | transition |
| **Description** | Makes requests to the UPS API. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionNameTransform` | string | -- | No | The UPS connection. |
| `path` | string | jsonata | No | API endpoint path. |
| `action` | string | jsonata | No | HTTP method. Options: `POST`, `GET`, `PUT`, `DELETE`, `PATCH`. |
| `dataTransform` | string | jsonata | No | Request body. |
| `responseTransform` | string | jsonata | No | Transform response. Default: `"$"`. |
| `returnErrors` | boolean | -- | No | Return errors as payload. Default: `false`. |

Standard output port.

---

## Woocommerce

| | |
|---|---|
| **Name** | `woocommerce` |
| **Title** | Woocommerce |
| **Responsibility** | transition |
| **Description** | Makes requests to the Woocommerce (REST) API. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `connectionName` | string | -- | Yes | The Woocommerce connection. |
| `path` | string | jsonata | Yes | API endpoint path. |
| `method` | string | -- | Yes | HTTP method. Options: `POST`, `GET`, `PUT`, `DELETE`. |
| `version` | string | -- | No | Woocommerce version. Options: `v2`, `v3`. |
| `parametersTransform` | string | jsonata | No | Request parameters. |
| `dataTransform` | string | jsonata | No | Request body. |
| `returnErrors` | boolean | -- | No | Return errors as payload. Default: `false`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode, requireWalkthrough

---

## Deprecated Integration Nodes

### Integrate (Legacy)

| **Name** | `integrate` |
|---|---|
| **Description** | Legacy version. Deprecated: use the Integrate node (`integrateV2`) from the toolbox. |

### ODBC (Legacy)

| **Name** | `odbc` |
|---|---|
| **Description** | Legacy version. Deprecated: use the ODBC node (`odbcV2`) from the toolbox. |

### Plex Datasource (Legacy)

| **Name** | `plexDatasource` |
|---|---|
| **Description** | Legacy version. Deprecated: use the Plex Datasource node (`plexDatasourceV2`) from the toolbox. |
