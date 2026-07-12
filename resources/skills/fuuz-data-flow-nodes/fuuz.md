# Fuuz

Nodes for interacting with the Fuuz platform -- querying, mutating, aggregating data, executing flows, sending email, generating documents, and more.

---

## Aggregate

| | |
|---|---|
| **Name** | `aggregate` |
| **Title** | Aggregate |
| **Responsibility** | transition |
| **Description** | Executes an aggregation pipeline against the Fuuz database. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `collectionTransform` | string | jsonata | Yes | JSONata expression producing the collection to aggregate from. |
| `pipelineTransform` | string | jsonata | Yes | JSONata expression producing the aggregation pipeline. |
| `explain` | boolean | -- | No | When enabled, returns the execution plan instead of results. Useful for performance tuning. Default: `false`. |

Standard output port.

**Validation:** requireInputNode, requireOutputNode

### Example Configuration

```json
{
  "collectionTransform": "'orders'",
  "pipelineTransform": "[{ \"$match\": { \"status\": \"open\" } }, { \"$group\": { \"_id\": \"$customerId\", \"total\": { \"$sum\": \"$amount\" } } }]"
}
```

---

## Execute Flow

| | |
|---|---|
| **Name** | `executeFlow` |
| **Title** | Execute Flow |
| **Responsibility** | transition |
| **Description** | Executes a deployed flow in Fuuz. The target flow must start with a Request node and include a Response node. If the flow is not deployed, an error is thrown. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `flowId` | integer | combobox | Yes | The flow to execute. |
| `payloadTransform` | string | jsonata | No | Transform to format the input before passing it to the target flow's Request node. |

Standard output port.

**Validation:** requireInputNode

---

## Query

| | |
|---|---|
| **Name** | `query` |
| **Title** | Query |
| **Responsibility** | transition |
| **Description** | Runs a query against the Fuuz GraphQL APIs. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `api` | string | -- | Yes | Which Fuuz API to query. Options: `application`, `system`. Default: `"application"`. |
| `query` | string | graphql | Yes | The GraphQL query to execute. |
| `variablesTransform` | string | jsonata | Yes | Transform producing the variables for the query. Default: `"{}"`. |

Standard output port.

**Validation:** requireInputNode, requireOutputNode

### Example Configuration

```json
{
  "api": "application",
  "query": "query ($id: Int!) { itemRevision(id: $id) { id name status } }",
  "variablesTransform": "{ \"id\": payload.itemId }"
}
```

---

## Mutate

| | |
|---|---|
| **Name** | `mutate` |
| **Title** | Mutate |
| **Responsibility** | transition |
| **Description** | Executes a mutation against the Fuuz GraphQL APIs. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `api` | string | -- | Yes | Which Fuuz API to mutate. Options: `Application`, `System`. Default: `"Application"`. |
| `mutation` | string | graphql | Yes | The GraphQL mutation to execute. |
| `variablesTransform` | string | jsonata | No | Transform producing the variables for the mutation. Default: `"{}"`. |

Standard output port.

**Validation:** requireInputNode, requireOutputNode

### Example Configuration

```json
{
  "api": "Application",
  "mutation": "mutation ($input: UpdateItemRevisionInput!) { updateItemRevision(input: $input) { id status } }",
  "variablesTransform": "{ \"input\": { \"id\": id, \"status\": \"approved\" } }"
}
```

---

## System Email

| | |
|---|---|
| **Name** | `systemEmail` |
| **Title** | System Email |
| **Responsibility** | transition |
| **Description** | Sends email via Fuuz. Email addresses can be plain (`to@server.com`), formatted (`"To Name" <to@server.com>`), or as objects with `name` and `address` properties. Lists can be comma-separated strings or arrays. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `emailToTransform` | string | jsonata | Yes | Recipient email addresses. |
| `emailCCTransform` | string | jsonata | No | CC email addresses. |
| `emailBCCTransform` | string | jsonata | No | BCC email addresses. |
| `emailReplyToTransform` | string | jsonata | No | Reply-to email address. |
| `emailSubjectTransform` | string | jsonata | Yes | Email subject. |
| `emailHtmlTransform` | string | jsonata | Yes | HTML body of the email. |
| `emailAttachments` | array | -- | No | Attachments to include. See sub-table. |

