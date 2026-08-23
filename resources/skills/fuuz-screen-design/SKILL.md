---
name: fuuz-screen-design
description: Design and build Fuuz/MFGx screens. Use when the user needs to understand screen structure (flat node map, parent/child relationships, element names), transforms and context bindings, action steps, query building for forms and tables, or common screen patterns (form, table, dashboard). For individual element props and configuration, use fuuz-screen-elements instead.
---

# Fuuz Screen Design

The screen designer uses **Craft.js** to compose a flat node map of elements on a canvas. Follow Craft.js conventions: flat node structure (not nested trees), parent/child consistency, `isCanvas` for container elements, and `linkedNodes` for named slots.

## Critical Requirements

When generating screens, **always** ensure:

1. **`dataPath` is required** on all input elements and table columns. Every `TextInput`, `NumberInput`, `SelectInput`, `TableColumn`, etc. must have a `dataPath` prop set to the dot-notation model field path (e.g., `"name"`, `"customer.id"`). Without it, the element won't bind to data.
2. **`label` is required** on all input elements and table columns. Every input and `TableColumn` must have a `label` prop for display. Table columns use it as the column header. Omitting labels makes the UI unreadable.
3. **Table `query.dataPath` must be `"edges"`** when the table uses a query. The generated GraphQL returns a Connection pattern (`{ total, edges { node { ... } } }`). Tables need `dataPath: "edges"` to correctly iterate the result set. Forms use `"edges[0]"` for single-record extraction.
4. **`formElement`** should be set on input elements to reference their parent Form's `elementName` (e.g., `"Form1"`).
5. **`query.fields` must be `[]`** on child elements when the parent data provider (Form, Table, Cards) already includes the needed fields in its own `query.fields`. Without `query: { "fields": [] }`, the child will attempt to auto-add its `dataPath` to the query, which can cause issues. Set `query: { "fields": [] }` on any input/display element whose data is already loaded by the parent.

## 1. Screen Structure

### Save/Load Format

```json
{
  "components": [
    {
      "name": "My Screen",
      "tabTitle": "My Tab",
      "type": "canvas",
      "props": { "design": { "ROOT": {}, "nodeA": {}, "nodeB": {} } }
    }
  ]
}
```

Multiple tabs = multiple entries in `components`. The `type` must be `"canvas"`.

### Flat Node Map

The `design` object is a **flat map** keyed by string IDs (NOT a nested tree):

```json
{
  "ROOT": { "type": { "resolvedName": "Screen" }, "nodes": ["nodeA"], "parent": null },
  "nodeA": { "type": { "resolvedName": "Container" }, "parent": "ROOT", "nodes": ["nodeB"] },
  "nodeB": { "type": { "resolvedName": "TextInput" }, "parent": "nodeA", "nodes": [] }
}
```

### Node Shape

| Field | Description |
|-------|-------------|
| `type.resolvedName` | Element type name (must match exactly) |
| `isCanvas` | `true` = can contain children, `false` = leaf (nodes must be `[]`) |
| `props` | Element configuration |
| `displayName` | Human-readable name in designer |
| `custom.elementName` | Runtime reference name (e.g., `Form1`) — used in `$components.Form1.fn.save()` |
| `custom.elementCounts` | ROOT-only: counters for auto-naming (`{ "Container": 5, "Form": 1 }`) |
| `parent` | Parent node ID (`null` only for ROOT) |
| `hidden` | Hidden in designer layer panel |
| `nodes` | Ordered child node IDs |
| `linkedNodes` | Named child slots (e.g., tab panels) |

### ROOT Node

Always a `Screen` element with `parent: null`. Optional props: `background`, `pageLoadAction`, `intervals`, `removeOuterMargin`.

```json
{
  "ROOT": {
    "type": { "resolvedName": "Screen" },
    "isCanvas": true,
    "props": {
      "padding": 0, "margin": 0, "flexDirection": "column", "flexWrap": false,
      "alignItems": "stretch", "justifyContent": "flex-start",
      "width": "100%", "height": "100%", "hidden": false,
      "flexGrow": false, "shadow": false, "borderRadius": 0
    },
    "displayName": "Screen",
    "custom": { "elementName": "Screen", "elementCounts": {} },
    "parent": null, "hidden": false, "nodes": [], "linkedNodes": {}
  }
}
```

### Node IDs

- **Auto-generated**: 10-char random strings (e.g., `"e2iCcEdQ9p"`)
- **Human-readable**: Descriptive strings (e.g., `"saveButton"`) -- preferred for hand-coded screens
- Must be unique within the design map

### Parent/Child Consistency

If node B lists C in `nodes`, then C's `parent` must be B's ID.

### Element Names (`custom.elementName`)

Pattern: `{DisplayName}{Counter}` (e.g., `Form1`, `ActionButton2`). Screen root is always `"Screen"`. Counters tracked in `ROOT.custom.elementCounts`. Used for runtime references: `$components.Form1.fn.save()`, `$components.Screen.context.myData`.

