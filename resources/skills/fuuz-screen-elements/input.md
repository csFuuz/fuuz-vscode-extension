# Input Elements

47 elements: the registry's whole **Input** category (41 types, three of them hidden from the
toolbox) plus the six **Display**-category elements that carry `requiresForm` and behave like
inputs (`DisplayText`, `Image`, `PDFViewer`, `ProgressBar`, `SVGInput`, `Visualization`). The
four Display elements that are not form-bound live in [display.md](display.md).

Every element here except `SVGInput` carries `requiresForm: true` and must have a **`Form` or
`Cards` ancestor**. A Form accepts only layout containers as direct children, so the working
shape is **Form → Container → input**. A refused drop produces no message of any kind — see
"Placement refusals are silent" in [SKILL.md](SKILL.md).

Most inputs share the standard field sets documented in SKILL.md. Each entry below lists which
shared sets it uses and documents only **custom fields** beyond those shared sets, keyed by
**`dataPath`** — the stored key, which is not always the registry `name`.

---

## Text Inputs

### TextInput

**resolvedName:** `TextInput`
**Shared sets:** Basic, Display with variant / size / font sizes, Validation, Length Validation, Advanced

The standard single-line text input.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `multiline` | checkbox | Basic | Render as a multi-line textarea |
| `inputMode` | options | Basic | Keyboard hint for tablets and phones: `text`, `decimal`, `numeric`, `tel`, `search`, `email`, `url`, `none`. A hint only — it neither validates nor enforces a format |

`placeholder` is not declared by this element and appears in no production screen, yet it
works: the prop is spread onto the underlying native `<input>`, several levels below the
wrapper, and the **browser** honours the attribute. Treat it as a browser-level convenience,
not a platform feature — it stops working the day the element filters its props.

*Unverified row: `fontSize` — there is no shared `fontSize` on inputs; the label and value sizes are `labelFontSize` and `dataFontSize`.*

### Password

**resolvedName:** `Password`
**Shared sets:** Basic, Display with variant / size / font sizes, Validation, Advanced

Masked text input for sensitive values. **This element is named `Password`, not
`PasswordInput`** — no `PasswordInput` exists in the live resolver.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `validation.passwordPolicy` | checkbox | Validation | Apply the tenant's configured password policy to the new password (default: `false`) |

`validation.required` defaults to **`true`** here — the only input element that does.

Default props: `{ "type": "password", "label": "Password", "variant": "standard", "size": "medium", "validation": { "required": true, "passwordPolicy": false } }`

### ScanTextInput

**resolvedName:** `ScanTextInput`
**Shared sets:** Basic, Display with variant / size, Validation, Length Validation, Advanced

Text input driven by a barcode scanner. It is a keyboard-wedge reader — it watches for a
terminator character within a timeout, not a camera.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `hideIcons` | switch | Display | Hide the indicator icons at the right of the input (default: `false`) |
| `terminatorCharacters` | combobox | Behavior | Which characters end a scan: `enter`, `tab`, `space`, `custom` (default: `["enter","tab"]`) |
| `customTerminators` | array | Behavior | Exact strings that end a scan when `custom` is selected; the match is stripped from the value (e.g. `"[cr]"`) (default: `[""]`) |
| `prefixString` | text | Behavior | Prefix expected at the start of a scanned value (default: `""`) |
| `stripPrefixString` | checkbox | Behavior | Remove that prefix from the stored value (default: `true`) |
| `allowManualInput` | checkbox | Behavior | Allow keyboard typing; when off the input clears after each scan (default: `true`) |
| `scanTimeoutMilliseconds` | integer | Behavior | Window the scanner must complete within; raise for slow scanners or large barcodes (default: `200`) |
| `clearable` | checkbox | Behavior | Show the clear ✕ (default: `true`) |
| `clearOnFocus` | checkbox | Behavior | Clear the value when the input takes focus (default: `true`) |
| `autoFocus` | checkbox | Behavior | Focus on page load and after form submit; with several on one form the **last** wins (default: `false`) |
| `beepOnScan` | checkbox | Behavior | Play a beep on scan — different sounds for accepted and rejected (default: `false`) |

*Unverified rows: `scanMode`, `onScan`, `continuous`, `fontSize` — the registry declares none of them and no production screen stores them.*

### EmailInput

**resolvedName:** `EmailInput`
**Shared sets:** Basic, Display with variant / font sizes, Validation, Advanced

Email address input. `type` is seeded as `"emailAddress"`.

Custom fields: none — uses only shared sets.

### UriInput

**resolvedName:** `UriInput`
**Shared sets:** Basic, Display with variant / size / font sizes, Validation, Advanced

