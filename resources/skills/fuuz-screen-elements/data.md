# Data Elements

8 elements that provide data context, querying, and data management.

---

## Form

**resolvedName:** `Form`
**Flags:** `canvas`, `isForm`, `isDataProvider`

The primary single-record data context. Child input elements register their fields, and the Form builds a GraphQL query from the model and registered fields. Supports create, update, and delete mutations.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Form label |
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |

**Data**

| Field | Type | Description |
|-------|------|-------------|
| `query.api` | text | API target (default: `"Application"`) |
| `query.model` | text | Data model name |
| `query.autoLoad` | switch | Auto-load on mount (default: `true`) |
| `query.fields` | json | Base fields always included |
| `query.dataPath` | text | Path to extract from response (default: `"edges[0]"`) |
| `query.parameters` | transform | Query variables expression |
| `query.filterPredicate` | transform | Static filter predicate |
| `query.readPreference` | options | Read preference (`primaryPreferred`, `secondary`) |
| `query.query` | text | Raw GraphQL query override |

**Data Transform**

| Field | Type | Description |
|-------|------|-------------|
| `query.dataTransform.transform` | transform | Post-load data transformation |
| `query.dataTransform.remote` | switch | Run transform server-side (default: `true`) |

**Data Subscription**

| Field | Type | Description |
|-------|------|-------------|
| `query.dataSubscription.enabled` | switch | Enable real-time subscription |
| `query.dataSubscription.topics` | json | Topic strings to subscribe to |
| `query.dataSubscription.filterTransform` | transform | Filter incoming messages |
| `query.dataSubscription.valueTransform` | transform | Transform subscription data |

**Validation**

| Field | Type | Description |
|-------|------|-------------|
| `validateOnSave` | switch | Validate all fields before save (default: `true`) |
| `validateOnChange` | switch | Validate field on each change (default: `false`) |

**Actions**

| Field | Type | Description |
|-------|------|-------------|
| `onLoad` | action | Action after data loads |
| `onSave` | action | Action after successful save |
| `onDelete` | action | Action after successful delete |
| `onChange` | action | Action on any field change |
| `onError` | action | Action on save/load error |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `setValue(path, value)` | Set a field value by data path |
| `focus(fieldName)` | Focus a specific field |
| `blur(fieldName)` | Blur a specific field |
| `disableField(fieldName)` | Disable a field |
| `enableField(fieldName)` | Enable a field |
| `validate()` | Validate all fields, returns errors |
| `save()` | Execute the save mutation |
| `delete()` | Execute the delete mutation |
| `load()` | Re-execute the query |
| `reset()` | Reset form to loaded data |
| `setData(data)` | Override form data directly |
| `isDirty()` | Check if form has unsaved changes |

### Exposed State

| State | Description |
|-------|-------------|
| `data` | Current form data object |
| `loading` | Whether the form is loading |
| `saving` | Whether the form is saving |
| `dirty` | Whether data has been modified |
| `errors` | Current validation errors |

---

## Table

**resolvedName:** `Table`
**Flags:** `canvas`, `isTable`, `isDataProvider`

Multi-record data context with columns, sorting, filtering, pagination, grouping, row selection, and views.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Table label |
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |

**Data**

Same data fields as Form (query.api, query.model, query.autoLoad, query.fields, query.parameters, query.filterPredicate, query.readPreference, query.query, query.dataTransform, query.dataSubscription).

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `striped` | switch | Alternating row colors |
| `highlightOnHover` | switch | Highlight row on hover |
| `withBorder` | switch | Show table border |
| `withColumnBorders` | switch | Show column borders |
| `stickyHeader` | switch | Sticky header on scroll |
| `fontSize` | options | Table font size |
| `rowHeight` | options | Row height (compact, default, comfortable) |
| `enableBackground` | switch | Enable background color |
| `background` | color | Background color |

**Sorting & Filtering**