### Element Type Reference

**Layout** (isCanvas: true unless noted):

| resolvedName | displayName | isCanvas |
|-------------|-------------|----------|
| `Screen` | Screen | true |
| `Container` | Container | true |
| `ScreenAccordion` | Accordion | true |
| `ScreenAccordionGroup` | Accordion Group | true |
| `ButtonsGroup` | Button Group | true |
| `TabBar` | Tabs | false |
| `GridCell` | Grid Cell | true |
| `ResizablePanelLayout` | Resizable Panel | true |
| `RichText` | Text | false |
| `ScreenWidget` | Widget | false |
| `Icon` | Icon | false |
| `EmbeddedWebpage` | Embedded Webpage | true |
| `Paper` | Paper | true — hidden from the toolbox |
| `Text` | Markdown Text | false — hidden, deprecated |

`Screen` is the fourth hidden Layout type and is always the ROOT node. `Screen`,
`ScreenAccordion` and `ScreenAccordionGroup` are three **distinct** stored types — `Screen` is
not "internally `ScreenAccordion`".

`TabBar` is `isCanvas: false` but is still a parent: it keeps each tab panel in `linkedNodes`,
never in `nodes`. See *Named slots* below.

**Data:**

| resolvedName | displayName | isCanvas |
|-------------|-------------|----------|
| `Form` | Form | true |
| `Table` | Table | true |
| `TableColumn` | Column | false |
| `CustomFieldsTableColumn` | Custom Fields Column | false |
| `DynamicTableColumn` | Dynamic Column | false |
| `Cards` | Cards | true |
| `SchedulingConfiguration` | Scheduling Config | false |
| `DataTreeView` | Data Tree | true |

**Input** (all isCanvas: false; all require a form-shaped host except `SVGInput`): `TextInput`,
`Password`, `ScanTextInput`, `EmailInput`, `UriInput`, `NumberInput`, `IntegerInput`,
`FloatInput`, `SliderInput`, `DateInput`, `TimeInput`, `DateTimeInput`, `DateRangeInput`,
`DurationInput`, `Checkbox`, `Switch`, `SelectInput`, `OptionsInput`, `TimeZoneInput`,
`ColorInput`, `IconPicker`, `AddressInput`, `MeasureInput`, `RatioMeasureInput`, `ArrayInput`,
`CustomFieldsInput`, `RichTextInput`, `MarkdownInput`, `CodeEditorInput`, `JSONataInput`,
`TransformInput`, `JSONInput`, `JSONSchemaInput`, `JSONSchemaPredicateInput`,
`GraphQLBuilderInput`, `WrappedGraphQLPredicate`, `FileUpload`, `Image`, `PDFViewer`,
`SVGInput`, `DisplayText`, `ProgressBar`, `Visualization`, `RRuleInput`

**`PasswordInput` does not exist.** The element is `Password`. Three more Input types are hidden
from the toolbox and only appear on screens that already carry them: `Combobox`, `GeneralInput`,
`ImageUpload`.

**Display** (all isCanvas: false): `CalendarInput`, `Chart`, `Timer`, `EventConsoleAdapter`.
The registry's Display category also contains `DisplayText`, `Image`, `PDFViewer`,
`ProgressBar`, `SVGInput` and `Visualization`, listed under Input above because they are
form-bound.

**Interaction** (all isCanvas: false): `FlowButton`, `ActionButton`, `SplitButton`, `MenuButton`,
plus the six toolbox presets `AddButton`, `EditButton`, `SaveButton`, `PrintButton`,
`DeleteButton`, `SearchButton`.

**The six presets are not element types.** Each one drops an `ActionButton` with a few props
pre-filled and persists as `type: "ActionButton"`; the only trace of which stub was dragged is
`definition.custom.editor`. Never write `"type": "SaveButton"` into a design blob — nothing will
resolve it.

### Placement Rules

One shared validator decides every drop, from the target's and the dragged element's flags:

| Condition | Outcome |
|---|---|
| dragged `isTableColumn` | only directly inside a Table |
| dragged `requiresForm`, target has no `isForm` ancestor | refused |
| dragged `isGridCell`, target's `layout` is not `"grid"` | refused |
| into a Form | only layout containers directly |
| into a Table | only table columns |
| into a Button Group | only elements flagged `isButton` — which excludes `SplitButton` |

**Refusals are silent.** The registry declares seven rejection messages and **none of them is
ever rendered** — a refused drop simply creates no node. Never take "no error appeared" for
acceptance; check that the node exists in the saved design.

**"Requires a Form" means "requires a form-shaped host."** The test is for an ancestor carrying
`isForm`, which is `Form` *and* `Cards`. Inputs drop straight into `Cards` with no Form in the
tree. Because a Form itself accepts only layout containers as direct children, the working shape
is **Form → Container → inputs**.

`DisplayText` really does carry `requiresForm` and really is refused outside a form-shaped host,
despite being read-only.

