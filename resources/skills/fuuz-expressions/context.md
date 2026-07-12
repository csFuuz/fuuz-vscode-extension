# Platform Evaluation Context

JSONata expressions run in two distinct contexts: **Screen Elements** (frontend) and **Data Flows** (backend). Each provides different variables and bindings.

---

## Screen Element Context

Used in transform props, onChange handlers, validation expressions, table column data/style.

### Root Input (`$`)

The root `$` is the component-specific data, assembled by each component type:
- **Form inputs**: current form field values
- **Table columns**: current row data
- **Action buttons**: data context of the triggering element

### `$$` -- Root Reference

Always refers to the top-level input, regardless of how deep you have navigated:

```jsonata
Account.Order.Product.(
  $$.Account.Name & ": " & Description
  /* $$ reaches back to root to get Account.Name */
)
```

### `metadata` -- Platform Metadata

Available in all frontend JSONata expressions.

| Path | Description |
|------|-------------|
| `metadata.user` | Current user -- `.id`, `.firstName`, `.lastName`, `.email`, `.environments`, `.accessTypeId` |
| `metadata.tenant` | Current tenant -- `.id`, `.name`, `.tenantTypeId` |
| `metadata.userTenants` | All tenants the user belongs to -- `[].id`, `[].tenant.id`, `[].tenant.name` |
| `metadata.userRoles` | Roles -- `[].role.id`, `[].role.name`, `[].role.description`, `[].role.homeScreenId` |
| `metadata.screen` | Current screen metadata |
| `metadata.environment` | Environment name (from enterprise) |
| `metadata.platformVersion` | Platform version string |
| `metadata.settings` | Localization settings (see below) |
| `metadata.enterprise` | Enterprise -- `.id`, `.name`, `.domain`, `.maintenanceMode`, `.platformVersion`, `.environment` |
| `metadata.urlParameters` | URL path parameters (e.g., `:id` from `/screens/:id`) |
| `metadata.querystring` | URL query string parameters |

#### `metadata.settings` -- Localization

| Path | Description |
|------|-------------|
| `metadata.settings.DateFormat` | Date format string |
| `metadata.settings.TimeFormat` | Time format string |
| `metadata.settings.DateTimeFormat` | DateTime format string |
| `metadata.settings.IntegerFormat` | Integer display format |
| `metadata.settings.FloatFormat` | Float display format |
| `metadata.settings.Locale` | Locale code |
| `metadata.settings.TimeZone` | Timezone |
| `metadata.settings.AlwaysDisplayTimeZones` | Whether to always show timezone |

### `$components` -- Screen Component Shared State

Hierarchical store of all named screen components. Each component registers:

```
$components.<Name>.data     -- Component's current data
$components.<Name>.fn       -- Component's callable functions
$components.<Name>.context  -- Component-specific context (e.g., row data in tables)
```

#### Table Component (`$components.MyTable`)

| Path | Description |
|------|-------------|
| `.data` | Current table row data |
| `.fn.loadData({filter, rowLimit})` | Reload data from backend |
| `.fn.search({rowsPerPage})` | Search with filter form |
| `.fn.setRows(array)` | Overwrite all rows |
| `.fn.addRows(array)` | Append rows |
| `.fn.updateRows(array)` | Update existing rows by id |
| `.fn.upsertRows(array)` | Add or update rows by id |
| `.fn.deleteRows(array)` | Delete rows by id |
| `.fn.selectRow(array)` | Select rows |
| `.fn.deselectRow(array)` | Deselect rows |
| `.fn.toggleRowSelection(array)` | Toggle selection |
| `.fn.selectAllRows()` | Select all rows |
| `.fn.deselectAllRows()` | Deselect all rows |
| `.fn.selectAllFiltered()` | Select all filtered rows |
| `.fn.deselectAllFiltered()` | Deselect all filtered rows |
| `.fn.setSelectedRows(array)` | Set exact selection |
| `.fn.setData(data)` | Set table data directly |

#### Form Component (`$components.MyForm`)