URI input with scheme and host validation.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `requireScheme` | checkbox | Behavior | Require a scheme (`https://`); when set and missing, the first allowed scheme is prepended on blur (default: `true`) |
| `allowedSchemes` | array | Behavior | Permitted schemes in priority order; the first is used when auto-prepending (default: `["https","http"]`) |
| `allowIp` | switch | Behavior | Accept raw IP addresses as hosts (default: `false`) |
| `allowLocalhost` | switch | Behavior | Accept `localhost`, `127.0.0.1` and `::1` (default: `false`) |

---

## Numeric Inputs

### NumberInput

**resolvedName:** `NumberInput`
**Shared sets:** Basic, Display with variant / size / font sizes, Validation with number validation, Behavior (`formatString`, `step`), Advanced

General numeric input supporting decimals. Bounds live under `validation.*`
(`validation.minValue`, `validation.maxValue`) — **not** top-level, which is where `SliderInput`
puts them.

Custom fields: none beyond shared sets.

*Unverified row: `fontSize`.*

### IntegerInput

**resolvedName:** `IntegerInput`
**Shared sets:** Basic, Display with variant / size / font sizes, Validation with number validation, Behavior (`formatString`, `step`), Advanced

Whole-number input. Defaults seed `validation.disallowNegative` and
`validation.disallowDecimals` to `false`; set `disallowDecimals` to actually reject decimals.

Custom fields: none.

*Unverified row: `fontSize`.*

### FloatInput

**resolvedName:** `FloatInput`
**Shared sets:** Basic, Display with variant / size / font sizes, Validation with number validation, Behavior (`formatString`, `step`), Advanced

Floating-point number input.

Custom fields: none.

*Unverified rows: `precision`, `fontSize` — the registry declares neither. Use `formatString` (Numeral.js, e.g. `"0.000"`) for decimal places.*

### SliderInput

**resolvedName:** `SliderInput`
**Shared sets:** Basic, Display, Validation, Advanced

Numeric slider.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `minValue` | number | Validation | Minimum value — stored **top-level**, registry `name` `validation.minValue` |
| `maxValue` | number | Validation | Maximum value — stored **top-level**, registry `name` `validation.maxValue` |
| `marks` | json | Behavior | Slider tick marks (default: `[]`) |
| `includeNumberField` | checkbox | Behavior | Render a number field alongside the slider (default: `false`) |

**SliderInput is the one element where bounds are not under `validation.`.** Its panel writes
`minValue` / `maxValue` at the top level; the `validation.minValue` / `validation.maxValue` keys
its default props also seed are **inert** and stay `null`. Anyone copying the `NumberInput`
shape into a Slider gets no bounds and no error. This is the only place in the registry where
a property's `name` is a nested path and its `dataPath` is not.

*Unverified rows: `min`, `max`, `step`, `showValue` — the registry declares none of them.*

---

## Date & Time Inputs

### DateInput

**resolvedName:** `DateInput`
**Shared sets:** Basic, Display with variant, Validation, Behavior (`formatString`), Advanced

Date picker.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `timeOfDay` | combobox | Basic | Time of day the chosen date resolves to: `now`, `startOf`, `endOf` (default: `"now"`) |
| `timeZone` | transform | Behavior | Time zone for the displayed value — an IANA identifier, or `setting` (tenant/user setting) or `device` (browser). Falls back to tenant → user → browser when unset |

*Unverified rows: `minDate`, `maxDate`, `dateFormat`, `clearable` — the registry declares none of them; use `formatString` for display format.*

### TimeInput

**resolvedName:** `TimeInput`
**Shared sets:** Basic, Display with variant, Validation, Behavior (`formatString`), Advanced

Time picker.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `timeZone` | transform | Behavior | Time zone for the displayed value; same contract as `DateInput.timeZone` |

*Unverified rows: `format`, `step`, `clearable`.*

### DateTimeInput

**resolvedName:** `DateTimeInput`
**Shared sets:** Basic, Display with variant, Validation, Behavior (`formatString`), Advanced

Combined date and time picker.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `timeZone` | transform | Behavior | Time zone for the displayed value; same contract as `DateInput.timeZone` |

*Unverified rows: `minDate`, `maxDate`, `dateFormat`, `clearable`.*

### DateRangeInput

**resolvedName:** `DateRangeInput`
**Shared sets:** Basic, Display, Validation, Advanced

Two-field date range selector (start and end). Its value is a relative-preset
descriptor `{ data: { unit, offset, range, base }, label }` (e.g. "This week"),
NOT ISO dates — resolve it to start/end in a transform before querying.
`type` is seeded as `"datetimeRange"`.

The registry declares no custom properties for this element: the preset switches below are
**not** in the bundle's property list, but they were established against a live screen and are
kept here as observed behaviour.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `includePrevious` | switch | Behavior | Show "previous / last …" presets (default true) |
| `includeCurrent` | switch | Behavior | Show "this / current …" presets (default true) |
| `includeNext` | switch | Behavior | Show "next / upcoming …" (future) presets — set **false** to hide future options (default true) |
| `includeCustom` | switch | Behavior | Allow an absolute custom range (default true) |