`EditButton` declares `requiresTable: true` that **nothing enforces** — it drops onto a
Table-free screen root.

### Named Slots (`linkedNodes`)

`TabBar.nodes` is always empty. Each tab panel is a `linkedNodes` entry keyed
`<elementName>Detail<index>` holding an ordinary `Container`. At creation the element name is
not yet set, so the first key is the literal string **`"undefinedDetail0"`**; the key is
re-derived on rename, stranding the old Container. A stranded panel is still stored, still
emitted as a plain `Container` row, and renders nowhere — the flat rows cannot tell you it is an
orphan. Compare the TabBar's `linkedNodes` map against the rows to find them.

### Property Names Have Two Identities

Every registry property carries a `name` (editor-config id) and a `dataPath` (the prop-bag key
that is stored). They differ on 158 of 1,664 properties — `fields` → `query.fields`,
`targetDataPath` → `target.dataPath`, `flexLayout` → `flex`. **Write the `dataPath`.**

`SliderInput` is the one inversion: its bounds are declared under the *names*
`validation.minValue` / `validation.maxValue` but stored **top-level** as `minValue` /
`maxValue`. Copying the `NumberInput` shape (`validation.minValue`) into a Slider silently sets
nothing.

### The Backend Accepts Anything

`ScreenElementNode.definition` and `.configuration` are untyped JSON, so any key you send is
stored and round-trips perfectly. `sx`, `elevation`, `tooltip`, `aria-label`, `data-testid` and
similar React/MUI props change nothing at render — Containers do not even spread them onto the
DOM. **"The API accepted it" is not evidence a property works.**

The one exception is `TextInput.placeholder`, which reaches the underlying native `<input>` where
the *browser* honours the attribute. It is declared by no element and used by no tenant; treat it
as a browser convenience, not a platform feature.

### Flat Rows Can Lag the Design Blob

`screenElement` rows are projected from `screenVersion.design`. Immediately after a save, all
current non-ROOT nodes have been observed missing from the flat rows while four deleted nodes
were still present. A missing flat row is not proof the element was not stored.

---

## 2. Transforms and Context

### Transform Object Shape

Props can hold static values or dynamic transforms. **Every** transform object must include all four fields:

