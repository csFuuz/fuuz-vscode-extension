# Data Elements

8 elements that query data and provide it to their children, plus the table columns that render
it. This is the registry's whole **Data** category.

Form, Table and Cards are the three `isDataProvider` elements. They share one query contract
(documented in [SKILL.md](SKILL.md) under *Shared Data Fields*), one set of advanced
mutation-builder functions, and a set of **provider slots** — named data channels children read
from. All three are written under the `query.` prefix even though the panel labels drop it.

`SchedulingConfiguration` sits behind the same `isSchedulingExcluded()` gate as `CalendarInput`:
a tenant with scheduling disabled will not show it in the toolbox.

---

## Form

**resolvedName:** `Form`
**Flags:** `canvas`, `isForm`, `isDataProvider`, `registersSharedState`

Provides a form data context. A Form accepts **only layout containers** as direct children, so
the working shape is **Form → Container → inputs**. `Cards` carries the same `isForm` flag and
also satisfies an input's `requiresForm` — the test is for a form-shaped *host*, not literally
a Form.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `description` | text | Helper text |
| `blockNavigationWhenDirty` | checkbox | Warn before navigating away with unsaved changes (default: `true`) |

**Data**

| Field | Type | Description |
|-------|------|-------------|
| `query.api` | combobox | `Application` or `System` (default: `"Application"`) |
| `query.model` | options | Data model; the option list is queried from the tenant |
| `query.autoLoad` | checkbox | Query on page load (default: `true`) |
| `query.parameters` | jsonata | Transform returning the query parameters (default filters by `id` and takes `first: 1`) |
| `query.filterPredicate` | graphqlWhere | Additional where-clause filter |
| `titleContext` | transform | Transform returning the screen's title context |
| `query.fields` | graphql | Fields always included in the query (default: `["id"]`) |
| `query.readPreference` | combobox | `primaryPreferred` (default) or `secondary` |

**Validation**

| Field | Type | Description |
|-------|------|-------------|
| `validation.transform` | jsonata | Returns an error string, or undefined when the form is valid |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `query.dataTransform.transform` | jsonata | Transform the loaded data |
| `query.dataTransform.remote` | checkbox | Run it server-side (default: `false`; turn off for `$executeFlow` against Web flows) |
| `query.disableDataChangeIndicator` | checkbox | Disable the data-change indicator (default: `false`) |
| `query.selectedDataChangeIndicator` | options | `refresh` or `newTab` |
| `dataChangeIndicatorSize` | options | `small` or `normal` (defaults to normal) — note this one is **not** under `query.` |
| `enableConfirmOnDataChanged` | checkbox | Require confirmation before overwriting a record edited since load (default: `false`) |
| `query.dataSubscription.enabled` | checkbox | Enable the real-time subscription (default: `false`) |
| `query.dataSubscription.topics` | fieldGroup | Subscription topics; each entry is `{ topic }` |
| `query.dataSubscription.filterTransform` | jsonata | Apply the message only when this returns true |
| `query.dataSubscription.valueTransform` | jsonata | Returns the entire data object for the element |

`query.dataPath` and `query.query` have **no editor control**. They are seeded by the registry's
default props — `"edges[0]"` for Form — and are only reachable by hand-editing JSON.

### Exposed Functions

| Function | Description |
|----------|-------------|
| `setValue(field, value)` | Set a form field value |
| `focus(field)` / `blur(field)` | Move focus |
| `disableField(field)` / `enableField(field)` | Enable or disable one field |
| `validate(options?)` | Validate; resolves to the errors, or `null`. `options.showErrors` (default true) blurs each field to surface its message |
| `save(saveAll?)` | Save the form |
| `delete()` | Delete the form's record |
| `loadData(variables?)` | Load or reload the provider data |
| `getVariables(isFilter?)` | Build the current query variables (advanced) |
| `getUpdateMutation()` / `getDeleteMutation()` | Build the mutations (advanced) |
| `getUpdatePayload(fields?, formState?)` | Build the update payload (advanced) |
| `getUpdatePayloadCard(fields?, formState?)` | Build the per-card update payload (advanced) |
| `getDeletePayload()` | Build the delete payload (advanced) |

