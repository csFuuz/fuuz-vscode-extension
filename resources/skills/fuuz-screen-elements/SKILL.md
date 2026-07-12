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
- **Input elements** (`requiresForm: true`) must be placed inside a Form or Cards element
- **Table columns** (`isTableColumn: true`) must be placed inside a Table element
- Elements reference each other by `elementName` in expressions (e.g., `$components.Form1.fn.save()`)

---

## Element Flags

Flags are booleans set on each element's editor configuration that control how the element behaves in the designer and at runtime.

| Flag | Meaning |
|------|---------|
| `canvas` | Element accepts child elements (drop target) |
| `isContainer` | Visual container with layout properties |
| `isForm` | Provides form data context for child inputs |
| `isDataProvider` | Queries data and provides it to children |
| `isTable` | Table data context with columns, sorting, pagination |
| `isCard` | Card iteration context (like table but card layout) |
| `isButton` | Button element that can trigger actions/flows |
| `requiresForm` | Must be placed inside a Form or Cards element |
| `isTableColumn` | Must be placed inside a Table element |
| `excludeFromToolbox` | Not shown in the designer's element toolbox |

---

## Shared Field Sets for Input Elements

Most input elements share common field sets. Individual element docs reference these by name instead of repeating every field.

### Basic Fields

| Field | Type | Description |
|-------|------|-------------|
| `field` | text | System field name |
| `dataPath` | text | Dot-notation path to the model field (e.g., `name`, `customer.id`) |
| `defaultValue` | transform | Default value when no data is loaded |
| `predicate` | options | Filter predicate when used in a filter form (`_eq`, `_contains`, `_in`, etc.) |
| `formElement` | text | Parent form element name (auto-detected) |
| `label` | text | Display label |
| `description` | text | Help text shown below the input |

### Display Fields

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding in pixels (default: `8`) |
| `width` | text | CSS width (default: `"100%"`) |
| `height` | text | CSS height (default: `"auto"`) |
| `alignItems` | options | Flex alignment |
| `visible` | switch | Whether the element is visible (default: `true`) |

Display field variants:
- **with variant** — adds `variant` (options: default, filled, unstyled)
- **with font size** — adds `fontSize` (text)
- **with font size without variant** — adds `fontSize` but no `variant`

### Validation Fields

| Field | Type | Description |
|-------|------|-------------|
| `validation.required` | switch | Whether the field is required (default: `false`) |
| `uniqueValidationEnabled` | switch | Enable unique value validation (default: `false`) |
| `validation.uniqueValidation.api` | text | API for unique check |
| `validation.uniqueValidation.model` | text | Model for unique check |
| `validation.uniqueValidation.field` | text | Field for unique check |
| `validation.uniqueValidation.currentIdPath` | text | Path to current record ID |
| `validation.transform` | transform | Custom validation transform |

Validation variant — **with number validation** adds:

| Field | Type | Description |
|-------|------|-------------|
| `validation.minValue` | text | Minimum allowed value |
| `validation.maxValue` | text | Maximum allowed value |
| `validation.maxDigits` | integer | Maximum digits |
| `validation.disallowNegative` | switch | Reject negative values |
| `validation.disallowDecimals` | switch | Reject decimal values |

### Length Validation Fields

| Field | Type | Description |
|-------|------|-------------|
| `validation.minLength` | text | Minimum string length |
| `validation.maxLength` | text | Maximum string length |

### Advanced Fields

| Field | Type | Description |
|-------|------|-------------|
| `disabled` | transform | Whether the input is disabled |
| `onChange` | action | Action to run when value changes |
| `data` | json | Static data override |
| `fields` | json | Additional query fields |
| `targetDataPath` | text | Override mutation target path |

### Behavior Fields

| Field | Type | Description |
|-------|------|-------------|
| `formatString` | text | Display format string |
| `step` | text | Increment step value |

### Default Props (all inputs)

```json
{
  "padding": 8,
  "width": "100%",
  "height": "auto",
  "validation": { "required": false },
  "uniqueValidationEnabled": false,
  "visible": true
}
```

---

## Shared Data Fields

These fields appear on data provider elements (Form, Table, Cards).

### Read Preference

| Value | Description |
|-------|-------------|
| `primaryPreferred` | Read from primary replica (freshest data) |
| `secondary` | Read from secondary replica (lower latency) |

### Common Data Query Pattern

| Field | Type | Description |
|-------|------|-------------|
| `query.api` | text | API target (typically `"Application"`) |
| `query.model` | text | Data model name (e.g., `"WorkOrder"`) |
| `query.autoLoad` | switch | Auto-execute query on mount |
| `query.parameters` | transform | JSONata expression for query variables |
| `query.filterPredicate` | transform | Static where-clause filter |
| `query.fields` | json | Base fields always included in query |

### Data Subscription Pattern

| Field | Type | Description |
|-------|------|-------------|
| `query.dataSubscription.enabled` | switch | Enable real-time data subscription |
| `query.dataSubscription.topics` | json | Subscription topic strings |
| `query.dataSubscription.filterTransform` | transform | Filter incoming subscription messages |
| `query.dataSubscription.valueTransform` | transform | Transform subscription data before applying |

---

## Field Type Glossary

Field types used in element editor panels:

| Type | Description |
|------|-------------|
| `text` | Free-text string input |
| `slider` | Numeric slider with min/max |
| `checkbox` | Boolean checkbox |
| `switch` | Boolean toggle switch |
| `options` | Dropdown select from fixed options |
| `combobox` | Searchable dropdown |
| `transform` | Dual-mode: simple smartInput or advanced JSONata expression |
| `jsonata` | JSONata expression editor |
| `fieldGroup` | Group of related sub-fields |
| `border` | Border style configuration (width, style, color, radius) |
| `color` | Color picker |
| `icon` | FontAwesome icon selector |
| `integer` | Whole number input |
| `action` | Action step array configuration |
| `chart` | Chart configuration editor |
| `duration` | Duration value editor |
| `json` | Raw JSON editor |
| `graphqlWhere` | GraphQL WhereInput predicate builder |
| `graphql` | GraphQL query builder |
| `node` | Reference to another Craft.js node |

---

## Transform Fields

Transform fields support dual-mode editing:

1. **Simple mode** — A "smart input" that accepts plain values, field references, or simple expressions
2. **Advanced mode** — Full JSONata expression editor with access to the expression context (`$metadata`, `$components`, `$data`, etc.)

The stored value is a transform object:

```json
{
  "__transform": "expression or literal",
  "__dynamicFields": {
    "payload": [],
    "context": []
  }
}
```

When `__dynamicFields` has entries, the transform is treated as dynamic and re-evaluated on context changes.

---

## Element Categories

| Category | Count | Reference |
|----------|-------|-----------|
| Layout | 12 | [layout.md](layout.md) |
| Input | 41 | [input.md](input.md) |
| Data | 8 | [data.md](data.md) |
| Display | 4 | [display.md](display.md) |
| Interaction | 10 | [interaction.md](interaction.md) |

Refer to the individual reference files for complete element documentation including sections, fields, types, defaults, exposed functions, and exposed state.