```json
{
  "__transform": "<JSONata expression>",
  "__dynamicFields": {
    "payload": [],
    "context": []
  },
  "__cacheKey": "<unique key>",
  "__remote": false
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `__transform` | **Yes** | JSONata expression string |
| `__dynamicFields` | **Yes** | Object with `payload` and `context` arrays. **Always include both arrays**, even if empty. |
| `__cacheKey` | **Yes** | Unique cache key string for the transform (e.g., `"saveDisabled"`, `"titleLabel"`). Required for performance — always provide one. |
| `__remote` | **Yes** | `true` = server-side eval, `false` = client-side. Default to `false`. |

### `__dynamicFields` Rules

The `__dynamicFields` object tells the runtime which data paths to watch for re-evaluation. **Both `payload` and `context` must always be present as arrays** (empty `[]` if unused). Without correct entries, the transform will not re-evaluate when dependencies change.

**`context`** — for paths accessed via `$`-prefixed globals (e.g., `$components`, `$metadata`, `$card`):
- Strip the leading `$` and add the remaining path
- `$components.Form1.formState.dirty` → `"components.Form1.formState.dirty"`
- `$components.Screen.context.myKey` → `"components.Screen.context.myKey"`
- `$components.Table1.selectedRows` → `"components.Table1.selectedRows"`
- `$metadata.urlParameters.id` → `"metadata.urlParameters.id"`
- `$card.data.name` → `"card.data.name"` (within Cards elements)

**`payload`** — for paths accessed from the element's own data context (form data flowing in directly):
- These are paths like `data.name`, `data.active`, `data.status` within the element's bound data
- `data.active` → `"data.active"`
- `data.status` → `"data.status"`

**Examples:**

Static text (no dependencies):
```json
{
  "__transform": "'Hello World'",
  "__dynamicFields": { "payload": [], "context": [] },
  "__cacheKey": "staticGreeting",
  "__remote": false
}
```

Uses `$components` (context only):
```json
{
  "__transform": "$components.Form1.formState.dirty ? 'Save' : 'Saved'",
  "__dynamicFields": {
    "payload": [],
    "context": ["components.Form1.formState.dirty"]
  },
  "__cacheKey": "saveBtnLabel",
  "__remote": false
}
```

Uses form data (payload only):
```json
{
  "__transform": "data.active ? 'Active' : 'Inactive'",
  "__dynamicFields": {
    "payload": ["data.active"],
    "context": []
  },
  "__cacheKey": "activeLabel",
  "__remote": false
}
```

Uses both:
```json
{
  "__transform": "data.status = 'draft' ? $components.Screen.context.draftLabel : 'Final'",
  "__dynamicFields": {
    "payload": ["data.status"],
    "context": ["components.Screen.context.draftLabel"]
  },
  "__cacheKey": "statusLabel",
  "__remote": false
}
```

### JSONata Context

All JSONata expressions in screens have access to:

**`$components`** -- access elements by `elementName`:
```
$components.Form1.fn.save()              $components.Form1.fn.setValue("field", "val")
$components.Table1.fn.search()           $components.Screen.fn.setContext({...})
$components.Form1.formState.dirty        $components.Table1.selectedRows
$components.Screen.context.myKey
```

**`$metadata`** -- platform metadata:
```
$metadata.urlParameters    $metadata.tenant.id    $metadata.tenant.name
$metadata.enterprise       $metadata.user
```

**`data`** -- form data context (within a Form): `data.name`, `data.createdByUser.email`

**`$card`** -- card data context (within a Cards element). **Use `$card.data` instead of `data`** to access the current card's record in action step transforms (`transforms.pre`, `transforms.post`) and other expressions within Cards children. Inside Cards, `data` / `$.data` is not properly defined — always use `$card.data`:
```
$card.data.id          $card.data.name          $card.data.status
```
Example pre-transform for editing a card's record:
```json
{ "transforms": { "pre": "$card.data" } }
```

**`$query`** -- execute GraphQL: `$query({ "api": "system", "statement": "query {...}", "variables": {...} })`

**`$numeral`** -- formatting: `$numeral(12345).format("0,0")` -> `"12,345"`

**`$now`** -- current ISO 8601 timestamp

### Screen Context

Shared state accessible to all elements. Set from `pageLoadAction` or action steps:

```
$components.Screen.fn.setContext($context)       -- replace all
$components.Screen.fn.mergeContext($partial)      -- shallow merge
$components.Screen.fn.setContextValue("key", v)  -- set one key
$components.Screen.fn.deleteContextValue("key")  -- remove key
```

Read via transform: `$components.Screen.context.metrics.total`

### Form Data Binding

**Every** input element requires `dataPath`, `label`, and `formElement`:

```json
{ "dataPath": "name", "label": "Name", "formElement": "Form1" }
```

- `dataPath` (required): dot-notation path to the model field (e.g., `"name"`, `"customer.id"`)
- `label` (required): human-readable display label for the field
- `formElement` (required): the `elementName` of the parent Form (e.g., `"Form1"`)

URL parameters: `$metadata.urlParameters.id` (shorthand `id` in form query parameters).

### `$executeFlow` Argument Scope (gotcha)

In a `remote: true` transform (e.g. a Form's `query.dataTransform`, or any `__transform`/`dataTransform`) that calls `$executeFlow(...)`, referencing `$components.X` or `$metadata.X` **directly inside the argument object** resolves to **empty at runtime** — the executeFlow argument is evaluated in a scope where those context bindings are not available.

**Rule:** Never reference `$components`/`$metadata` directly inside a `$executeFlow` argument — bind them to `$variables` in the outer scope first, then pass only those variables.

```
BAD  — $components/$metadata resolve to empty inside the argument:
$executeFlow("f", { "serial": $components.Form1.data.serial, "mode": $metadata.settings.ThemeMode })