**Do NOT use `minDate` / `maxDate` on `DateRangeInput`** — they are not honored
by this element (unlike `DateInput` / `DateTimeInput`, where they work). To keep
the picker in the past, set `includeNext: false` (hides the future presets); if
you also allow `includeCustom`, clamp a future custom end to "now" in your
resolver transform (e.g. `$ed := $edRaw > $now() ? $now() : $edRaw`).
Verified 2026-07-08 on the Downtime Dashboard screen. A stray `maxDate` does show up in tenant
data, which corroborates that people try it — it is stored and does nothing.

*Unverified rows: `startField`, `endField`, `dateFormat`, `variant`.*

### DurationInput

**resolvedName:** `DurationInput`
**Shared sets:** Basic, Display with variant, Validation, Advanced

ISO-8601 duration input. `type` is seeded as `"duration"`.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `enabledUnits` | options | Display | Which duration fields render: `years`, `months`, `days`, `hours`, `minutes`, `seconds` |
| `showHumanizedDuration` | checkbox | Display | Also render the duration in words, e.g. "1 minute 30 seconds" (default: `false`) |
| `showDurationString` | checkbox | Display | Also render the generated ISO-8601 string, e.g. `PT56M` (default: `false`) |

Default props include `"mode": "full"`, which has no editor control but is stored on every
instance.

*Unverified rows: `units`, `outputFormat` — the real unit selector is `enabledUnits`.*

---

## Boolean Inputs

### Checkbox

**resolvedName:** `Checkbox`
**Shared sets:** Basic, Display, Validation, Advanced

Standard boolean checkbox.

Custom fields: none — uses only shared sets.

*Unverified rows: `indeterminate`, `color`.*

### Switch

**resolvedName:** `Switch`
**Shared sets:** Basic, Display, Validation, Advanced

Toggle switch for boolean values.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `labelLeft` | text | Basic | Label rendered to the **left** of the switch (the shared `label` renders to the right) |

*Unverified rows: `onLabel`, `offLabel`, `color`, `size`.*

---

## Selection Inputs

### SelectInput

**resolvedName:** `SelectInput`
**Flags:** `requiresForm`, `registersSharedState`
**Shared sets:** Basic, Display with font sizes, Validation, Advanced

Dropdown select bound to a data model. The most configurable input in the registry, and the one
whose documented property names had drifted furthest from the platform.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `api` | combobox | Data | `Application` or `System` (default: `"Application"`) |
| `dataModel` | combobox | Data | Model queried for options; the list is loaded from the tenant |
| `selectFields` | graphql | Data | Fields from the model shown in the selection popup |
| `orderByField` | text | Data | String field to order options by |
| `orderByDirection` | combobox | Data | `asc` or `desc` |
| `optionLimit` | integer | Data | Options fetched per page (default: `5`) |
| `optionLimitFlex` | integer | Data | Show up to this many *extra* options when doing so would show them all, so the user need not click through (default: `5`) |
| `dialogMode` | options | Behavior | Select through a filterable table dialog: `never`, `always`, `advanced` (from advanced search) (default: `"never"`) |
| `multiselect` | checkbox | Behavior | Allow several values; changes the stored value to an array (default: `false`) |
| `isClearable` | checkbox | Behavior | Allow clearing the selection (default: `true`) — **the real name; `clearable` is not this element's property** |
| `selectAll` | checkbox | Behavior | With `multiselect`, offer a "Select all" link (default: `true`) |
| `searchPredicate` | options | Behavior | Match mode while typing: `contains`, `startsWith`, `endsWith`, `eq` (default: `"contains"`) |
| `linkTarget` | transform | Behavior | JSONata returning a navigation target for the selected value |
| `alwaysReloadOptions` | checkbox | Behavior | Re-query options every time the list opens (default: `false`) |
| `additionalFields` | graphql | Advanced | Extra fields queried alongside `selectFields`; part of the input's data but not shown |
| `additionalFilter` | transform | Advanced | Extra filter applied to the option query |
| `autoFill` | checkbox | Advanced | Select automatically when the query returns exactly one result |
| `autoClear` | checkbox | Advanced | Clear the value when an `additionalFilter` change invalidates it |
| `labelPath` | text | Advanced | Path within the option object used as its display label |
| `stateTracking` | options | Advanced | Store the `full` option object or just its `id` (default: `"full"`) |

#### Exposed Functions

| Function | Description |
|----------|-------------|
| `loadOptions(limitResults?)` | Reload the select's options |

*Unverified rows: `optionSource`, `optionModel`, `optionLabelField`, `optionValueField`, `optionQuery`, `optionFilter`, `staticOptions`, `searchable`, `multi`, `creatable`, `onCreate` — an entire alternative vocabulary the registry declares nowhere. `clearable` is a confirmed rename to `isClearable`.*

### OptionsInput

**resolvedName:** `OptionsInput`
**Shared sets:** Basic, Display with font sizes, Validation, Advanced

