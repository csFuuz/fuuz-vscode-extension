# Input Elements

41 input elements organized by subcategory. All require a parent Form or Cards element (`requiresForm: true`).

Most inputs share the standard field sets documented in SKILL.md. Each entry below lists which shared sets it uses and only documents **custom fields** beyond those shared sets.

---

## Text Inputs

### TextInput

**resolvedName:** `TextInput`
**Shared sets:** Basic, Display with variant and font size, Validation, Length Validation, Advanced

The standard single-line text input.

Custom fields: none — uses only shared sets.

### PasswordInput

**resolvedName:** `PasswordInput`
**Shared sets:** Basic, Display with variant, Validation, Advanced

Masked text input for sensitive values.

Custom fields: none.

### ScanTextInput

**resolvedName:** `ScanTextInput`
**Shared sets:** Basic, Display with variant and font size, Validation, Advanced

Text input with barcode/QR scanning support. Activates the device camera or scanner.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `scanMode` | options | Behavior | Scan mode: `camera`, `scanner`, `both` |
| `onScan` | action | Behavior | Action after successful scan |
| `continuous` | switch | Behavior | Keep scanning after first read |

---

## Numeric Inputs

### NumberInput

**resolvedName:** `NumberInput`
**Shared sets:** Basic, Display with variant and font size, Validation with number validation, Behavior (step), Advanced

General numeric input supporting decimals.

Custom fields: none beyond shared sets.

### IntegerInput

**resolvedName:** `IntegerInput`
**Shared sets:** Basic, Display with variant and font size, Validation with number validation, Behavior (step), Advanced

Whole-number input. Disallows decimals.

Custom fields: none.

### FloatInput

**resolvedName:** `FloatInput`
**Shared sets:** Basic, Display with variant and font size, Validation with number validation, Behavior (step), Advanced

Floating-point number input.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `precision` | integer | Behavior | Decimal places |

### SliderInput

**resolvedName:** `SliderInput`
**Shared sets:** Basic, Display, Validation, Advanced

Numeric slider with min/max range.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `min` | text | Behavior | Minimum value (default: `0`) |
| `max` | text | Behavior | Maximum value (default: `100`) |
| `step` | text | Behavior | Step increment (default: `1`) |
| `marks` | json | Behavior | Slider tick marks |
| `showValue` | switch | Display | Show current value label |

---

## Date & Time Inputs

### DateInput

**resolvedName:** `DateInput`
**Shared sets:** Basic, Display with variant, Validation, Advanced

Date picker.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `minDate` | transform | Behavior | Earliest selectable date |
| `maxDate` | transform | Behavior | Latest selectable date |
| `dateFormat` | text | Behavior | Display format (default: `"MM/DD/YYYY"`) |
| `clearable` | switch | Behavior | Allow clearing value (default: `true`) |

### TimeInput

**resolvedName:** `TimeInput`
**Shared sets:** Basic, Display with variant, Validation, Advanced

Time picker.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `format` | options | Behavior | 12-hour or 24-hour |
| `step` | integer | Behavior | Minute step interval |
| `clearable` | switch | Behavior | Allow clearing value |

### DateTimeInput

**resolvedName:** `DateTimeInput`
**Shared sets:** Basic, Display with variant, Validation, Advanced

Combined date and time picker.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `minDate` | transform | Behavior | Earliest selectable date |
| `maxDate` | transform | Behavior | Latest selectable date |
| `dateFormat` | text | Behavior | Display format |
| `clearable` | switch | Behavior | Allow clearing value |

### DateRangeInput

**resolvedName:** `DateRangeInput`
**Shared sets:** Basic, Display with variant, Validation, Advanced

Two-field date range selector (start and end). Its value is a relative-preset
descriptor `{ data: { unit, offset, range, base }, label }` (e.g. "This week"),
NOT ISO dates — resolve it to start/end in a transform before querying.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `startField` | text | Basic | Data path for start date |
| `endField` | text | Basic | Data path for end date |
| `includePrevious` | switch | Behavior | Show "previous / last …" presets (default true) |
| `includeCurrent` | switch | Behavior | Show "this / current …" presets (default true) |
| `includeNext` | switch | Behavior | Show "next / upcoming …" (future) presets — set **false** to hide future options (default true) |
| `includeCustom` | switch | Behavior | Allow an absolute custom range (default true) |
| `dateFormat` | text | Behavior | Display format |

