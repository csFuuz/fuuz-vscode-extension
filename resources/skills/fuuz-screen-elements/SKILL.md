---
name: fuuz-screen-elements
description: Configure Fuuz screen elements and their properties. Use when the user needs to know what props an element supports, which elements are available, element flags and shared field sets, or how to configure specific element types (inputs, layout, data, display, interaction).
---

# Fuuz Screen Elements

Screen elements are the building blocks of Fuuz screens. The screen designer uses Craft.js to compose a tree of elements on a canvas. Each element type has flags, configurable properties organized into sections, and optional exposed functions/state.

## Core Concepts

- **Canvas elements** (`canvas: true`) can contain child elements dropped onto them
- **Forms** (`isForm: true`) provide a data context — child inputs read/write through the form's data
- **Data providers** (`isDataProvider: true`) query data from a model and make it available to children
- **Input elements** (`requiresForm: true`) must have a Form or Cards **ancestor** — and since a Form
  accepts only layout containers as direct children, the working shape is Form → Container → inputs
- **Table columns** (`isTableColumn: true`) must be placed directly inside a Table element
- Elements reference each other by `elementName` in expressions (e.g., `$components.Form1.fn.save()`)

---

## Element Flags

Flags are booleans set on each element's editor configuration that control how the element behaves in the designer and at runtime. The drop-rule validators read only `requiresForm`, `isContainer`, `isTableColumn`, `isGridCell`, `isForm`, `isButton` and `isDataProvider`; the rest are behavioural or chrome hints.

| Flag | Meaning |
|------|---------|
| `canvas` | Element accepts child elements (drop target) |
| `isContainer` | Visual container with layout properties |
| `isForm` | Provides form data context for child inputs (`Form`, `Cards`) |
| `isDataProvider` | Queries data and provides it to children |
| `isTable` | Table data context with columns, sorting, pagination |
| `isCard` | Card iteration context (like table but card layout) |
| `isButton` | Button element that can trigger actions/flows |
| `isButtonGroups` | Button Group — accepts only buttons |
| `isCustomActionButton` | Toolbox preset that instantiates `ActionButton` (see Interaction) |
| `requiresForm` | Must be placed inside a form-shaped host (`Form` or `Cards`) |
| `isTableColumn` | Must be placed inside a Table element |
| `isDynamicTableColumn` | Column that registers several columns at runtime |
| `isGridCell` | Must be placed in a Container whose `layout` is `grid` |
| `isScreenWidget` | Embeds another screen |
| `isVisualization` | Renders a saved visualization |
| `registersSharedState` | Element publishes state/functions under `$components.<elementName>` |
| `defaultCreateProps` | Props merged in at create time by a toolbox preset |
| `excludeFromToolbox` | Not shown in the designer's element toolbox |

---

## Property Names Have Two Identities

Every registry property carries **both** a `name` (the editor-config field identifier) and a
`dataPath` (the prop-bag key that is actually written and stored). They differ on **158 of the
1,664** declared properties. **Always write the `dataPath`** — it is what ends up in
`definition.props` / `configuration`, and it is the key the property panel is built on.

| `name` | `dataPath` | Declared on |
|--------|------------|-------------|
| `fields` | `query.fields` | 49 elements |
| `targetDataPath` | `target.dataPath` | 42 elements |
| `flexLayout` | `flex` | `Container`, `Screen`, `Cards`, `Paper` |
| `validation.minValue` / `validation.maxValue` | `minValue` / `maxValue` | `SliderInput` only |

Everything in these reference files is documented by `dataPath`.

---

## Shared Field Sets for Input Elements

Most input elements share common field sets. Individual element docs reference these by name instead of repeating every field. Each set below is declared, by these `dataPath`s, on almost every one of the 46 elements that carry `requiresForm`.

### Basic Fields

| Field | Type | Description |
|-------|------|-------------|
| `field` | graphql | Data model field the input is bound to; picking one updates the other fields to match |
| `dataPath` | text | Dot-notation path to the model field (e.g., `name`, `customer.id`) — **required** |
| `defaultValue` | text | Default value when no data is loaded |
| `predicate` | combobox | Filter predicate when used in a filter form — `_contains`, `_containsObject`, `_eq`, `_endsWith`, `_gt`, `_gte`, `_has`, `_in`, `_isNull`, `_lt`, `_lte`, `_startsWith` |
| `formElement` | node | Parent form element name |
| `label` | transform | Display label — **required** |
| `description` | text | Helper text shown below the input |