GOOD — bind to local $variables in the outer (...) scope, then reference those:
(
  $serial := $components.Form1.data.serial;
  $mode := $metadata.settings.ThemeMode;
  $executeFlow("f", { "serial": $serial, "mode": $mode })
)
```

This is the pattern the SPC/downtime dashboards use. The screen compliance check `screen-executeflow-context` flags the BAD form.

---

## 3. Action Steps

The `action` prop is an **ordered array** of steps executing sequentially. Each has a `type` plus type-specific fields. Optional `transforms.pre`/`transforms.post` run JSONata before/after.

### All 10 Action Types

**`transformation`** -- run JSONata: `{ "type": "transformation", "transformation": "$components.Form1.fn.save()", "remote": false }`

**`mutation`** -- GraphQL mutation: `{ "type": "mutation", "api": "Application", "mutation": {} }`

**`query`** -- GraphQL query (results available to subsequent steps): `{ "type": "query", "api": "Application", "query": {} }`

**`flow`** -- execute data flow: `{ "type": "flow", "flowId": "some-id" }`

**`navigation`** -- navigate user:

| navigationType | Fields | Description |
|---------------|--------|-------------|
| `Reload` | -- | Reload page |
| `Back` | `back: true` | Go back |
| `New Webpage` | `target` (transform), `newWindow` | Open URL |
| `Document` | `documentContent`, `documentMimeType`, `documentAutoPrint`, `documentAutoCloseAfterSeconds` | Open document |

**`confirmation`** -- blocking dialog (cancelling skips remaining steps):
```json
{
  "type": "confirmation",
  "message": { "__transform": "\"Are you sure?\"" },
  "submitIcon": { "icon": "trash", "variant": "solid" },
  "buttonColor": "error"
}
```
`buttonColor`: `primary`, `secondary`, `error`, `red`, `green`, `amber`

**`alert`** -- blocking informational dialog (same shape as confirmation)

**`message`** -- non-blocking snackbar: `{ "type": "message", "title": "OK", "message": "Saved", "severity": "success" }` (severity: `success`/`info`/`warning`/`error`)

**`form`** -- dialog with fields: `{ "type": "form", "title": "Enter Details", "fields": [], "submitIcon": {...} }`

**`screenDialog`** -- open screen widget in dialog:
```json
{
  "type": "screenDialog", "screenId": "id", "title": "Title",
  "screenName": "MyDialog", "screenParams": { "__transform": "{ \"id\": data.id }" },
  "canvasDialog": { "fullWidth": true, "maxWidth": "md", "includeSubmit": true, "includeCancel": true }
}
```
`maxWidth`: `xs`/`sm`/`md`/`lg`/`xl`/`false`. `screenName` must be unique within parent screen.

### Common Patterns

**Save:** `[{ "type": "transformation", "transformation": "$components.Form1.fn.save()", "remote": false }]`

**Delete with confirmation:**
```json
[
  { "type": "confirmation", "message": { "__transform": "\"Delete this record?\"" }, "buttonColor": "error" },
  { "type": "transformation", "transformation": "$components.Form1.fn.delete()" },
  { "type": "navigation", "navigationType": "Back", "back": true }
]
```

**Save button disabled transform:**
```json
{
  "__transform": "$components.Form1.formState.submitSucceeded ? $not($components.Form1.formState.dirtySinceLastSubmit) : $not($components.Form1.formState.dirty)",
  "__dynamicFields": { "payload": [], "context": [
    "components.Form1.formState.submitSucceeded",
    "components.Form1.formState.dirtySinceLastSubmit",
    "components.Form1.formState.dirty"
  ] },
  "__cacheKey": "saveDisabled",
  "__remote": false
}
```

---

## 4. Query Building

Form, Table, and Cards dynamically build GraphQL queries at runtime:
1. `query.model` identifies the data model
2. Each child input/column contributes its `dataPath`
3. System builds a Connection-pattern query and executes it

### Query Config (`query` prop)

| Property | Description |
|----------|-------------|
| `model` | Data model name (e.g., `"WorkOrder"`) |
| `fields` | Base fields always included (e.g., `["id"]`) |
| `dataPath` | Extraction path. **Form: `"edges[0]"`** (single record). **Table: `"edges"`** (required for query results to display). |
| `autoLoad` | Auto-execute when fields are ready |
| `parameters` | JSONata for variables (`filter`, `first`, etc.) |
| `filterPredicate` | Transform for a where predicate merged into filter |
| `readPreference` | `"primaryPreferred"` or `"secondary"` |
| `query` | Override: raw GraphQL string (skips auto-generation) |

These are the sub-keys of the `query` prop, so their stored paths are `query.model`,
`query.fields`, `query.dataPath`, and so on — which is also how the property panel is keyed.
The registry's `name` for `query.fields` is the bare `fields`; write the nested path.
`query.dataPath` and `query.query` have **no editor control** on Form or Table: they are seeded
from the registry defaults (`"edges[0]"` and `"edges"`) and are only reachable by hand-editing
the JSON.

### How Fields Contribute

Each child element's `dataPath` automatically registers with the parent data provider and adds to the generated query. There are three scenarios:

**1. Simple field** — `dataPath` alone is sufficient, the field auto-registers:
```json
{ "dataPath": "name", "label": "Name", "formElement": "Form1" }
```

**2. Relation/nested field** — needs extra `query.fields` to fetch sub-fields:
```json
{ "dataPath": "customer", "query": { "fields": ["customer.id", "customer.name"] } }
```

**3. Parent already loads the data** — set `query.fields` to `[]` to prevent the child from adding fields to the query. Use this when the parent Form/Table/Cards already specifies the field in its own `query.fields`:
```json
{ "dataPath": "name", "label": "Name", "formElement": "TenantCards1", "query": { "fields": [] } }
```
This is common with **Cards** and **Tables** where the parent's `query.fields` array explicitly lists all needed fields, and children just display data from the already-loaded context.

### Generated Query

For model `WorkOrder` with fields `id`, `name`, `customer.id`, `customer.name`:

```graphql
query WorkOrder($filter: WorkOrderWhereInput, $orderBy: [WorkOrderOrderByInput!], $first: Int, $after: String) {
  data: workOrder(where: $filter, orderBy: $orderBy, first: $first, after: $after) {
    total
    edges { node { id name customer { id name } } }
  }
}
```

### Variable Building

1. **Parameters transform** (`query.parameters`): `{ "filter": { "id": { "_eq": id } }, "first": 1 }`
2. **Filter predicate** (`query.filterPredicate`): transform producing a where clause
3. **Filter forms**: filter inputs combine `dataPath` + `predicate` (e.g., `name` + `_contains`)
4. **Merging**: all sources merged with `_and`
5. **Pagination**: `first`, `after`, `orderBy`, `readPreference`

### Mutations

Auto-generated: `UpdateWorkOrder($payload: [WorkOrderUpdatePayloadInput!]!)` and `DeleteWorkOrder(...)`. Payload built from registered fields with `where.id` + `update.{fields}`.

### Filter Predicates

`_contains`, `_eq`, `_in`, `_gt`/`_gte`, `_lt`/`_lte`, `_startsWith`, `_endsWith`, `_isNull`, `_has`, `_containsObject`

---

## 5. Common Patterns

### Form Screen

```
ROOT (Screen)
  actionBar (Container, row)
    saveButton (ActionButton)
    deleteButton (ActionButton)
  form (Form, query: { model: "MyModel", dataPath: "edges[0]", autoLoad: true })
    layout (Container, row, flexWrap)
      left (Container, column, 50%)
        nameInput (TextInput, dataPath: "name", formElement: "Form1")
      right (Container, column, 50%)
        createdAt (DisplayText, dataPath: "createdAt")