### Exposed State

The bundle declares no `stateKeys` for Form. What it does declare are **provider slots** —
`data`, `initialData`, `defaultValues`, `query`, `formState` — the channels its children read.

`blockNavigationWhenDirty` is one of the nine properties confirmed to work by runtime probe, and
it is invisible at first paint: it was proven by dirtying the form and navigating, where the
control blocked and the variant did not.

*Unverified rows: `label`, `onLoad`, `onSave`, `onDelete`, `onChange`, `onError`, `validateOnChange`, `validateOnSave` — the registry declares no lifecycle hooks on this element.*

---

## Table

**resolvedName:** `Table`
**Flags:** `canvas`, `isTable`, `isDataProvider`, `registersSharedState`

AG Grid-backed data table. Accepts **only table columns** as direct children — except when
`masterDetail` is on, where the elements dropped into it become each row's detail view.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `filterFormName` | node / text | The form used to filter this table, consumed by the `search()` binding. The registry declares this `dataPath` **twice** — once as a node picker, once as free text |
| `tableName` | text | Adds a header to the table |
| `exportTitle` | text | Name used for CSV/Excel exports — `"My Table"` exports as `Fuuz My Table MM_DD_YYYY`. No `<>:"/\|?*` |
| `description` | text | Helper text |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `margin` | slider | Outer margin (default: `8`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `fontSize` | text | Table font size |
| `initialRowHeight` | number | Row height in px on first load; rows grow to fit but never shrink |
| `flexGrow` | checkbox | Expand to fill available space (default: `false`) |
| `hideTableHeader` | checkbox | Hide the header bar (default: `false`) |

**Data** — the shared query set: `query.api`, `query.model`, `query.autoLoad`,
`query.parameters`, `query.filterPredicate`, `query.fields`, `query.readPreference`.
`query.dataPath` defaults to `"edges"` and has no control.

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `selectable` | combobox | `none`, `single`, `multiple` (default: `"multiple"`) |
| `rowMultiSelectWithClick` | checkbox | Multi-select by plain click |
| `defaultSort` | transform | Object or array of objects giving the default sort |
| `showToolPanels` | checkbox | Show the right-hand tool panels (default: `true`) |
| `showStatusBar` | checkbox | Show the bottom status bar (default: `true`) |
| `enableGrouping` | checkbox | Enable row grouping (default: `true`) |
| `enableCharts` | checkbox | Enable charts from cell ranges (default: `true`) |
| `showColumnMenu` | checkbox | Show each column header's menu (default: `true`) |
| `disableColumnDragging` | checkbox | Disable drag-to-reorder columns (default: `false`) |
| `disableDragLeaveHidesColumns` | checkbox | Stop a column being hidden by dragging it out (default: `false`) |
| `enableRowDragging` | checkbox | Allow rows to be reordered by dragging (default: `false`) |
| `enableRowDragMultiRow` | checkbox | Drag several rows; needs `selectable: "multiple"` |
| `hideRowWhileDragging` | checkbox | Hide the dragged rows during the drag |
| `enableRowDragEntireRow` | checkbox | Drag from anywhere in the row, no handle needed |
| `enableRowDraggingBetweenTables` | checkbox | Allow rows to be dropped onto another table |
| `tableDropZoneList` | fieldGroup | The other tables that accept drops; each entry is `{ tableName }`. **Only visible when `enableRowDragging` and `enableRowDraggingBetweenTables` are both on** |
| `removeRowFromSrcGrid` | checkbox | Remove the row from the source table once dropped |
| `masterDetail` | checkbox | Let each row expand into a detail view built from the elements dropped into the table (default: `false`) |
| `detailHeight` | slider | Fixed height in px of the expanded detail section |
| `limitToOneActiveDetail` | checkbox | Only one detail section open at a time |
| `titleContext` | transform | Transform returning the screen's title context |
| `onDataChangeTransform` | jsonata | Transform run when the table's data changes |

**Validation**

| Field | Type | Description |
|-------|------|-------------|
| `validation.transform` | jsonata | Returns an error string, or undefined |

**View**

| Field | Type | Description |
|-------|------|-------------|
| `views` | fieldGroup | Saved column views; at least one entry once used. Each is `{ name, rowLimit (default 500), isDefault, description, columns }` |

**Advanced** — the shared data-transform, data-change-indicator and subscription sets, exactly
as on Form.

### Exposed Functions

| Function | Description |
|----------|-------------|
| `search(options?)` | Load table data. `options.rowsPerPage` (default 500), `options.pages` |
| `selectRow(rowIds)` / `deselectRow(rowIds)` / `toggleRowSelection(rowIds)` | One id or an array |
| `selectAllRows()` / `deselectAllRows()` | Whole table |
| `selectAllFiltered()` / `deselectAllFiltered()` | Rows matching the current filter |
| `setSelectedRows(rowIds)` | Replace the selection |
| `setRows(rows)` / `setData(rows)` | Replace all rows (`setData` is an alias) |
| `addRows(rows)` | Append rows |
| `updateRows(rows)` / `upsertRows(rows)` | Update, or insert-or-update |
| `deleteRows(rowsOrIds)` | Remove rows by object or id |
| `loadData(variables?)`, `getVariables(isFilter?)`, `getUpdateMutation()`, `getDeleteMutation()`, `getUpdatePayload(...)`, `getUpdatePayloadCard(...)`, `getDeletePayload()` | The shared provider set, as on Form |

### Exposed State

No declared `stateKeys`. Provider slots: `data`, `initialData`, `defaultValues`, `query`,
`selectedRows`, `currentView`.

`enableCharts` and `enableGrouping` are both confirmed working but **invisible at first paint** —
`enableCharts` adds or removes "Chart Range" in the cell context menu, `enableGrouping` adds or
removes "Group by …" in the column menu. A first-paint diff wrongly calls both inert.

*Unverified rows: `label`, `padding`, `paginated`, `pageSize`, `pageSizeOptions`, `sortable`, `filterable`, `filterForm`, `groupBy`, `groupSort`, `multiSelect`, `selectedRows`, `rowHeight`, `stickyHeader`, `striped`, `highlightOnHover`, `withBorder`, `withColumnBorders`, `draggable`, `background`, `enableBackground`, `defaultView`, `dataPath`, `onRowClick`, `onRowDoubleClick`, `onSelectionChange`, `onDragEnd`, and the four bare `__transform` keys.*

---

## Table Column

**resolvedName:** `TableColumn`
**Flags:** `isTableColumn`

One column. Must be placed **directly inside a Table** — the drop is refused anywhere else, with
no message.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `field` | graphql | Data model field the column binds to |
| `dataPath` | text | Dot-notation path to the value |
| `label` | text | Column label (default: `"Column"`) |
| `description` | text | Helper text |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `width` | text | Column width |
| `backgroundColorFieldPath` | graphql | Field supplying the cell's background color |
| `style` | transform | CSS object applied to the cell — camelCase names, CSS values |
| `headerAlign` | combobox | `left`, `center`, `right` |
| `wrapText` | switch | Wrap the cell text |
| `showColumnSuppressMenu` | checkbox | Show this column's header menu |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `format` | options | Output format: `action`, `address`, `checkmark`, `date`, `datetime`, … (default: `"text"`) |
| `durationMode` | options | How a duration renders: `humanize`, `abbreviated`, `time` |
| `timeUnit` | options | Unit a duration is cast to: `millisecond` … `year` |
| `humanizeThreshold` | integer | How many units render; `0` renders the whole duration |
| `formatString` | text | Numeral.js-style format |
| `timeZone` | transform | Time zone for the displayed value; IANA id, `setting` or `device` |
| `linkTarget` | transform | JSONata returning a navigation target, turning the cell into a link |
| `query.fields` | graphql | Extra fields pulled into the Table's query for this column |
| `menuIcon` | options | `ellipsis-v`, `ellipsis-h`, `bars`, `grip-lines` — for an `action`-format column |
| `iconSize` | options | `small`, `medium`, `large` |
| `title` | text | Tooltip on the action button |
| `isFlow` | switch | The column's menu entries are flows rather than actions |
| `actions` | fieldGroup | Action entries |
| `flows` | fieldGroup | Flow entries |
| `editable` | checkbox | Make the column editable in place |

**Validation**

| Field | Type | Description |
|-------|------|-------------|
| `validation.transform` | jsonata | Returns an error string, or undefined |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `data` | transform | Data transformation for this column |
| `sortable` | switch | Allow sorting (default: `true`) |
| `sortAsNumber` | checkbox | Sort the values numerically rather than as strings |

**The per-cell transform is `cellTransform`, not `transform`.** `cellTransform` appears in real
tenant data; `transform` appears in the registry nowhere and in no tenant. `style` is declared
here and on only three other elements, yet it is written on nine element types in production —
see the note on `style` in [SKILL.md](SKILL.md).

*Unverified rows: `transform` (renamed to `cellTransform`), `minWidth`, `resizable`, `hideable`, `filterable`, `sticky`, `selectable`, `selectedRows`, `editType`, and the four bare `__transform` keys.*

---

## Custom Fields Column

**resolvedName:** `CustomFieldsTableColumn`
**Flags:** `isTableColumn`, `isDynamicTableColumn`

Registers one column per custom field defined on a model — several columns from one element.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `field` | graphql | Data model field |
| `dataPath` | text | Dot-notation path |
| `dataModel` | options | Model whose custom fields become columns; the list is queried from the tenant |
| `label` | text | Column label (default: `"Custom Fields"`) |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `expandGroups` | switch | Expand custom-field groups automatically on table load (default: `false`) |

*Unverified rows: `customFieldModel`, `visible` — the real model picker is `dataModel`.*

---

## Dynamic Column

**resolvedName:** `DynamicTableColumn`
**Flags:** `isTableColumn`, `isDynamicTableColumn`

Registers an arbitrary set of columns computed at runtime.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `dataPath` | text | Dot-notation path |
| `label` | text | Column label (default: `"Dynamic Column"`) |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `columns` | transform | Array of objects describing the columns to render |
| `query.fields` | graphql | Extra fields pulled into the Table's query (default: `[]`) |

*Unverified rows: `columnsTransform`, `visible` — the real property is `columns`.*

---

## Cards

**resolvedName:** `Cards`
**Flags:** `canvas`, `isForm`, `isCard`, `isDataProvider`, `registersSharedState`

Iterates records and renders each as a card. **It carries `isForm`, so inputs dropped into it
satisfy `requiresForm` with no Form anywhere in the tree** — `TextInput` and `Checkbox` were
both accepted directly. Its Basic section is a container layout section, not a form one.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `filterFormName` | node / text | Filter form consumed by `search()`; declared twice, as on Table |
| `description` | text | Helper text |
| `blockNavigationWhenDirty` | checkbox | Warn before navigating away with unsaved changes (default: `true`) |
| `padding` | slider | Inner padding (default: `8`) |
| `margin` | slider | Outer margin (default: `0`) |
| `background` | combobox | `accent`, `primary`, `light`, `default`, `paper`, … |
| `customBackground` | color | Background color when `background` is custom |
| `shadow` | checkbox | Box shadow (default: `false`) |
| `borderRadius` | slider | Corner rounding (default: `0`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `flex` | flexLayout | Composite flex editor; writes top-level `flexDirection`, `flexWrap`, `alignItems`, `justifyContent` (registry `name`: `flexLayout`) |
| `hidden` | transform | Hide the cards and their container (default: `false`) |
| `flexGrow` | checkbox | Expand to fill available space (default: `false`) |

**Data** — the shared query set. `query.dataPath` defaults to `"edges"`.

**Validation** — `validation.transform`.

**Advanced** — `query.dataTransform.*` and `query.dataSubscription.*`, as on Form. Cards
declares **no** data-change-indicator fields.

### Exposed Functions

| Function | Description |
|----------|-------------|
| `search()` | Search / reload the cards — takes no arguments |
| `loadData(variables?)`, `getVariables(isFilter?)`, `getUpdateMutation()`, `getDeleteMutation()`, `getUpdatePayload(...)`, `getUpdatePayloadCard(...)`, `getDeletePayload()` | The shared provider set |

### Exposed State

No declared `stateKeys`. Provider slots: `data`, `initialData`, `defaultValues`, `query`,
`selectedRows`, `currentView`.

*Unverified rows: `cardMinWidth`, `columns`, `paginated`, `pageSize`, `pageSizeOptions`, `sortable`, `defaultSort`, `filterable`, `filterForm`, `selectable`, `multiSelect`, `visible`, `onCardClick`, `onCardDoubleClick`, `onSelectionChange` — Cards has no card-grid sizing or pagination properties of its own; lay it out with `flex`.*

---

## Scheduling Config

**resolvedName:** `SchedulingConfiguration`
**Flags:** `isDataProvider`

Loads a Scheduling Configuration, or a pending run of one, and provides it to the screen. Four
declared properties — everything else about scheduling lives in the configuration record.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `description` | text | Helper text |

**Data**

| Field | Type | Description |
|-------|------|-------------|
| `scheduler.schedulingConfigurationId` | transform | Which configuration to load when no run is provided |
| `scheduler.manageConfigurations` | display | A read-only link that navigates to the Scheduling Configuration table — no input |
| `scheduler.schedulingConfigurationRunId` | transform | View a run before committing it |

Default props seed `blockNavigationWhenDirty: true` and `scheduler: {}`; the former has no
editor control on this element but is stored.

The bundle declares no runtime contract for this element — no `fn`, no state keys. That is not
evidence it exposes none.

*Unverified rows: `query`, `resourceModel`, `resourceFields`, `workingHours`, `timeSlotDuration`.*

---

## Data Tree

**resolvedName:** `DataTreeView`
**Flags:** `canvas`, `isDataProvider`

A lazily expanded tree of records with per-level search and pagination.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `label` | transform | Tree label |
| `description` | text | Helper text |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `minWidth` | text | Minimum width |
| `maxWidth` | text | Maximum width before scrolling (default: `"100%"`) |
| `minHeight` | text | Minimum height |
| `maxHeight` | text | Maximum height before scrolling (default: `"500px"`) |
| `visible` | transform | Visibility (default: `true`) |

Note this element sizes by **min/max**, not `width` / `height`.

**Data**

| Field | Type | Description |
|-------|------|-------------|
| `query.api` | options | `Application` or `System` (default: `"Application"`) |
| `query.model` | options | Data model; list queried from the tenant |
| `query.filterPredicate` | graphqlWhere | Additional filters (default: `{}`) |
| `maxRecords` | integer | Records shown per level (default: `5`) |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `expandRoot` | transform | Expand the top level and query its records on load (default: `false`) |
| `expandFirstNode` | transform | Expand the first top-level node (default: `false`) |
| `collapseFiltersDefault` | transform | Collapse a level's search filters when its parent expands (default: `false`) |
| `hideTopLevelRootHeader` | transform | Always hide the top level's pagination and search filters (default: `false`) |
| `disabled` | transform | Disabled state (default: `false`) |

There is no `query.autoLoad`, no `query.parameters` and no `query.fields` on this element — the
tree builds its own queries per level. `expandRoot` is how you make it load anything on mount.

### Exposed Functions

The bundle declares no runtime contract for `DataTreeView`.

*Unverified rows: `parentField`, `childrenField`, `labelField`, `iconField`, `expandAll`, `lazyLoad`, `selectable`, `multiSelect`, `padding`, `width`, `height`, `onSelect`, `onExpand`, `onCollapse`.*