### Display Fields

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding in pixels, 0–96 (default: `8`) |
| `width` | text | CSS width (default: `"100%"`) |
| `height` | text | CSS height (default: `"auto"`) |
| `alignItems` | combobox | `start`, `end`, `center` |
| `visible` | transform | Whether the element is visible (default: `true`) |

Display field variants — extras only some inputs declare:

| Extra | Type | Declared on |
|-------|------|-------------|
| `variant` | options | `standard`, `outlined`, `filled` — the Material-UI TextField style. 15 elements: AddressInput, ColorInput, DateInput, DateTimeInput, DurationInput, EmailInput, FloatInput, IconPicker, IntegerInput, NumberInput, Password, ScanTextInput, TextInput, TimeInput, UriInput |
| `size` | toggleButtonGroup | `small`, `medium`. 12 elements, incl. TextInput, NumberInput, IntegerInput, FloatInput, ScanTextInput, ColorInput, Password, UriInput, Image, ImageUpload |
| `labelFontSize` | slider | Label font size, 8–48. DisplayText, EmailInput, FloatInput, IntegerInput, NumberInput, OptionsInput, Password, SelectInput, TextInput, UriInput |
| `dataFontSize` | slider | Value font size, 8–48. Same set as `labelFontSize` minus DisplayText |

There is no shared `fontSize` field on inputs — `DisplayText` alone declares `fontSize`.

### Validation Fields

| Field | Type | Description |
|-------|------|-------------|
| `validation.required` | checkbox | Whether the field is required (default: `false`; `Password` defaults to `true`) |
| `uniqueValidationEnabled` | checkbox | Enable unique value validation (default: `false`) |
| `validation.unique.api` | options | `Application` or `System` — defaults to Application |
| `validation.unique.model` | text | Data model the value must be unique within |
| `validation.unique.excludeId` | checkbox | Exclude the current record from the check (defaults to true when unset) |
| `validation.unique.byFields` | fieldGroup | Additional fields the value must be unique by; when set, the current field must be listed too |
| `validation.transform` | jsonata | Returns an error string, or undefined when validation passes |

Validation variant — **with number validation** (`NumberInput`, `IntegerInput`, `FloatInput` only) adds:

| Field | Type | Description |
|-------|------|-------------|
| `validation.minValue` | transform | Minimum allowed value |
| `validation.maxValue` | transform | Maximum allowed value |
| `validation.maxDigits` | transform | Maximum digits |
| `validation.disallowNegative` | transform | Reject negative values (default: `false`) |
| `validation.disallowDecimals` | transform | Reject decimal values (default: `false`) |

`SliderInput` looks like it shares this set but does **not** — see its entry in [input.md](input.md).

### Length Validation Fields

Declared on `TextInput` and `ScanTextInput` only.

| Field | Type | Description |
|-------|------|-------------|
| `validation.minLength` | transform | Minimum string length |
| `validation.maxLength` | transform | Maximum string length |

### Advanced Fields

| Field | Type | Description |
|-------|------|-------------|
| `disabled` | transform | Whether the input is disabled |
| `onChange` | jsonata | Transform run every time the value changes |
| `data` | transform | Data transformation for this field |
| `query.fields` | graphql | Additional data model fields to pull into the parent's query (registry `name`: `fields`) |
| `target.dataPath` | text | Override the mutation target path (registry `name`: `targetDataPath`) |

`query.fields` and `target.dataPath` are the two most widely shared properties in the whole
registry — 49 and 42 declaring elements respectively — and are written under those nested
paths, never under their registry `name`s. `target` is stored as an object (`{ "dataPath": … }`).

### Behavior Fields

| Field | Type | Description |
|-------|------|-------------|
| `formatString` | text | Numeral.js-style display format (e.g. `"0.000"`). DateInput, DateTimeInput, DisplayText, FloatInput, IntegerInput, NumberInput, TimeInput |
| `step` | transform | Increment step. NumberInput, IntegerInput, FloatInput |

### Default Props (all inputs)

```json
{
  "padding": 8,
  "width": "100%",
  "height": "auto",
  "validation": { "required": false },
  "uniqueValidationEnabled": false,
  "visible": true,
  "type": "text",
  "label": "Text"
}
```

`type` and `label` are seeded per element by the registry's `defaultProps` (`"checkbox"`,
`"select"`, `"duration"`, …). `type` has no editor control, but it is present on 45 of the 46
input elements' defaults and is stored on every instance, so hand-written JSON should carry it.