```

Form query parameters: `{ "filter": { "id": { "_eq": id } }, "first": 1 }`

### Table Screen

```
ROOT (Screen)
  filterForm (Form)
    filters (Container, row)
      nameFilter (TextInput, predicate: "_contains")
  actionBar (Container, row)
    createButton (AddButton)
    searchButton (SearchButton)
  table (Table, query: { model: "MyModel", dataPath: "edges" }, filterFormName: "FilterForm1", selectable: "multiple")
    col1 (TableColumn, dataPath: "name", label: "Name", format: "text", sortable: true)
    col2 (TableColumn, dataPath: "createdAt", label: "Created At", format: "datetime")
```

`AddButton` and `SearchButton` above name **toolbox presets**, not stored types — both save as
`type: "ActionButton"`, and their `action` arrays are yours to configure. Hand-written JSON must
say `ActionButton`.

**Table `selectable` prop:** `"single"` = only one row at a time, `"multiple"` = any number of rows (default).

**`selectedRows`** is an array of objects, where each object contains the row data keyed by `dataPath` with the corresponding values. Access via `$components.Table1.selectedRows`. Common patterns:

Disable button unless exactly one row selected:
```json
{
  "__transform": "$count($components.Table1.selectedRows) != 1",
  "__dynamicFields": { "payload": [], "context": ["components.Table1.selectedRows"] },
  "__cacheKey": "editDisabled",
  "__remote": false
}
```

Disable button when no rows selected (bulk action):
```json
{
  "__transform": "$count($components.Table1.selectedRows) = 0",
  "__dynamicFields": { "payload": [], "context": ["components.Table1.selectedRows"] },
  "__cacheKey": "bulkDisabled",
  "__remote": false
}
```

Access selected row data in action pre-transform:
```
$components.Table1.selectedRows[0].id        -- first selected row's ID
$components.Table1.selectedRows[0].name      -- first selected row's name
$components.Table1.selectedRows.id           -- array of all selected IDs
```

**Column format mapping:** String->`text`, Boolean->`checkmark`, DateTime->`datetime`, Date->`date`, Time->`time`, Int->`integer`, Float->`float`, JSON->`json`, Address->`address` (needs sub-fields), Measure->`measure` (needs value/unit), RichText->`richText`, Image->`image` (needs name/url/thumbnailUrl), Duration->`duration`

### Dashboard

```
ROOT (Screen, pageLoadAction: "...", background: "dark", removeOuterMargin: true)
  header (Container, row, paper)
    title (RichText)
    refreshBtn (ActionButton)
  content (Container)
    card (Container, shadow, paper, borderRadius: 8)
      label (RichText)
      value (RichText, content: transform reading $components.Screen.context.metrics.total)