| Path | Description |
|------|-------------|
| `.data` | Current form field values |
| `.fn.setValue(field, value)` | Set a field value |
| `.fn.focus(field)` | Focus a field |
| `.fn.blur(field)` | Blur a field |
| `.fn.loadData()` | Reload form data |
| `.fn.validate()` | Validate and return errors |
| `.fn.save(saveAll?)` | Save the form |
| `.fn.delete()` | Delete form data |
| `.fn.disableField(field)` | Disable a field |
| `.fn.enableField(field)` | Enable a field |
| `.fn.getUpdateMutation()` | Get GraphQL mutation |
| `.fn.getUpdatePayload()` | Get mutation variables |
| `.fn.getVariables()` | Get all form variables |

#### Container Component (`$components.MyContainer`)

| Path | Description |
|------|-------------|
| `.fn.hide()` | Hide the container |
| `.fn.show()` | Show the container |
| `.fn.toggle()` | Toggle visibility |
| `.fn.resetHidden()` | Reset hidden fields |
| `.fn.collapse()` | Collapse the container |
| `.fn.expand()` | Expand the container |

#### Screen Element (`$components.MyScreen`)

| Path | Description |
|------|-------------|
| `.context` | Screen context data |
| `.fn.hide()` | Hide |
| `.fn.show()` | Show |
| `.fn.toggle()` | Toggle visibility |
| `.fn.showLoading()` | Show loading indicator |
| `.fn.hideLoading()` | Hide loading indicator |
| `.fn.executePageLoadAction()` | Re-execute page load action |

#### TabBar Component (`$components.MyTabBar`)

| Path | Description |
|------|-------------|
| `.tabIndex` | Current tab index (number) |
| `.tabs` | Array of tab context objects |
| `.currentTab` | Current tab context object |
| `.fn.setTab(index)` | Switch to tab by index |
| `.fn.enableTab(index)` | Enable a tab |
| `.fn.disableTab(index)` | Disable a tab |
| `.fn.showTab(index)` | Show a tab |
| `.fn.hideTab(index)` | Hide a tab |

#### Widget Element (`$components.MyWidget`)

| Path | Description |
|------|-------------|
| `.fn.setParams(params)` | Set parameters for the embedded screen |

#### Action / Flow / Split Button (`$components.MyButton`)

| Path | Description |
|------|-------------|
| `.fn.execute(payload?)` | Execute the button's action with optional payload |

#### Cards Component (`$components.MyCards`)

| Path | Description |
|------|-------------|
| `.data` | Array of card data objects |
| `.fn.loadData()` | Load/reload card data |
| `.fn.search()` | Search cards using filter form |

### `$appConfig` -- Application Configuration

The tenant's application configuration object. Available in all local (non-remote) frontend evaluations.

### Frontend-Only Functions

These functions are only available in browser context:

| Function | Description |
|----------|-------------|
| `$navigateTo(pathname, options?)` | Navigate to URL. Options: `{newWindow, replace}` |
| `$navigateBack()` | Navigate back in history |
| `$navigateReload()` | Reload current screen |
| `$showAlertDialog(message, options?)` | Show alert dialog |
| `$showConfirmDialog(message, options?)` | Show confirmation dialog (returns boolean) |
| `$showFormDialog(formProps)` | Show form dialog |
| `$showScreenDialog(props)` | Show screen dialog |
| `$retrieveFileContent(fileId, encoding?)` | Download and decode a file by ID |
| `$addNotificationMessage(title, options?)` | Show UI notification |
| `$writeToClipboard(data)` | Write to clipboard |
| `$readFromClipboard()` | Read from clipboard |

### Screen Element Examples

```jsonata
/* Show/hide a container based on form value */
$components.MyForm.data.status = "active"

/* Get selected table rows */
$components.MyTable.data[selected = true]

/* Navigate with URL parameter */
$navigateTo("/screens/detail/" & $components.MyTable.data.id)

/* Conditional visibility based on user role */
$any(metadata.userRoles, function($r) { $r.role.name = "Admin" })

/* Set form field from table selection */
$components.MyForm.fn.setValue("orderId", $components.MyTable.data.id)

/* Show confirmation before action */
(
  $confirmed := $showConfirmDialog("Are you sure you want to delete?");
  $confirmed ? $components.MyForm.fn.delete() : null
)

/* Use URL parameters */
metadata.urlParameters.id
metadata.querystring.tab
```