Select over a **static or computed** option list rather than a data model. Same behaviour
vocabulary as `SelectInput`, minus the query.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `options` | transform | Data | The option list — an array of strings or of objects |
| `optionLimit` | integer | Data | Options shown per page (default: `5`) |
| `optionLimitFlex` | integer | Data | Extra options shown when that would show them all (default: `5`) |
| `selectFields` | json | Data | Fields from each option to show in the popup |
| `multiselect` | checkbox | Behavior | Allow several values (default: `false`) |
| `isClearable` | checkbox | Behavior | Allow clearing (default: `true`) |
| `selectAll` | checkbox | Behavior | Offer "Select all" with `multiselect` (default: `true`) |
| `searchPredicate` | options | Behavior | `contains`, `startsWith`, `endsWith`, `eq` (default: `"contains"`) |
| `linkTarget` | transform | Behavior | JSONata returning a navigation target |
| `labelPath` | text | Advanced | Path within the option object used as its label |
| `stateTracking` | options | Advanced | Store the `full` object or just the `id` (default: `"id"` — the opposite of SelectInput) |

*Unverified rows: `orientation`, `variant` — this is not a radio group.*

### TimeZoneInput

**resolvedName:** `TimeZoneInput`
**Shared sets:** Basic, Display, Validation (`validation.required` only), Advanced

Time zone selector, pre-populated with the IANA zones plus `setting` and `device`. Shares the
option-list behaviour vocabulary.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `multiselect` | checkbox | Behavior | Allow several zones (default: `false`) |
| `isClearable` | checkbox | Behavior | Allow clearing (default: `true`) |
| `selectAll` | checkbox | Behavior | Offer "Select all" with `multiselect` (default: `true`) |
| `searchPredicate` | options | Behavior | `contains`, `startsWith`, `endsWith`, `eq` (default: `"contains"`) |
| `labelPath` | text | Advanced | Path within the option object used as its label |
| `stateTracking` | options | Advanced | `full` or `id` (default: `"id"`) |

This element declares only `validation.required` from the Validation set — no unique validation.

*Unverified rows: `variant`, `uniqueValidationEnabled`.*

### Combobox (hidden, deprecated)

**resolvedName:** `Combobox`
**Flags:** `requiresForm`, `excludeFromToolbox`

The predecessor of `SelectInput`. Hidden from the toolbox and carrying a deprecation message,
but still live on screens in at least one tenant, so it is documented for maintenance.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `options` | transform | Data | Option list — array of strings or objects |
| `api` | combobox | Data | `Application` or `System` (default: `"Application"`) |
| `queryType` | combobox | Data | Data model queried for options; the list is computed by a JSONata `__transform` against the tenant |
| `orderByField` | text | Data | String field to order by |
| `orderByDirection` | combobox | Data | `asc` or `desc` |
| `optionLimit` | integer | Data | Limit the number of options |
| `multiselect` | checkbox | Behavior | Allow several values (default: `false`) |
| `isClearable` | checkbox | Behavior | Allow clearing (default: `true`) |
| `linkTarget` | transform | Behavior | JSONata returning a navigation target |
| `additionalFields` | text | Advanced | Extra fields to query with the combobox data |
| `additionalFilter` | transform | Advanced | Extra filter for the option query |
| `autoFill` | checkbox | Advanced | Auto-select a sole result |
| `autoClear` | checkbox | Advanced | Clear when a filter change invalidates the value |
| `labelField` | text | Advanced | Field used as the option label |
| `labelPath` | text | Advanced | Path within the option object used as the label |

Note `queryType`, not `dataModel` — one of several places where `Combobox` and `SelectInput`
disagree on names for the same idea.

---

## Color & Styling

### ColorInput

**resolvedName:** `ColorInput`
**Shared sets:** Basic, Display with variant / size, Validation, Advanced

Color picker input.

Custom fields: none — uses only shared sets.

*Unverified rows: `format`, `swatches`, `alpha`.*

### IconPicker

**resolvedName:** `IconPicker`
**Shared sets:** Basic (no `field` / `defaultValue` / `predicate`), Display with variant / size, Validation, Advanced

FontAwesome icon selector. Its value is an icon descriptor object, not a string.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `totalItems` | slider | Basic | Query size — how many icons the picker fetches |
| `simplified` | checkbox | Basic | Simplified picker mode |
| `hideColor` | checkbox | Basic | Hide the color control |
| `hideSize` | checkbox | Basic | Hide the size control |
| `hideVariant` | checkbox | Basic | Hide the variant control |
| `color` | combobox | Basic | Default icon color: `textPrimary`, `textSecondary`, `primary`, `secondary`, `disabled` (default: `"primary"`) |

There is no `icon` field type in the registry — icon pickers render as composite controls.

---

## Complex / Structured Inputs

### AddressInput

**resolvedName:** `AddressInput`
**Shared sets:** Basic, Display with variant / size, Validation, Advanced