### Additional Styles

`style` is a transform holding a CSS object (camelCase property names, CSS values). It is
declared by four elements only — `Container` and `Screen`-family layout is where it belongs:
`Container` (Advanced, labelled "Additional Styles"), `EmbeddedWebpage` (Advanced), `GridCell`
(Advanced), `TableColumn` (Display, labelled "Styles"). It is stored on other element types in
production, but no other element declares it.

The value is a **React inline-style object** — not CSS-in-JS and not a stylesheet. It is merged
last into the element's own inline style and handed to React. 274 declarations were measured at
runtime on the deployed platform in August 2026 (241 work, 27 inert, 4 inconclusive, 2 delivered
but overridden); the full property-by-property reference lives in the `fuuz-screen-styling`
skill. The four things that catch every author out:

- Selectors and at-rules have nowhere to land. Nested `&:hover`, `&::before`, `& div` and
  `@media` keys are all measured inert, and an `animation` shorthand reaches computed style while
  nothing animates, because a `@keyframes` rule cannot travel in the bag.
- camelCase keys are the safe spelling. Kebab-case resolves for string values (7 of 7 measured
  pairs matched) but is dropped or silently corrupted for bare numbers: `{"font-weight": 700}`
  stores, reads back byte-identical and does nothing, and `{"line-height": 1.7}` becomes `1.7px`.
- A malformed value blanks the **whole screen**, silently — a `style` holding a string or an
  array, or a `__transform` that fails or returns a non-object, leaves the app shell rendering
  and the entire screen body empty. No snackbar and no error text reach the author; a failing
  transform at least logs to the console, a non-object `style` logs nothing.
- The designer's JSON input re-quotes key names on every edit (`box-shadow` → `"box-shadow"` →
  `"\"box-shadow\""`), and a quoted name matches no CSS property. 484 stored declarations are
  already dead this way. Re-editing to fix one makes it worse; rewrite the key instead.

---

## Shared Data Fields

These fields appear on data provider elements (Form, Table, Cards). The panel labels them
without the `query.` prefix, but they are stored — and must be written — under it.

### Read Preference

| Value | Description |
|-------|-------------|
| `primaryPreferred` | Read from primary replica (freshest data) — the default |
| `secondary` | Read from secondary replica (lower latency, possibly stale; fails if all secondaries are down) |

### Common Data Query Pattern

| Field | Type | Description |
|-------|------|-------------|
| `query.api` | combobox | `Application` or `System` (default: `"Application"`) |
| `query.model` | options | Data model name (e.g., `"WorkOrder"`); the option list is queried from the tenant |
| `query.autoLoad` | checkbox | Auto-execute query on mount (default: `true`) |
| `query.parameters` | jsonata | Transform returning the query parameters |
| `query.filterPredicate` | graphqlWhere | Additional where-clause filter |
| `query.fields` | graphql | Base fields always included in the query (default: `["id"]`) |
| `query.readPreference` | combobox | See above |
| `query.dataTransform.transform` | jsonata | Transform the loaded data |
| `query.dataTransform.remote` | checkbox | Run the data transform server-side (default: `false`; turn off for `$executeFlow` against Web flows) |

`query.dataPath` and `query.query` have **no editor control** on Form or Table. They are seeded
by the registry's default props (`"edges[0]"` for Form, `"edges"` for Table) and are only
reachable by hand-editing the JSON.

### Data Change Indicators (Form, Cards)

| Field | Type | Description |
|-------|------|-------------|
| `query.disableDataChangeIndicator` | checkbox | Disable the indicator entirely (default: `false`) |
| `query.selectedDataChangeIndicator` | options | `refresh` or `newTab` |
| `dataChangeIndicatorSize` | options | `small` or `normal` (defaults to normal) |
| `enableConfirmOnDataChanged` | checkbox | Require confirmation before overwriting a document edited since load (default: `false`) |

### Data Subscription Pattern

| Field | Type | Description |
|-------|------|-------------|
| `query.dataSubscription.enabled` | checkbox | Enable real-time data subscription (default: `false`) |
| `query.dataSubscription.topics` | fieldGroup | Subscription topics (at least one required once enabled) |
| `query.dataSubscription.filterTransform` | jsonata | Only apply the message when this returns true |
| `query.dataSubscription.valueTransform` | jsonata | Returns the entire data object for the element |

---

## Field Type Glossary

Field types used in element editor panels. These are the `fieldType` values the designer's own
registry declares; the count after each is how many of the 1,664 declared properties use it.