---

## Data Flow Context

Used in Transform nodes, Set Context, Merge Context, Conditional nodes, and other data flow nodes.

### Root Input (`$`)

The current node's payload -- the data flowing from the previous node.

### `$state` -- Flow Execution State

The full accumulated execution state, available in all data flow node evaluations.

| Path | Description |
|------|-------------|
| `$state.payload` | Current payload (same as `$`) |
| `$state.context` | User-defined context set by Set Context / Merge Context nodes |
| `$state.claims` | Auth claims of the triggering user |
| `$state.batches` | Batch tracking array (Fork/Broadcast/Combine) |
| `$state.messageId` | Unique message ID for this flow execution |
| `$state.metadata` | Flow metadata -- `{tenantId, enterpriseId, flowId}` |
| `$state.depth` | Current execution depth counter |
| `$state.nextNodes` | Array of next node IDs to execute |
| `$state.trace` | Trace entries (when tracing enabled) |
| `$state.lastError` | Error from last caught error (see below) |
| `$state.catchErrorNode` | ID of the error handler node |

#### `$state.context`

Free-form object that accumulates data across the flow:
- **Set Context** nodes replace the entire context
- **Merge Context** nodes deep-merge into the existing context
- Access as `$state.context.anyPath`
- Primary mechanism for passing data between nodes outside the payload

#### `$state.claims`

Authentication claims of the user or system that triggered the flow. Available for security/authorization logic.

#### `$state.lastError`

When using Try-Catch error handling: `{name, message, stack, info, node}` from the last failed node.

#### `$state.metadata`

Flow metadata: `{tenantId, enterpriseId, flowId}`.

### Node Types and JSONata Results

| Node Type | What happens with JSONata result |
|-----------|--------------------------------|
| JSONata (transform) | Result becomes new `payload` |
| If Else | Result (boolean) determines output port |
| Route | Result determines which branches to route to |
| Accept / Reject | Result (boolean) determines whether to continue |
| Set Context | Result replaces the entire `$state.context` |
| Merge Context | Result is deep-merged into `$state.context` |
| Remove From Context | Result (array of paths) removes keys from context |
| Response | Result becomes the response payload |
| Log | Result is logged as the message |

### Data Flow Examples

```jsonata
/* Transform -- reshape payload */
{
  "orderId": id,
  "items": lineItems.({"sku": partNumber, "qty": quantity}),
  "total": $sum(lineItems.amount)
}

/* If/Else -- conditional routing */
status = "approved" and $sum(lineItems.amount) > 1000

/* Set Context -- store data for later nodes */
{
  "originalPayload": $,
  "processedAt": $now(),
  "userId": $state.claims.sub
}

/* Access context in later transform */
{
  "result": processedData,
  "startedAt": $state.context.processedAt,
  "originalInput": $state.context.originalPayload
}

/* Error handling -- check last error */
$state.lastError != null ? {
  "error": true,
  "message": $state.lastError.message,
  "failedNode": $state.lastError.node
} : { "error": false }

/* Query with context data */
$query({
  "statement": "query($id: ID!) { WorkOrder(where: {id: {_eq: $id}}) { edges { id name } } }",
  "variables": { "id": $state.context.workOrderId }
}).WorkOrder.edges[0]
```

---

## Context Differences Summary

| Feature | Screen Elements | Data Flows |
|---------|----------------|------------|
| Root `$` | Component data (form values, row data, etc.) | Node's current payload |
| `$$` | Top-level root input | Top-level root input |
| `metadata` | User, tenant, settings, URL params | Not directly available |
| `$components` | Screen component shared state | Not available |
| `$state` | Not available | Full flow state (payload, context, claims, batches) |
| `$appConfig` | Application configuration | Not available |
| UI functions | `$navigateTo`, `$showAlertDialog`, etc. | Not available |
| Evaluation | Local (browser) or remote (`__remote: true`) | Always server-side |
| Platform bindings | Core + Moment | Core + Moment + XML + EDI + Encryption + Network + Units + Calendars + Joins + Semver + MFGx App |