Composite address input. `type` is seeded as `"address"`, and the element renders its own
sub-fields; there are no per-part visibility switches.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `schema` | json | Validation | JSON Schema used to validate JSON / JSONobj values |

*Unverified rows: `showLines`, `showCity`, `showState`, `showPostalCode`, `showCountry`.*

### MeasureInput

**resolvedName:** `MeasureInput`
**Shared sets:** Basic, Display, Validation, Advanced

Value + unit-of-measure input (e.g. `5 kg`). `type` is seeded as `"measure"`. Tenant data also
carries a `unitType` key that the registry does not declare.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `schema` | json | Validation | JSON Schema used to validate JSON / JSONobj values |

*Unverified rows: `measureType`, `unitField`, `valueField`, `variant`.*

### RatioMeasureInput

**resolvedName:** `RatioMeasureInput`
**Shared sets:** Basic, Display, Validation, Advanced

Ratio of two measures (e.g. `5 kg / 10 L`). `type` is seeded as `"ratioMeasure"`.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `validation.passwordPolicy` | checkbox | Validation | Present in the registry, labelled "Password Policy" — almost certainly a copy-paste from `Password`. Do not rely on it |

*Unverified rows: `numeratorType`, `denominatorType`, `variant`.*

### ArrayInput

**resolvedName:** `ArrayInput`
**Shared sets:** Basic (no `predicate`), Display, Validation, Advanced

Manages an array of scalar values. The item editor is chosen by `itemType`, not by a child
element — there is no template slot.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `itemType` | transform | Basic | Editor used for each item: `text`, `integer`, `float`, `checkbox`, `address`, `date`, `time`, `datetime`, `uri` |
| `itemProps` | transform | Basic | Props passed to every item; evaluated **once** and applied to all of them |
| `validation.minItems` | integer | Validation | Minimum number of items |
| `validation.maxItems` | integer | Validation | Maximum number of items |

Note the bounds are `validation.minItems` / `validation.maxItems`, not bare `minItems` /
`maxItems`.

*Unverified rows: `itemTemplate`, `addLabel`, `sortable`, `minItems`, `maxItems`, `predicate`.*

### CustomFieldsInput

**resolvedName:** `CustomFieldsInput`
**Shared sets:** Basic (`field`, `dataPath`, `label` only), Display, Advanced (`disabled` only)

Renders the custom fields defined on a data model. Declares **no** validation set at all.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `dataModel` | options | Basic | Model whose custom fields are generated; the list is queried from the tenant |
| `expandGroups` | switch | Behavior | Expand custom-field groups automatically on load |

*Unverified rows: `customFieldModel`, `layout`, plus `defaultValue`, `predicate`, `formElement`, `onChange`, `data`, `validation`, `uniqueValidationEnabled` — this element declares far less of the shared sets than the other inputs.*

### GeneralInput (hidden, deprecated)

**resolvedName:** `GeneralInput`
**Flags:** `requiresForm`, `excludeFromToolbox`

A single input whose editor is chosen at configure time. Superseded by the per-type elements.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `type` | combobox | Basic | Which editor to render: `text`, `number`, `date`, `time`, `datetime`, `integer`, `float`, `measure`, `ratioMeasure`, `address` (default: `"text"`) |
| `schema` | json | Validation | JSON Schema used to validate JSON / JSONobj values |

This is the one element where `type` is an editor-controlled property rather than a seeded
default.

---

## Rich Text & Code Inputs

### RichTextInput

**resolvedName:** `RichTextInput`
**Shared sets:** Basic, Display, Validation, Advanced

Draft.js rich text editor.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `defaultToDisplayMode` | checkbox | Display | Open in read-only display mode rather than edit mode |

*Unverified rows: `toolbar`, `minHeight`.*

### MarkdownInput

**resolvedName:** `MarkdownInput`
**Shared sets:** Basic, Display, Validation, Advanced

Markdown editor.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `defaultToDisplayMode` | checkbox | Display | Open in rendered-preview mode rather than edit mode |

*Unverified rows: `preview`, `minHeight` — `defaultToDisplayMode` is the real preview switch.*

### CodeEditorInput

**resolvedName:** `CodeEditorInput`
**Shared sets:** Basic, Display, Validation, Advanced

Code editor with syntax highlighting.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `mode` | transform | Editor | Language mode: `html`, `css`, `python`, `sql`, `text`, `xml` (default: `"text"`) |
| `collapsible` | switch | Editor | Show a collapse control on the field |
| `collapsedByDefault` | switch | Editor | Start the field collapsed |

The language list is exactly those six — there is no `javascript`, `json` or `graphql` mode.
Default props also seed `"stringify": false` and `"value": ""`, neither of which has a control.

*Unverified rows: `language`, `lineNumbers`, `readOnly`, `minHeight`.*

### JSONataInput

**resolvedName:** `JSONataInput`
**Shared sets:** Basic, Display, Validation, Advanced