| Type | Description |
|------|-------------|
| `text` | Free-text string input (366) |
| `transform` | Dual-mode: simple smartInput or advanced JSONata expression (291) |
| `checkbox` | Boolean checkbox (221) |
| `combobox` | Searchable dropdown (132) |
| `jsonata` | JSONata expression editor — always opens as the editor (105) |
| `slider` | Numeric slider with min/max (98) |
| `graphql` | GraphQL field selector (98) |
| `options` | Dropdown select from fixed options (97) |
| `fieldGroup` | Group of repeated sub-fields (53) |
| `node` | Reference to another Craft.js node (47) |
| `switch` | Boolean toggle switch (47) |
| `json` | Raw JSON editor (28) |
| `integer` | Whole number input (23) |
| `toggleButtonGroup` | Segmented button group, e.g. Size Small/Medium (9) |
| `color` | Color picker (8) |
| `display` | Read-only sub-header, no input (6 — all on GraphQLBuilderInput) |
| `number`, `float` | Numeric inputs (5, 1) |
| `flexLayout` | Composite flex editor; writes `flexDirection`, `flexWrap`, `alignItems`, `justifyContent` (4) |
| `array` | Repeated scalar list (3) |
| `graphqlWhere` | GraphQL WhereInput predicate builder (3) |
| `markdown`, `richText` | Markdown / Draft.js rich text editors (2, 2) |
| `action` | Action step array configuration (1 — `ActionButton.action`) |
| `border` | Border style configuration (1 — `Container.bordersInput`) |
| `chart`, `duration`, `measure`, `ratioMeasure`, `address`, `date`, `datetime`, `datetimeRange`, `time`, `uri`, `emailAddress`, `title`, `graphqlBuilder` | Purpose-built editors, one property each |

There is no `icon` field type: icon pickers render as `fieldGroup`/composite controls
(`ActionButton.icon`, `ScreenAccordion.icon`).

**Some option lists are computed, not declared.** A field's `options` can be an object carrying
a `__transform` evaluated when the panel renders — `query.model`, `baseModel`, `calendarId` and
`visualizationName` all run a `$query` against the tenant, and `ResizablePanelLayout.handle`
switches its whole list on the sibling `axis` value. For those, no static list exists, and a
data-driven picker shows only what has loaded.

---

## Transform Fields

Transform fields support dual-mode editing:

1. **Simple mode** — A "smart input" that accepts plain values, field references, or simple expressions
2. **Advanced mode** — Full JSONata expression editor with access to the expression context (`$metadata`, `$components`, `$data`, etc.)

A field of type `transform` opens in simple mode with a `</>` toggle beside it; a field of type
`jsonata` **is** the editor and has no toggle.

The stored value is a transform object — see `fuuz-screen-design` for the full contract, which
requires all four keys:

```json
{
  "__transform": "expression or literal",
  "__dynamicFields": {
    "payload": [],
    "context": []
  },
  "__cacheKey": "uniqueKey",
  "__remote": false
}
```

When `__dynamicFields` has entries, the transform is treated as dynamic and re-evaluated on context changes. A `__fallbackValue` key also appears on stored transforms.

---

## Behaviour of the Designer and the Stored Model

Things that are true of every element and are not visible from any property table.

### Placement refusals are silent

The registry declares seven rejection messages (`Table columns can only be placed directly
inside a Table`, `This element must be placed inside a Form`, `Only buttons can be placed
inside a Button Group`, …). **None of them is ever rendered.** A refused drop simply does not
create an element — no toast, no console error, no visual cue. Never treat "no error appeared"
as acceptance; check that the element exists.

### The drop rules, in full

One shared validator dispatches on the target's and the dragged element's flags:

| Condition | Outcome |
|---|---|
| dragged `isTableColumn` | only directly inside a Table |
| dragged `isContainer`, has descendants, those descendants include form inputs, target has no Form ancestor | refused |
| dragged `requiresForm`, target has no Form ancestor | refused |
| dragged `isGridCell`, target's `layout` is not `"grid"` | refused |
| into a Form | only layout containers directly |
| into a Table | only table columns |
| into a Button Group | only buttons |

### "Requires a Form" means "requires a form-shaped host"

The test is for an **ancestor** carrying `isForm`, which is `Form` *and* `Cards`. The Form
itself only accepts layout containers as direct children, so the working shape is
**Form → Container → inputs**. Every `requiresForm` element in the live sweep landed that way
and was refused both by the Screen root and by a bare Container outside a Form.