| Field | Type | Description |
|-------|------|-------------|
| `sortable` | switch | Enable column sorting (default: `true`) |
| `filterable` | switch | Enable column filtering |
| `filterForm` | text | Element name of an associated filter form |
| `defaultSort` | json | Default sort configuration: `[{ field, direction }]` |

**Pagination**

| Field | Type | Description |
|-------|------|-------------|
| `paginated` | switch | Enable pagination (default: `true`) |
| `pageSize` | integer | Rows per page (default: `25`) |
| `pageSizeOptions` | json | Available page sizes |

**Selection**

| Field | Type | Description |
|-------|------|-------------|
| `selectable` | switch | Enable row selection (default: `false`) |
| `multiSelect` | switch | Allow multiple selection |
| `onSelectionChange` | action | Action when selection changes |

**Grouping**

| Field | Type | Description |
|-------|------|-------------|
| `groupBy` | text | Field to group rows by |
| `groupSort` | options | Group sort direction |

**Views**

| Field | Type | Description |
|-------|------|-------------|
| `views` | json | Saved view configurations (columns, sort, filter, rowLimit) |
| `defaultView` | text | Default view key |

**Row Actions**

| Field | Type | Description |
|-------|------|-------------|
| `onRowClick` | action | Action on row click |
| `onRowDoubleClick` | action | Action on row double-click |
| `draggable` | switch | Enable drag-and-drop rows |
| `onDragEnd` | action | Action after row drag |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `search(term)` | Filter table by search term |
| `selectRow(id)` | Select a row by ID |
| `deselectRow(id)` | Deselect a row |
| `clearSelection()` | Clear all selections |
| `load()` | Re-execute the query |
| `exportData(format)` | Export table data |
| `setPage(page)` | Navigate to a page |
| `setSort(field, dir)` | Set sort column and direction |

### Exposed State

| State | Description |
|-------|-------------|
| `data` | Current page data array |
| `allData` | All loaded data |
| `selectedRows` | Array of selected row objects. Each object contains row data keyed by column `dataPath` (e.g., `{ "id": "abc", "name": "Order 1", "status": "active" }`). Controlled by `selectable` prop: `"single"` = max one row, `"multiple"` = unlimited. Use `$count(selectedRows)` to check selection count. |
| `selectedIds` | Array of selected row IDs (shorthand for `selectedRows.id`) |
| `loading` | Whether table is loading |
| `total` | Total record count |
| `page` | Current page number |
| `sort` | Current sort configuration |

---

## Table Column

**resolvedName:** `TableColumn`
**Flags:** `isTableColumn`

A single column definition inside a Table. Configures how a field is displayed, formatted, sorted, and optionally edited inline.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `field` | text | Column field name |
| `dataPath` | text | Model field path |
| `label` | text | Column header label |
| `width` | text | Column width |
| `minWidth` | text | Minimum column width |
| `visible` | switch | Column visibility (default: `true`) |

**Format**

| Field | Type | Description |
|-------|------|-------------|
| `format` | options | Display format (see below) |
| `formatString` | text | Format pattern (date format, number format, etc.) |
| `transform` | transform | Custom cell value transform |

Format options: `text`, `number`, `currency`, `percent`, `date`, `dateTime`, `time`, `duration`, `boolean`, `badge`, `link`, `image`, `icon`, `color`, `progress`, `measure`, `json`, `array`, `custom`, `actions`

**Actions** (when format is `actions`)

| Field | Type | Description |
|-------|------|-------------|
| `actions` | json | Array of action button configs |
| `flows` | json | Array of flow button configs |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `sortable` | switch | Allow sorting (default: `true`) |
| `filterable` | switch | Allow column filtering |
| `resizable` | switch | Allow column resize (default: `true`) |
| `editable` | switch | Enable inline editing (default: `false`) |
| `editType` | options | Inline edit input type |
| `sticky` | options | Sticky position (`left`, `right`, none) |
| `hideable` | switch | Allow hiding from column menu (default: `true`) |

---

## Custom Fields Column