```

pageLoadAction loads data via `$query()` then calls `$components.Screen.fn.setContext(...)`.

### Data Type to Input Mapping

| GraphQL Type | Element | Notes |
|-------------|---------|-------|
| `ID` | `DisplayText` | read-only |
| `String` | `TextInput` | use `MarkdownInput` for description/note fields |
| `Boolean` | `Checkbox` | |
| `DateTime`/`Date`/`Time` | `DateTimeInput`/`DateInput`/`TimeInput` | |
| `Int`/`Float` | `IntegerInput`/`FloatInput` | |
| `JSON` | `JSONInput` | |
| `Measure` | `MeasureInput` | needs query.fields for value/unit |
| `Address` | `AddressInput` | needs query.fields for sub-fields |
| `RichText` | `RichTextInput` | |
| `Duration` | `DurationInput` | |
| Reference | `SelectInput` | set `api`, `dataModel`, `selectFields`, `labelPath`. `labelField` belongs to the deprecated `Combobox`, not `SelectInput` |

### Container Layout System

Containers are the primary layout mechanism. Every Container is a CSS flex or grid box. Understanding how they nest is critical for correct screen layout.

#### Layout Modes

**Flex (default):** `layout: "flex"` — children flow in a direction with optional wrapping.
**Grid:** `layout: "grid"` — children placed in a column/row grid with equal cells.

#### Flex Layout Props

| Prop | Default | Description |
|------|---------|-------------|
| `flexDirection` | `"column"` | `"column"`, `"row"`, `"row-reverse"`, `"column-reverse"` |
| `flexWrap` | `true` | `true` = children wrap to next line, `false` = single line |
| `justifyContent` | `"flex-start"` | Main-axis alignment: `flex-start`, `center`, `flex-end`, `space-between`, `space-around`, `space-evenly` |
| `alignItems` | `"stretch"` | Cross-axis alignment: `stretch`, `flex-start`, `center`, `flex-end`, `baseline` |
| `gap` | — | Space between children (e.g., `"8px"`, `"16px"`) |

**Key defaults to remember:** Containers default to `flexDirection: "column"` and `alignItems: "stretch"`, so children stack vertically and stretch to full width. To lay children out horizontally, set `flexDirection: "row"`.

#### Grid Layout Props

| Prop | Description |
|------|-------------|
| `columns` | Number of columns → CSS `grid-template-columns: repeat(N, 1fr)` |
| `rows` | Number of rows → CSS `grid-template-rows: repeat(N, 1fr)` |
| `gap` | Space between grid cells (e.g., `"12px"`) |
| `justifyItems` | Cell alignment: `start`, `center`, `end` |

Use `GridCell` children with `colSpan`/`rowSpan` to span multiple cells — those two, plus `style`,
are the only properties `GridCell` declares. A `GridCell` is refused by any Container whose
`layout` is not `"grid"`, silently. No surveyed tenant uses `GridCell` at all.

#### Sizing Props (on any Container or child)

| Prop | Default | Description |
|------|---------|-------------|
| `width` | `"100%"` | CSS width. Use `"100%"`, `"50%"`, `"250px"`, `"auto"`, etc. |
| `height` | `"auto"` | CSS height. `"auto"` = content-driven. Use `"100%"`, `"500px"`, `"100vh"`, etc. |
| `flexGrow` | `false` | `true` = expand to fill remaining space in parent |
| `flexShrink` | `false` | `true` = allow shrinking below natural size |

**`flexGrow` is essential** for layouts where one section should fill remaining space (e.g., a content area below a fixed header).

#### Spacing Props

| Prop | Default | Description |
|------|---------|-------------|
| `padding` | `0` | Inner spacing (pixels, 0–96). Applies uniformly unless overridden. |
| `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight` | — | Override individual sides. **Not declared by the registry and not exposed in the panel**, but written by real screens in two tenants — unproven, hand-written JSON only |
| `margin` | `0` | Outer spacing (pixels, 0–96) |

#### Visual Props

| Prop | Default | Description |
|------|---------|-------------|
| `background` | `"default"` | `"default"`, `"paper"`, `"dark"`, `"light"`, `"primary"`, `"accent"`, `"custom"` |
| `customBackground` | — | Arbitrary color when `background: "custom"` |
| `shadow` | `false` | Box shadow for card-like elevation |
| `borderRadius` | `0` | Corner rounding in pixels |
| `overflowY` | — | **Container declares no `overflow` or `overflowY` property**, and no screen in the four surveyed tenants stores either. For a scrollable region, constrain the height and use `style` (a transform holding a CSS object, e.g. `{ "overflowY": "auto" }`), which *is* declared — and give the content a `minHeight` floor, or it shrinks to fit and never scrolls. Both halves are runtime-verified; see the two-part recipe below |

#### Additional Styles (`style`)

Anything CSS that no panel control covers goes in `style` — a transform holding a **React
inline-style object** (not CSS-in-JS, not a stylesheet), declared by `Container`, `GridCell`,
`EmbeddedWebpage` and `TableColumn`. It is merged after everything the panel writes to the same
node, so it wins over `padding`, `margin`, `height`, `borderRadius`, `bordersInput`, `gap`, the
flex/grid layout props, `shadow` and `background`. 274 declarations were measured at runtime in
August 2026; the property-by-property reference is in the `fuuz-screen-styling` skill.

What to know while laying a screen out:

| | |
|---|---|
| Write camelCase keys | kebab resolves for string values but a bare number under a kebab key is dropped (`{"z-index": 7}`) or silently corrupted (`{"line-height": 1.7}` → `1.7px`) |
| Bare numbers get `px` | except `lineHeight`, `zIndex`, `opacity`, `flexGrow`, `order`. `{"aspectRatio": 2}` is rejected — write `"2 / 1"` |
| `style.width` will not stick on a Container | it reaches the DOM and loses to the wrapper's flex layout. Use `{"flex": "none"}` with it, or `minWidth`/`maxWidth` as bounds. `height` applies normally |
| No selectors, no at-rules | `&:hover`, `&::before`, `& div` and `@media` keys are inert, and `animation` names a `@keyframes` rule that cannot exist, so nothing animates. `transition` works |
| A malformed value blanks the whole screen | a `style` holding a string or an array, or a transform that throws or returns a non-object, renders the app shell and an empty screen body with no error message |
| Watch for quoted keys | the designer's JSON input re-quotes key names on each edit (`box-shadow` → `"box-shadow"`), and a quoted name matches no CSS property. Rewrite the key rather than re-editing it |

#### Common Layout Recipes

**Vertical stack (default):**
```json
{ "layout": "flex", "flexDirection": "column", "alignItems": "stretch", "width": "100%" }
```
Children stack top-to-bottom, each stretching to full width.

**Horizontal row:**
```json
{ "layout": "flex", "flexDirection": "row", "flexWrap": true, "alignItems": "center", "gap": "8px", "width": "100%" }
```
Children flow left-to-right, vertically centered, wrapping if needed.

**Non-wrapping row (toolbar/action bar):**
```json
{ "layout": "flex", "flexDirection": "row", "flexWrap": false, "alignItems": "center", "justifyContent": "flex-end", "gap": "8px", "width": "100%" }
```
Children in a single line, pushed to the right.

**Two-column layout:**
```
Parent: { flexDirection: "row", flexWrap: true, gap: "16px" }
  Left:  { width: "50%", flexGrow: true, flexDirection: "column" }
  Right: { width: "50%", flexGrow: true, flexDirection: "column" }