**Do NOT use `minDate` / `maxDate` on `DateRangeInput`** — they are not honored
by this element (unlike `DateInput` / `DateTimeInput`, where they work). To keep
the picker in the past, set `includeNext: false` (hides the future presets); if
you also allow `includeCustom`, clamp a future custom end to "now" in your
resolver transform (e.g. `$ed := $edRaw > $now() ? $now() : $edRaw`).
Verified 2026-07-08 on the Downtime Dashboard screen.

### DurationInput

**resolvedName:** `DurationInput`
**Shared sets:** Basic, Display with variant, Validation, Advanced

Duration value input (hours, minutes, seconds).

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `units` | options | Behavior | Displayed units: `hours`, `minutes`, `seconds`, `all` |
| `outputFormat` | options | Behavior | Stored format: `iso`, `seconds`, `milliseconds` |

---

## Boolean Inputs

### Checkbox

**resolvedName:** `Checkbox`
**Shared sets:** Basic, Display, Validation, Advanced

Standard boolean checkbox.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `indeterminate` | switch | Behavior | Support indeterminate state |
| `color` | color | Display | Check color |

### Switch

**resolvedName:** `Switch`
**Shared sets:** Basic, Display, Validation, Advanced

Toggle switch for boolean values.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `onLabel` | text | Display | Label when on |
| `offLabel` | text | Display | Label when off |
| `color` | color | Display | Switch color |
| `size` | options | Display | Switch size |

---

## Selection Inputs

### SelectInput

**resolvedName:** `SelectInput`
**Shared sets:** Basic, Display with variant, Validation, Advanced

Dropdown select for relations and enums. One of the most configurable inputs.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `optionSource` | options | Data | Source: `model`, `enum`, `static`, `transform` |
| `optionModel` | text | Data | Model to query for options |
| `optionLabelField` | text | Data | Field for option display label |
| `optionValueField` | text | Data | Field for option value |
| `optionQuery` | transform | Data | Custom query for options |
| `optionFilter` | transform | Data | Filter expression for options |
| `staticOptions` | json | Data | Static option list: `[{ label, value }]` |
| `searchable` | switch | Behavior | Enable search/filter (default: `true`) |
| `clearable` | switch | Behavior | Allow clearing (default: `true`) |
| `multi` | switch | Behavior | Allow multi-select (default: `false`) |
| `creatable` | switch | Behavior | Allow creating new options |
| `onCreate` | action | Behavior | Action when creating new option |
| `query.fields` | json | Advanced | Additional query fields for relations |

### OptionsInput

**resolvedName:** `OptionsInput`
**Shared sets:** Basic, Display, Validation, Advanced

Inline options display (radio buttons or segmented control).

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `options` | json | Data | Option list: `[{ label, value }]` |
| `orientation` | options | Display | `horizontal` or `vertical` |
| `variant` | options | Display | `radio`, `segmented`, `button` |

### TimeZoneInput

**resolvedName:** `TimeZoneInput`
**Shared sets:** Basic, Display with variant, Validation, Advanced

Time zone selector dropdown, pre-populated with all IANA time zones.

Custom fields: none — uses only shared sets.

---

## Color & Styling

### ColorInput

**resolvedName:** `ColorInput`
**Shared sets:** Basic, Display, Validation, Advanced

Color picker input.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `format` | options | Behavior | Color format: `hex`, `rgb`, `hsl` |
| `swatches` | json | Behavior | Predefined color swatches |
| `alpha` | switch | Behavior | Allow alpha channel |

### IconPicker

**resolvedName:** `IconPicker`
**Shared sets:** Basic, Display, Validation, Advanced

FontAwesome icon selector.

Custom fields: none.

---

## Complex / Structured Inputs

### AddressInput

**resolvedName:** `AddressInput`
**Shared sets:** Basic, Display with variant, Validation, Advanced