JSONata expression editor. Default props seed `"snippets": ["jsonata"]`.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `smartInput` | json | Behavior | Smart-input configuration converting the field to another input type |
| `collapsible` | switch | Behavior | Show a collapse control on the field |
| `collapsedByDefault` | switch | Behavior | Start the field collapsed |

*Unverified row: `contextData`.*

### TransformInput

**resolvedName:** `TransformInput`
**Shared sets:** Basic, Display, Validation, Advanced

Editor for a transform object — the dual-mode (simple / advanced) control itself, exposed as a
form input.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `smartInput` | json | Behavior | Smart-input configuration converting the field to another input type |
| `advanced` | switch | Behavior | Show the payload and cache-key controls |

*Unverified row: `contextFields`.*

---

## JSON & Schema Inputs

### JSONInput

**resolvedName:** `JSONInput`
**Shared sets:** Basic, Display, Validation, Advanced

Monaco-backed JSON editor.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `direction` | options | Display | Form-field direction: `horizontal` or `vertical` |
| `dataModel` | options | Editor | When set with a selected field, the editor loads that field's JSON Schema from the model |
| `showSchemaFields` | switch | Editor | Show the schema-derived fields |
| `schema` | transform | Editor | JSON Schema for the value |
| `collapsible` | switch | Editor | Show a collapse control on the field |
| `collapsedByDefault` | switch | Editor | Start the field collapsed |
| `showEditor` | switch | Editor | Render the editor at all (default: `true`) |
| `editorOptions` | json | Editor | Extra Monaco `IStandaloneEditorConstructionOptions` |

*Unverified row: `minHeight`.*

### JSONSchemaInput

**resolvedName:** `JSONSchemaInput`
**Shared sets:** Basic, Display, Validation, Advanced

Editor for a JSON Schema **document** — its value *is* a schema. `type` is seeded as
`"jsonSchema"`.

Custom fields: none — uses only shared sets.

*Unverified rows: `schema`, `uiSchema` — this element edits a schema, it does not take one.*

### JSONSchemaPredicateInput

**resolvedName:** `JSONSchemaPredicateInput`
**Shared sets:** Basic (no `predicate`), Display, Advanced

Builds a filter predicate over data shaped by a JSON Schema. `type` is seeded as
`"jsonPredicate"`. Declares **no** validation set.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `schema` | transform | Behavior | The JSON Schema describing the data this filter applies to |

---

## GraphQL Inputs

### GraphQLBuilderInput

**resolvedName:** `GraphQLBuilderInput`
**Shared sets:** Basic, Display, Validation, Advanced

Visual GraphQL query/mutation builder. The most property-dense input in the registry; every
switch below trims the tree view or the arg editors.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `api` | options | Behavior | `Application` or `System` (default: `"Application"`) |
| `baseModel` | options | Behavior | Model the statement is built against; list queried from the tenant |
| `mutationType` | options | Behavior | `create`, `update`, `upsert`, `delete` — used when `mode` is `mutation` |
| `mode` | options | Behavior | Output format: `query`, `mutation`, `ast`, `fields` (default: `"query"`) |
| `rootNodeType` | options | Behavior | Tree root: `connection` or `nodeFields` (default: `"connection"`) — `nodeFields` pairs with the `fields` mode |
| `singleSelect` | switch | Behavior | Allow only one field to be selected (default: `false`) |
| `filterType` | text | Behavior | Show only fields whose type matches this value (e.g. `String`) |
| `rootLevelOnly` | switch | Behavior | Hide relations; root-level fields only (default: `false`) |
| `excludeAuditFields` | switch | Behavior | Hide `createdAt`, `createdByUser`, … (default: `false`) |
| `excludeAggregate` | switch | Behavior | Hide `_aggregate` fields (default: `false`) |
| `aggregateOnly` | switch | Behavior | Show only `_aggregate` fields |
| `autoOpenBaseFields` | switch | Behavior | Auto-expand the root connection / edge / node (default: `true`) |
| `argModes.inline` | switch | Behavior | Allow inline args embedded in the statement (default: `true`) |
| `argModes.json` | switch | Behavior | Allow editing inline args as JSON (default: `false`) |
| `argModes.variable` | switch | Behavior | Allow variable-bound args (default: `true`) |
| `argModes.transform` | switch | Behavior | Allow transform-driven args — **only works with the `ast` mode** (default: `false`) |
| `enableBaseModelChange` | switch | Behavior | Let the user change the base model (default: `true`) |
| `enableVariablesDrawer` | switch | Behavior | Enable the variables drawer (default: `true`) |
| `enableCodeDrawer` | switch | Behavior | Enable the raw-GraphQL drawer (default: `true`) |
| `enableFilter` | switch | Behavior | Enable the field-name filter box (default: `true`) |

`modelText`, `outputText`, `fieldsText`, `argModeText` and `featuresText` are `display`-type
sub-headers with no input — they are the registry's only use of that field type.