```
Both columns grow equally. Use specific widths like `"300px"` + `flexGrow: true` for sidebar layouts.

**Sidebar + main content:**
```
Parent: { flexDirection: "row", gap: "16px" }
  Sidebar: { width: "250px", flexGrow: false, flexDirection: "column" }
  Main:    { flexGrow: true, flexShrink: true, flexDirection: "column" }
```
Sidebar stays fixed, main content fills remaining space.

**Header + scrollable content + footer:**
```
Parent: { flexDirection: "column", height: "100%" }
  Header:  { flexGrow: false, flexDirection: "row" }
  Content: { flexGrow: true, style: { overflowY: "auto", scrollbarWidth: "thin" }, flexDirection: "column" }
    Inner: { style: { minHeight: "400px" } }
  Footer:  { flexGrow: false, flexDirection: "row" }
```
Content area scrolls independently while header/footer stay fixed. **The overflow keyword is only
half of it** — the content inside the scroller is a flex item whose automatic minimum size comes
from its content, so without a `minHeight` floor it shrinks to fit and never overflows. Both
halves were measured by scrolling the box, not by reading the keyword back.

**Grid of equal cards:**
```json
{ "layout": "grid", "columns": 3, "gap": "16px", "width": "100%" }
```
Children fill a 3-column grid with equal-width cells.

**Dashboard card:**
```json
{ "padding": 16, "background": "paper", "shadow": true, "borderRadius": 8, "flexGrow": true }
```

**Centered content:**
```json
{ "flexDirection": "column", "justifyContent": "center", "alignItems": "center", "width": "100%", "height": "100%" }
```

#### Common Layout Mistakes

1. **Children not side-by-side**: Parent defaults to `flexDirection: "column"`. Set `"row"` for horizontal layout.
2. **Row items stretching vertically**: Default `alignItems: "stretch"` makes row children full height. Use `"center"` or `"flex-start"` instead.
3. **Content not filling space**: Set `flexGrow: true` on the container that should expand.
4. **Content overflowing**: constrain the height (parent `height: "100%"` or `flexGrow: true`) and put the overflow rule in `style`, e.g. `"style": { "overflowY": "auto" }`. A bare `overflowY` prop is not a declared Container property.
7. **Scroller declared but nothing scrolls**: `overflowY: "auto"` alone is half the recipe — give the content a `minHeight`, or the flex item shrinks to fit and there is nothing to scroll.
8. **A width in `style` that DevTools shows and nothing obeys**: `style.width` reaches the element and is overridden by the wrapper's flex layout. Write `{"flex": "none", "width": "…"}`, or bound it with `minWidth`/`maxWidth`, or use the panel's Width field.
5. **Items not wrapping**: `flexWrap` defaults to `true`, but if set to `false`, items stay on one line and may overflow.
6. **Grid items not spanning**: Use `GridCell` with `colSpan`/`rowSpan` inside grid-layout containers.

## Before you deploy: read [silent-failures.md](./silent-failures.md)

The ways a screen deploys `true` and renders **less than you wrote**, with nothing
logged anywhere: a component missing `type: "canvas"` renders blank; an element
missing `custom.elementName` is dropped; a filter form with nothing calling
`fn.search()` filters nothing. The runtime discards every prop it does not
declare, so a successful write proves nothing. Also there: forms that actually
save (and the undefined-filter bug that prefills a "new" form with the first
record), table/column rules, the two number-format traps, container surfaces and
spacing, renaming a TabBar without orphaning its panels, the four artifacts a
chart needs, and why a generator must refuse to rebuild a screen a human has
edited.