Composite address input with line fields, city, state, postal code, and country.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `showLines` | switch | Display | Show address lines (default: `true`) |
| `showCity` | switch | Display | Show city field (default: `true`) |
| `showState` | switch | Display | Show state field (default: `true`) |
| `showPostalCode` | switch | Display | Show postal code (default: `true`) |
| `showCountry` | switch | Display | Show country field (default: `true`) |
| `query.fields` | json | Advanced | Sub-field paths (lines, city, state, postalCode, country) |

### MeasureInput

**resolvedName:** `MeasureInput`
**Shared sets:** Basic, Display with variant, Validation with number validation, Advanced

Value + unit-of-measure input (e.g., `5 kg`).

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `measureType` | text | Data | Unit-of-measure type (e.g., `weight`, `length`) |
| `unitField` | text | Data | Data path for the unit ID |
| `valueField` | text | Data | Data path for the numeric value |
| `query.fields` | json | Advanced | Sub-fields for value and unit |

### RatioMeasureInput

**resolvedName:** `RatioMeasureInput`
**Shared sets:** Basic, Display with variant, Validation with number validation, Advanced

Ratio of two measures (e.g., `5 kg / 10 L`).

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `numeratorType` | text | Data | Numerator measure type |
| `denominatorType` | text | Data | Denominator measure type |
| `query.fields` | json | Advanced | All sub-fields for both measures |

### ArrayInput

**resolvedName:** `ArrayInput`
**Shared sets:** Basic, Display, Validation, Advanced

Manages an array of values. Each item rendered from a template.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `itemTemplate` | node | Configuration | Template element for each array item |
| `addLabel` | text | Display | Label for "Add" button |
| `sortable` | switch | Behavior | Allow drag-to-reorder items |
| `maxItems` | integer | Validation | Maximum array length |
| `minItems` | integer | Validation | Minimum array length |

### CustomFieldsInput

**resolvedName:** `CustomFieldsInput`
**Shared sets:** Basic, Display, Validation, Advanced

Renders dynamic custom fields based on the model's custom field definitions. Fields are generated at runtime from metadata.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `customFieldModel` | text | Data | Model with custom field definitions |
| `layout` | options | Display | Field layout: `vertical`, `horizontal`, `grid` |

---

## Rich Text & Code Inputs

### RichTextInput

**resolvedName:** `RichTextInput`
**Shared sets:** Basic, Display, Validation, Advanced

WYSIWYG rich text editor with toolbar.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `toolbar` | json | Configuration | Toolbar button configuration |
| `minHeight` | text | Display | Minimum editor height |

### MarkdownInput

**resolvedName:** `MarkdownInput`
**Shared sets:** Basic, Display, Validation, Advanced

Markdown editor with preview mode.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `preview` | switch | Display | Show preview pane (default: `false`) |
| `minHeight` | text | Display | Minimum editor height |

### CodeEditorInput

**resolvedName:** `CodeEditorInput`
**Shared sets:** Basic, Display, Validation, Advanced

Code editor with syntax highlighting.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `language` | options | Configuration | Syntax language (javascript, json, graphql, etc.) |
| `minHeight` | text | Display | Minimum editor height |
| `lineNumbers` | switch | Display | Show line numbers (default: `true`) |
| `readOnly` | switch | Behavior | Read-only mode |

### JSONataInput

**resolvedName:** `JSONataInput`
**Shared sets:** Basic, Display, Validation, Advanced

JSONata expression editor with evaluation preview.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `contextData` | json | Configuration | Test context data for preview |

### TransformInput

**resolvedName:** `TransformInput`
**Shared sets:** Basic, Display, Validation, Advanced

Transform editor supporting the dual-mode (simple/advanced) editing pattern. Stores a transform object.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `contextFields` | json | Configuration | Available context fields for the transform |

---

## JSON & Schema Inputs

### JSONInput

**resolvedName:** `JSONInput`
**Shared sets:** Basic, Display, Validation, Advanced

Raw JSON editor.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `minHeight` | text | Display | Minimum editor height |
| `schema` | json | Validation | JSON Schema for validation |

### JSONSchemaInput