`DisplayText` really does carry `requiresForm: true` and really is refused outside a Form,
despite being a read-only display element. Proven with a control: a measured 871×400
Form-free Container accepted `Icon` and refused `DisplayText`.

### A too-small container looks exactly like a refusal

A freshly dropped empty Container renders ~32px tall, and drops aimed at it resolve to the
Screen root instead. Set its `height` before dropping into it, or a real acceptance reads as
a refusal — this was separated from the genuine `GridCell` grid rule by building two 200px
hosts differing only in `layout`.

### `TabBar` keeps its tab panels in `linkedNodes`

`TabBar.nodes` is **always empty**. Each tab panel is a `linkedNodes` entry keyed
`<elementName>Detail<index>`, holding an ordinary `Container`. At creation the element name is
not yet set, so the first key is the literal string `"undefinedDetail0"`; the key is
re-derived when the element is renamed, stranding the Container under the old key. A stranded
panel is still stored, still emitted as a `Container` element row, and renders nowhere — it is
only detectable by comparing the TabBar's `linkedNodes` map against the flat rows.

A TabBar also cannot be deleted from the Structure panel (`Edit ▸ Delete` renders disabled and
the click does nothing); select it on the canvas instead.

### The six button presets are not element types

`AddButton`, `EditButton`, `SaveButton`, `DeleteButton`, `PrintButton` and `SearchButton` are
toolbox presets. Every one of them persists as `type: "ActionButton"` with an `ActionButton`
property panel; the only record of which stub was dragged is `definition.custom.editor`.
Nothing reading a stored screen will ever see a `SaveButton`. `EditButton` additionally
declares `requiresTable: true`, which **nothing enforces** — it is toolbox chrome, not a drop
rule, and it drops happily onto a Table-free screen.

### The flat element rows can lag the design blob

`screenElement` rows are projected from `screenVersion.design`. A saved element has been
observed present in the design and absent from the flat rows across three saves, then present
on a later replay. A missing flat row is not proof the element was not stored.

### Runtime contracts are declared for 17 elements only

`ActionButton`, `CalendarInput`, `Cards`, `Chart`, `Container`, `EventConsoleAdapter`,
`FlowButton`, `Form`, `PDFViewer`, `Paper`, `Screen`, `ScreenWidget`, `SelectInput`,
`SplitButton`, `TabBar`, `Table` and `Timer` declare their `fn`/state bindings in the bundle.
For the other 67 the bundle says nothing, which is **not** evidence that they expose nothing.

### Speculative React/MUI props do nothing

`ScreenElementNode.definition` and `.configuration` are untyped JSON, so the backend accepts
and stores **any** key you send. `sx`, `elevation`, `tooltip`, `aria-label`, `data-testid` and
similar round-trip perfectly and change nothing at render. "The API accepted it" is not
evidence a property works.

### Provenance of these reference files

The element entries were reconciled against the designer's own registry in August 2026. Some
documented properties are declared by the registry nowhere and appear in no production screen;
they have been left in place rather than deleted, and each one is flagged where it sits. Where an
element entry carries an *Unverified rows* note, treat those rows as unconfirmed: nothing declares
them and no production screen stores them, so a value you set there may simply be discarded.

---

## Element Categories

The registry groups the 84 element types into six toolbox categories (Input 41, Layout 14,
Buttons 10, Display 10, Data 8, Other 1). These reference files use five files instead:

| Category | Count | Reference |
|----------|-------|-----------|
| Layout | 14 | [layout.md](layout.md) |
| Input | 47 | [input.md](input.md) |
| Data | 8 | [data.md](data.md) |
| Display | 4 | [display.md](display.md) |
| Interaction | 10 | [interaction.md](interaction.md) |

`input.md` covers the whole Input category plus the six Display-category elements that carry
`requiresForm`; `display.md` covers the four that do not. `Scheduler` is documented nowhere —
it is hidden, `Other`, and used by no tenant.

Seven types are hidden from the toolbox (`excludeFromToolbox`) and can only appear on a screen
that already contains them, or by hand-editing JSON: `Screen`, `Combobox`, `GeneralInput`,
`ImageUpload`, `Paper`, `Text`, `Scheduler`. All but `Scheduler` are documented — `Combobox` and
`Text` are still live in production despite their deprecation messages.

Refer to the individual reference files for complete element documentation including sections, fields, types, defaults, exposed functions, and exposed state.