*Unverified row: `model` — the real property is `baseModel`.*

### WrappedGraphQLPredicate

**resolvedName:** `WrappedGraphQLPredicate`
**Shared sets:** Basic (no `field` / `predicate`), Display, Advanced

A GraphQL WhereInput predicate builder wrapped as a form input. Declares no validation set and
no custom properties: it is configured almost entirely through its defaults.

Default props: `{ "type": "graphqlWhere", "dataPath": "predicate", "target": { "dataPath": "_and.0" } }` —
it writes into the enclosing filter form's `_and` array by default, which is why it needs no
`field`.

*Unverified rows: `api`, `model`, `maxDepth`, `field`, `predicate`.*

---

## File & Media Inputs

### FileUpload

**resolvedName:** `FileUpload`
**Shared sets:** Basic (no `defaultValue` / `predicate`), Display, Validation, Advanced

File upload input. Files reach flows as base64 in `file.content`.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `multiple` | checkbox | Behavior | Allow several files |
| `accept` | array | Behavior | Accepted MIME types |
| `minSize` | integer | Behavior | Minimum file size in bytes (default: `0`) |
| `maxSize` | integer | Behavior | Maximum file size in bytes |

Default props include `"dataFormat": "base64"` and `"meta": {}`, neither of which has a control
on this element.

*Unverified rows: `uploadAction`, `defaultValue`, `predicate`.*

### ImageUpload (hidden, deprecated)

**resolvedName:** `ImageUpload`
**Flags:** `requiresForm`, `excludeFromToolbox`
**Shared sets:** Basic, Display with size, Validation, Advanced

Image-specific upload input, superseded by `FileUpload`.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `multiple` | checkbox | Behavior | Allow several image files |
| `dataFormat` | combobox | Behavior | `file` or `base64` |

### Image

**resolvedName:** `Image`
**Category:** Display (form-bound)
**Shared sets:** Basic, Display with size, Advanced (`query.fields` only)

Image display bound to a data field. Declares no validation set.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `title` | transform | Basic | Image title |
| `src` | transform | Advanced | Path to the image to embed |
| `thumbnailSrc` | transform | Advanced | Path to a thumbnail rendered in place of the full image |

*Unverified rows: `alt`, `fit`, `fallback`, plus `disabled`, `onChange`, `data`.*

### PDFViewer

**resolvedName:** `PDFViewer`
**Category:** Display (form-bound)
**Flags:** `requiresForm`, `registersSharedState`
**Shared sets:** Basic, Display, Advanced (`query.fields` only)

PDF viewer. Every header control is a transform, so any of them can be driven from state.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `pdf` | transform | Behavior | The file to render — a Fuuz file ID, a publicly reachable URL, or base64 data |
| `zoom` | transform | Behavior | `actualSize`, `pageFit`, `pageWidth`, or a percentage (50–400) (default: `"pageFit"`) |
| `page` | transform | Behavior | Page to display (default: `1`) |
| `showHeader` | transform | Behavior | Show the viewer header (default: `true`) |
| `enableDownload` | transform | Behavior | Show the download button (default: `true`) |
| `enablePrint` | transform | Behavior | Show the print button (default: `true`) |
| `enableZoomControls` | transform | Behavior | Show the zoom controls (default: `true`) |
| `enablePageControls` | transform | Behavior | Show the page controls (default: `true`) |
| `showFilename` | transform | Behavior | Show the filename in the header (default: `true`) |

#### Exposed Functions

| Function | Description |
|----------|-------------|
| `setPage(page)` | Go to a page number |
| `nextPage()` / `previousPage()` | Step through pages |
| `setZoom(zoom)` | Set a scale number or one of `actualSize`, `pageFit`, `pageWidth` |
| `zoomIn()` / `zoomOut()` | Step the zoom |
| `download()` | Download the PDF |
| `print()` | Print the PDF |

*Unverified rows: `src`, `showToolbar`, `defaultZoom` — the real names are `pdf`, `showHeader`, `zoom`.*

### SVGInput

**resolvedName:** `SVGInput`
**Category:** Display
**Flags:** none — **the one element in this file that does not require a Form**

Renders an SVG string. It declares only `label`, `description` and the Display set, and no
validation, no `field`, no `dataPath` — despite being named "Input".

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `labelAlignment` | options | Basic | `left`, `center`, `right` |
| `inputSVG` | transform | Basic | The SVG string to render |

Default props include `"useFlexGrow": true`, which has no editor control but is stored.

*Unverified rows: `minHeight`, plus `field`, `dataPath`, `defaultValue`, `formElement`, `predicate`, `disabled`, `onChange`, `data` — this element is not form-bound.*

---

## Display-Type Inputs

These elements are bound to form data (`requiresForm: true`) but display values rather than
editing them. `DisplayText` genuinely enforces the Form requirement despite being read-only —
a measured 871×400 Form-free Container accepted `Icon` and silently refused `DisplayText`.

### DisplayText