**Attachment items:**

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `attachmentFilenameTransform` | string | jsonata | Yes | Filename of the attachment. |
| `attachmentContentTransform` | string | jsonata | Yes | Encoded content of the attachment. |
| `attachmentEncoding` | string | combobox | No | Encoding. Options: `ascii`, `utf8`, `base64`, `hex`, `binary`. |

Standard output port.

**Validation:** requireInputNode

---

## Render Document

| | |
|---|---|
| **Name** | `generateDocument` |
| **Title** | Render Document |
| **Responsibility** | transition |
| **Description** | Generates a document from a Fuuz document design. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `documentDesignTransform` | string | -- | Yes | The document design to generate. |
| `payloadTransform` | string | jsonata | Yes | Transform returning the payload for the document. Default: `"$"`. |
| `filenameTransform` | string | jsonata | No | Filename for the generated document. Auto-generated from design name and timestamp if omitted. |
| `documentRenderFormatTransform` | string | -- | Yes | Render format. Default: `"\"Pdf\""`. |
| `cultureTransform` | string | jsonata | No | Culture to apply to the rendered document. |
| `returnContent` | boolean | -- | No | When true, includes document content in output. Default: `true`. |
| `saveRenderedFile` | boolean | -- | No | When true, saves the document. Default: `true`. |

Standard output port.

**Validation:** requireInputNode, requireOutputNode

---

## Get Calendar

| | |
|---|---|
| **Name** | `getCalendar` |
| **Title** | Get Calendar |
| **Responsibility** | transition |
| **Description** | Gets a Fuuz Calendar by id or name. The id field takes priority; if no calendar is found by id, the name is used. If neither matches, an error is thrown. Accepts a single object or an array of objects. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `calendarInput` | object | -- | No | The calendar to return. Accepts `{ id, name }` or an array of such objects. |

Standard output port.

**Validation:** requireInputNode, requireOutputNode

---

## Saved Query

| | |
|---|---|
| **Name** | `savedQuery` |
| **Title** | Saved Query |
| **Responsibility** | transition |
| **Description** | Executes a saved query in Fuuz. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `savedQueryId` | string | combobox | Yes | The saved query to execute. |
| `variablesTransform` | string | jsonata | Yes | Transform producing the variables for the query. Default: `"{}"`. |

Standard output port.

**Validation:** requireInputNode, requireOutputNode

---

## EDI Translation

| | |
|---|---|
| **Name** | `ediIntegration` |
| **Title** | EDI Translation |
| **Responsibility** | transition |
| **Description** | Integrates with the EDI Nation API to read, write, acknowledge, and validate EDI messages. Converts X12 and EDIFACT documents to/from JSON. The EDI Nation system connection may not be enabled by default. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `action` | string | jsonata | Yes | Action to perform. Options: `read` (EDI to JSON), `write` (JSON to EDI), `ack` (generate acknowledgement), `validate` (check validity). |
| `format` | string | jsonata | Yes | Document format. Options: `x12` (X12), `edifact` (EDIFACT). |
| `filename` | string | jsonata | No | Name of the file being translated. Visible for `read` action. |
| `fileContents` | string | jsonata | No | The EDI data to translate. |

Additional Options properties appear based on the selected action and format combination, with sensible defaults for API options such as `ignoreNullValues`, `continueOnError`, `charSet`, `preserveWhitespace`, `detectDuplicates`, and `eancomS3`.

Standard output port.

**Validation:** minimumNoteLength: 20, requireChangedName, requireInputNode, requireWalkthrough

---

## Integration Request -- *Deprecated*

| | |
|---|---|
| **Name** | `integrationRequest` |
| **Title** | Integration Request |
| **Responsibility** | transition |
| **Description** | Legacy node for making integration requests. Deprecated: use the Integrate node (`integrateV2`) instead. |

Standard output port.