**resolvedName:** `JSONSchemaInput`
**Shared sets:** Basic, Display, Validation, Advanced

Form auto-generated from a JSON Schema definition. Renders appropriate inputs for each schema property.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `schema` | json | Configuration | JSON Schema definition |
| `uiSchema` | json | Configuration | UI customization for generated fields |

---

## GraphQL Inputs

### GraphQLBuilderInput

**resolvedName:** `GraphQLBuilderInput`
**Shared sets:** Basic, Display, Validation, Advanced

Visual GraphQL query builder. Lets users construct queries by selecting fields from the schema.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `api` | text | Configuration | Target API for schema introspection |
| `model` | text | Configuration | Root model |

### WrappedGraphQLPredicate

**resolvedName:** `WrappedGraphQLPredicate`
**Shared sets:** Basic, Display, Validation, Advanced

Visual GraphQL WhereInput predicate builder. Constructs filter objects visually.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `api` | text | Configuration | Target API |
| `model` | text | Configuration | Model for WhereInput type |
| `maxDepth` | integer | Configuration | Max nesting depth |

---

## File & Media Inputs

### FileUpload

**resolvedName:** `FileUpload`
**Shared sets:** Basic, Display, Validation, Advanced

File upload input with drag-and-drop support.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `accept` | text | Behavior | Accepted file types (MIME or extensions) |
| `maxSize` | integer | Validation | Maximum file size in bytes |
| `multiple` | switch | Behavior | Allow multiple files |
| `uploadAction` | action | Behavior | Custom upload action |

### Image

**resolvedName:** `Image`
**Shared sets:** Basic, Display, Validation, Advanced

Image display bound to a data field. Can show uploaded images or URLs.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `src` | transform | Configuration | Image source URL or data path |
| `alt` | text | Display | Alt text |
| `fit` | options | Display | Object-fit: `contain`, `cover`, `fill`, `none` |
| `fallback` | text | Display | Fallback image URL |

### PDFViewer

**resolvedName:** `PDFViewer`
**Shared sets:** Basic, Display, Advanced

PDF document viewer.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `src` | transform | Configuration | PDF source URL or data path |
| `showToolbar` | switch | Display | Show PDF toolbar (default: `true`) |
| `defaultZoom` | text | Display | Initial zoom level |

### SVGInput

**resolvedName:** `SVGInput`
**Shared sets:** Basic, Display, Validation, Advanced

SVG content input/editor.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `minHeight` | text | Display | Minimum editor height |

---

## Display-Type Inputs

These elements are bound to form data (`requiresForm: true`) but display values rather than editing them.

### DisplayText

**resolvedName:** `DisplayText`
**Shared sets:** Basic, Display with font size, Advanced

Read-only text display bound to a data field. Formats the value using `formatString`.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `formatString` | text | Behavior | Display format pattern |
| `prefix` | text | Display | Text before value |
| `suffix` | text | Display | Text after value |
| `copyable` | switch | Behavior | Show copy-to-clipboard button |

### ProgressBar

**resolvedName:** `ProgressBar`
**Shared sets:** Basic, Display, Advanced

Progress bar bound to a numeric field (0-100).

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `color` | color | Display | Bar color |
| `size` | options | Display | Bar height |
| `showLabel` | switch | Display | Show percentage label |
| `striped` | switch | Display | Striped pattern |
| `animated` | switch | Display | Animate stripes |

### Visualization

**resolvedName:** `Visualization`
**Shared sets:** Basic, Display, Advanced

Chart/visualization bound to form data. Uses the chart configuration editor.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `chartConfig` | chart | Configuration | Full chart configuration |
| `enableBackground` | switch | Display | Enable background color |
| `background` | color | Display | Background color |

---

## Recurrence

### RRuleInput

**resolvedName:** `RRuleInput`
**Shared sets:** Basic, Display, Validation, Advanced

Recurrence rule editor following the iCalendar RRULE specification. Lets users define repeating schedules.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `frequencies` | json | Configuration | Allowed frequencies (daily, weekly, monthly, yearly) |
| `maxOccurrences` | integer | Validation | Maximum occurrences |
