# Transformation

Nodes for converting data between formats and reshaping arrays. Many of these nodes share a common pattern of `inputTransform`, `outputTransform`, and `enableAdvancedConfiguration` properties.

---

## Filter Array

| | |
|---|---|
| **Name** | `filterArray` |
| **Title** | Filter Array |
| **Responsibility** | transition |
| **Description** | Filters items in an array. The filter transform operates in the context of a single record. Use `$i` to access the index, `$a` for the overall array, and `$$` to reference the input payload. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `inputTransform` | string | jsonata | No | Transform to reformat the input payload. Default: `"$"`. |
| `filterTransform` | string | jsonata | Yes | Transform checked against each item. Return true to keep, false to remove. Bindings: `$i` (index), `$a` (array), `$$` (root payload). |
| `outputTransform` | string | jsonata | No | Transform to format the output. Default: `"$"`. |
| `enableAdvancedConfiguration` | boolean | -- | No | Enables Input/Output transforms. Default: `false`. |

Standard output port.

**Validation:** minimumNoteLength: 20, requireChangedName, requireInputNode, requireWalkthrough

### Example Configuration

```json
{
  "filterTransform": "status = 'active' and quantity > 0"
}
```

---

## Flatten Array (JSON To CSV)

| | |
|---|---|
| **Name** | `jsonToCsv` |
| **Title** | JSON To CSV |
| **Responsibility** | transition |
| **Description** | Converts an array of JSON objects to a CSV string. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `inputTransform` | string | jsonata | No | Transform to reformat the input payload. Default: `"$"`. |
| `fieldDelimiterTransform` | string | jsonata | Yes | Field separator. Options: Comma (`,`), Pipe (`|`), Semicolon (`;`). |
| `fieldWrapTransform` | string | jsonata | Yes | Character wrapping field values. Options: Double Quote (`"`), Single Quote (`'`). |
| `endOfLineTransform` | string | -- | Yes | End-of-line delimiter. Options: Line Feed (`\n`), Carriage Return (`\r`), Tab (`\t`), CR+LF (`\r\n`). Default: `"\n"`. |
| `outputTransform` | string | jsonata | No | Transform to format the output. Default: `"$"`. |
| `enableAdvancedConfiguration` | boolean | -- | Yes | Enables Input/Output/Advanced transforms. Default: `false`. |
| `advancedConfigurationTransform` | jsonata | jsonata | No | Advanced configuration for the binding. |

Standard output port.

**Validation:** minimumNoteLength: 20, requireChangedName, requireInputNode, requireWalkthrough

---

## Unflatten Array (CSV To JSON)

| | |
|---|---|
| **Name** | `csvToJson` |
| **Title** | CSV To JSON |
| **Responsibility** | transition |
| **Description** | Transforms a CSV string to a JSON object. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `inputTransform` | string | jsonata | Yes | Transform to reformat the input payload. Default: `"$"`. |
| `fieldDelimiterTransform` | string | jsonata | Yes | Field separator. Options: Comma (`,`), Pipe (`|`), Semicolon (`;`). |
| `wrapDelimiterTransform` | string | jsonata | Yes | Character wrapping field values. Options: Double Quote (`"`), Single Quote (`'`). |
| `eolDelimiterTransform` | string | jsonata | Yes | End-of-line delimiter. Default: `"\n"`. Options: Line Feed, Carriage Return, Tab, CR+LF. |
| `outputTransform` | string | jsonata | No | Transform to format the output. Default: `"$"`. |
| `enableAdvancedConfiguration` | boolean | -- | Yes | Enables Input/Output/Advanced transforms. Default: `false`. |
| `advancedConfigurationTransform` | jsonata | jsonata | No | Advanced configuration for the binding. |

Standard output port.

**Validation:** minimumNoteLength: 20, requireChangedName, requireInputNode, requireWalkthrough

---

## JSON To XML

| | |
|---|---|
| **Name** | `jsonToXml` |
| **Title** | JSON To XML |
| **Responsibility** | transition |
| **Description** | Transforms JSON input to XML. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `inputTransform` | string | jsonata | Yes | Transform to reformat the input. Default: `"$"`. |
| `attributeKeyTransform` | string | jsonata | Yes | Prefix for accessing attributes. Options: `$`, `@`. |
| `charKeyTransform` | string | jsonata | Yes | Prefix for character content. Options: Underscore (`_`), Hash (`#`). |
| `rootNameTransform` | string | jsonata | Yes | Name of the root element. |
| `outputTransform` | string | jsonata | No | Transform to format the output. Default: `"$"`. |
| `enableAdvancedConfiguration` | boolean | -- | Yes | Enables Input/Output/Advanced transforms. Default: `false`. |
| `advancedConfigurationTransform` | jsonata | jsonata | No | Advanced configuration for the binding. |