**resolvedName:** `DisplayText`
**Shared sets:** Basic, Display (no `alignItems`) with `labelFontSize`, Behavior (`formatString`), Advanced

Read-only display of a data value. Declares **no** validation set. 1,875 production instances
across four tenants — the most-used element in this file, and the one whose real properties
were most completely undocumented.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `justifyContent` | combobox | Display | Horizontal alignment: `start`, `end`, `center`, `space-between`, `space-around` (default: `"start"`) |
| `alignTextItems` | combobox | Display | Vertical alignment: `start`, `end`, `center` (default: `"start"`) |
| `labelPosition` | combobox | Display | Label placement: `column` (above), `row` (left), `null` (none) |
| `labelFontColor` | color | Display | Label color; overrides the icon color |
| `fontSize` | combobox | Display | Value font size: `h1`–`h5`, `body1`, … (default: `"body1"`) — the only element declaring `fontSize` |
| `fontColor` | color | Display | Value color; overrides the icon color |
| `format` | combobox | Behavior | Display format by data type: `address`, `boolean`, `date`, `datetime`, `integer`, … |
| `durationMode` | options | Behavior | How a duration renders: `humanize`, `abbreviated`, `time` |
| `timeUnit` | options | Behavior | Unit a duration is cast to: `millisecond` … `year` |
| `humanizeThreshold` | integer | Behavior | How many units render — `PT1H40M` with `1` gives "1 hour", with `2` gives "1 hour 40 minutes", `0` gives all |
| `timeZone` | transform | Behavior | Time zone for the displayed value; same contract as `DateInput.timeZone` |
| `linkTarget` | transform | Behavior | JSONata returning a navigation target, turning the value into a link |
| `linkProps` | json | Behavior | Props passed to that link |
| `text` | text | Behavior | Literal text rendered instead of a bound value |

`labelFontSize` and `fontSize` take typography scale names (`h1`…`h5`, `body1`), not the 8–48
pixel slider the other inputs use.

*Unverified rows: `prefix`, `suffix`, `copyable`, `alignItems` — `alignTextItems` is this element's vertical alignment.*

### ProgressBar

**resolvedName:** `ProgressBar`
**Category:** Display (form-bound)
**Shared sets:** Basic, Display, Advanced

Progress bar bound to a numeric field. Declares no validation set; the range is set explicitly
rather than assumed to be 0–100.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `barHeight` | slider | Display | Bar height in px (default: `8`) |
| `borderRadius` | slider | Display | Corner rounding (default: `0`) |
| `barColor` | transform | Display | Color of the filled portion |
| `rootColor` | transform | Display | Color of the track behind the bar |
| `minNumber` | transform | Behavior | Lowest value in the range (default: `0`) |
| `maxNumber` | transform | Behavior | Highest value in the range (default: `100`) |

*Unverified rows: `color`, `size`, `showLabel`, `striped`, `animated`.*

### Visualization

**resolvedName:** `Visualization`
**Category:** Display (form-bound)
**Flags:** `requiresForm`, `isVisualization`
**Shared sets:** Basic, Display

Renders a saved `Visualization` record, or an ad-hoc chart type. Declares no validation set and
no Advanced set. Default `height` is `"400px"`.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `enableBackground` | checkbox | Display | Draw the background card; off makes it transparent (default: `true`) |
| `visualizationSetting` | combobox | Behavior | `Saved Visualization` or `Chart Type` |
| `visualizationName` | combobox | Behavior | Which saved visualization to load; the list is queried from the tenant |
| `visualizationChartType` | combobox | Behavior | Chart type when not using a saved visualization |
| `visualizationConfiguration` | json | Behavior | Configuration object applied to the chart |
| `visualizationTransform` | jsonata | Behavior | Transform applied to the payload; runs only when the saved visualization has no transform of its own |
| `visualizationTransformRemote` | checkbox | Behavior | Run that transform server-side (default: `true`) |
| `visualizationParameters` | transform | Behavior | Object provided as the visualization's payload |
| `autoRefreshSeconds` | integer | Behavior | Reload interval in seconds |
| `syncTimeseriesRange` | checkbox | Behavior | Share a timeseries range with other charts on the screen that also set this (default: `false`) |

*Unverified rows: `chartConfig`, `background`, plus `disabled`, `onChange`, `data`.*

---

## Recurrence

### RRuleInput

**resolvedName:** `RRuleInput`
**Shared sets:** Basic, Display, Validation, Advanced

iCalendar RRULE editor. `type` is seeded as `"rrule"`.

| Field | Type | Section | Description |
|-------|------|---------|-------------|
| `showRuleString` | checkbox | Display | Render the generated RRULE string; clicking it copies to the clipboard (default: `false`) |
| `enableTimeZone` | checkbox | Advanced | Let the user set the rule's time zone; when off the tenant setting is shown (default: `false`) |

*Unverified rows: `frequencies`, `maxOccurrences`.*