**resolvedName:** `CustomFieldsTableColumn`
**Flags:** `isTableColumn`, `isDynamicTableColumn`

Dynamically generates columns for custom fields defined on the model's metadata. Registers columns asynchronously as custom field definitions are loaded.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `customFieldModel` | text | Model containing custom field definitions |
| `visible` | switch | Visibility (default: `true`) |

---

## Dynamic Column

**resolvedName:** `DynamicTableColumn`
**Flags:** `isTableColumn`, `isDynamicTableColumn`

Generates multiple columns from a transform expression. The expression evaluates to an array of column configuration objects.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `columnsTransform` | transform | Expression that returns column config array |
| `query.fields` | json | Additional fields to include in query |
| `visible` | switch | Visibility (default: `true`) |

---

## Cards

**resolvedName:** `Cards`
**Flags:** `canvas`, `isForm`, `isCard`, `isDataProvider`

A hybrid of Form and Table — queries multiple records like a Table but renders each record as a card using a Form-like data context. Children are repeated for each record.

### Sections

Same data sections as Table (Data, Data Transform, Data Subscription, Pagination, Selection, Sorting).

**Layout**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |
| `columns` | integer | Number of card columns (default: `3`) |
| `gap` | text | Gap between cards |
| `cardMinWidth` | text | Minimum card width |

**Card Actions**

| Field | Type | Description |
|-------|------|-------------|
| `onCardClick` | action | Action on card click |
| `onCardDoubleClick` | action | Action on card double-click |

### Exposed Functions

Combines Form functions (setValue, save, delete, validate) and Table functions (search, selectRow, load, setPage).

### Exposed State

Same as Table (data, selectedRows, selectedIds, loading, total, page).

---

## Scheduling Config

**resolvedName:** `SchedulingConfiguration`
**Flags:** `isDataProvider`

A specialized data provider for scheduling and calendar configurations. Manages scheduling rules, resources, and time slots.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `query.api` | text | API target |
| `query.model` | text | Scheduling model |
| `query.autoLoad` | switch | Auto-load (default: `true`) |

**Configuration**

| Field | Type | Description |
|-------|------|-------------|
| `resourceModel` | text | Resource model name |
| `resourceFields` | json | Fields to load for resources |
| `timeSlotDuration` | duration | Duration of each time slot |
| `workingHours` | json | Working hours configuration |

---

## Data Tree

**resolvedName:** `DataTreeView`
**Flags:** `canvas`, `isDataProvider`

Displays hierarchical data as a tree view. Each node can be expanded, collapsed, selected, and can load children lazily.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |

**Data**

| Field | Type | Description |
|-------|------|-------------|
| `query.api` | text | API target |
| `query.model` | text | Model name |
| `query.autoLoad` | switch | Auto-load (default: `true`) |
| `query.parameters` | transform | Query parameters |
| `query.fields` | json | Fields to load |

**Tree Configuration**

| Field | Type | Description |
|-------|------|-------------|
| `labelField` | text | Field to display as node label |
| `parentField` | text | Field for parent reference (hierarchical) |
| `childrenField` | text | Field for child records |
| `iconField` | text | Field for node icon |
| `selectable` | switch | Allow node selection (default: `true`) |
| `multiSelect` | switch | Allow multiple selection |
| `expandAll` | switch | Expand all nodes initially |
| `lazyLoad` | switch | Load children on expand |

**Actions**

| Field | Type | Description |
|-------|------|-------------|
| `onSelect` | action | Action on node selection |
| `onExpand` | action | Action on node expand |
| `onCollapse` | action | Action on node collapse |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `load()` | Reload tree data |
| `expandAll()` | Expand all nodes |
| `collapseAll()` | Collapse all nodes |
| `selectNode(id)` | Select a node by ID |

### Exposed State

| State | Description |
|-------|-------------|
| `data` | Tree data array |
| `selectedNode` | Currently selected node |
| `selectedNodes` | All selected nodes (multi-select) |
| `expandedKeys` | Keys of expanded nodes |