Standard output port.

**Validation:** minimumNoteLength: 20, requireChangedName, requireInputNode, requireWalkthrough

---

## XML To JSON

| | |
|---|---|
| **Name** | `xmlToJson` |
| **Title** | XML To JSON |
| **Responsibility** | transition |
| **Description** | Transforms XML input to a JSON object. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `inputTransform` | string | jsonata | Yes | Transform to reformat the input. Default: `"$"`. |
| `attributeKeyTransform` | string | jsonata | Yes | Prefix for accessing attributes. Options: `$`, `@`. |
| `charKeyTransform` | string | jsonata | Yes | Prefix for character content. Options: Underscore (`_`), Hash (`#`). |
| `outputTransform` | string | jsonata | No | Transform to format the output. Default: `"$"`. |
| `enableAdvancedConfiguration` | boolean | -- | Yes | Enables Input/Output/Advanced transforms. Default: `false`. |
| `advancedConfigurationTransform` | jsonata | jsonata | No | Advanced configuration for the binding. |

Standard output port.

**Validation:** minimumNoteLength: 20, requireChangedName, requireInputNode, requireWalkthrough

---

## For Each (Map Array)

| | |
|---|---|
| **Name** | `predicateFilter` |
| **Title** | Predicate Filter |
| **Responsibility** | transition |
| **Description** | Filters a payload by given predicates. Works on both arrays and objects. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `inputTransform` | string | jsonata | No | Transform to reformat the input. Default: `"$"`. |
| `payloadType` | string | jsonata | Yes | Whether the payload is an array or object. Options: `Array` (`array`), `Object` (`object`). |
| `predicateFilterTransform` | string | jsonata | Yes | Predicate to filter the payload by. |
| `caseSensitiveComparison` | boolean | -- | Yes | Whether filtering is case sensitive. Default: `false`. |
| `outputTransform` | string | jsonata | No | Transform to format the output. Default: `"$"`. |
| `enableAdvancedConfiguration` | boolean | -- | Yes | Enables Input/Output/Advanced transforms. Default: `false`. |

Standard output port.

**Validation:** minimumNoteLength: 20, requireChangedName, requireInputNode, requireWalkthrough

---

## Group (Group Array)

| | |
|---|---|
| **Name** | `groupBy` |
| **Title** | Group Array |
| **Responsibility** | transition |
| **Description** | Groups data from the input into an object based on the Group By transform. Items matching the condition are added to the output object; non-matching items are ignored. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `inputTransform` | string | jsonata | No | Transform to reformat the input. Default: `"$"`. |
| `groupingTransform` | string | jsonata | Yes | Condition to group items by. |
| `outputTransform` | string | jsonata | No | Transform to format the output. Default: `"$"`. |
| `enableAdvancedConfiguration` | boolean | -- | Yes | Enables Input/Output transforms. Default: `false`. |

Standard output port.

**Validation:** minimumNoteLength: 20, requireChangedName, requireInputNode, requireWalkthrough

### Example Configuration

```json
{
  "groupingTransform": "status"
}
```

---

## Sort Array (Unique Array)

| | |
|---|---|
| **Name** | `uniqueArray` |
| **Title** | Unique Array |
| **Responsibility** | transition |
| **Description** | Removes duplicate items from an array using a uniqBy function. Items are evaluated one at a time; if the transform returns a value already seen, the item is dropped. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `inputTransform` | string | jsonata | No | Transform to reformat the input. Default: `"$"`. |
| `uniqueTransform` | string | jsonata | Yes | Transform to evaluate each item. Duplicate return values cause items to be dropped. |
| `outputTransform` | string | jsonata | No | Transform to format the output. Default: `"$"`. |
| `enableAdvancedConfiguration` | boolean | -- | Yes | Enables Input/Output transforms. Default: `false`. |

Standard output port.

**Validation:** minimumNoteLength: 20, requireChangedName, requireInputNode, requireWalkthrough

### Example Configuration

```json
{
  "uniqueTransform": "id"
}
```
