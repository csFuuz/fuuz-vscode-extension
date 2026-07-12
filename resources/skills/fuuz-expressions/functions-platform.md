# Platform Functions (182 Custom Bindings)

All custom bindings registered by the Fuuz/MFGx platform. These are available in both JSONata and JavaScript contexts (with `$` prefix).

---

## Core -- General Utility

| Function | Description |
|----------|-------------|
| `$cuid()` | Generate a CUID (collision-resistant unique identifier). |
| `$uuid()` | Generate a V4 UUID. |
| `$throw(message, info?)` | Throw an error. `info` object attached to error's data property. |
| `$coalesce(array)` | Return first non-null/undefined value from array. |
| `$identity(value)` | Return value unchanged (identity function). |
| `$tryCatch(fn, catchFn)` | Wrap `fn` in try/catch; `catchFn(error, ...originalArgs)` called on error. Returns wrapped function. |
| `$nullIf(value, compare)` | Return `null` if value equals compare; otherwise return value. |
| `$wait(ms)` | Pause execution for `ms` milliseconds. |
| `$retry(fn, options?, failedFn?)` | Return function that retries `fn` up to `retries` times (default 5) with `delay` ms (default 1000). Optional `failedFn` runs on each failure. |
| `$cronConverter(cronString, timezone?)` | Parse cron string, return cron-converter object. Default timezone `"Etc/UTC"`. |

---

## Core -- Type Predicates

| Function | Description |
|----------|-------------|
| `$isArray(value)` | True if value is an array. |
| `$isString(value)` | True if value is a string. |
| `$isBoolean(value)` | True if value is a boolean. |
| `$isInteger(value)` | True if value is a safe integer. |
| `$isFloat(value)` | True if value is a finite float (integers count). |
| `$isNumber(value)` | True if value is a finite number. |
| `$isObject(value)` | True if value is a plain object. |
| `$isUndefined(value)` | True if value is undefined. |
| `$isNil(value)` | True if value is null or undefined. |
| `$isNaN(value)` | True if value is NaN. |
| `$isEmpty(value)` | True if empty array, object, or string. |
| `$isNilOrEmpty(value)` | True if undefined, null, or empty array/object/string. |
| `$isNotNilOrEmpty(value)` | Logical NOT of `$isNilOrEmpty`. |
| `$pathSatisfies(object, path, fn)` | True if predicate `fn` returns truthy for value at dot-path. |

---

## Core -- Conversion

| Function | Description |
|----------|-------------|
| `$arrayToCsv(array, options?)` | Convert array of objects to CSV string. |
| `$csvToArray(string, options?)` | Convert CSV string to array of objects. |
| `$epcToUrn(epc, options?)` | Convert hex RFID EPC to URN object `{companyPrefix, assetType, serialNum, urn}`. |
| `$numeral(value)` | Create numeral.js object for number formatting/parsing. |
| `$parseInt(string, base?)` | Parse string to integer with radix (default 10). Returns undefined on failure. |
| `$parseNumber(value)` | Parse value to number via numeral.js. Returns undefined on failure. |
| `$decimalToString(array, encoding?)` | Decode byte array to string. Default encoding `"utf-8"`. |
| `$numberToWords(number, locale?, options?)` | Number to written words. Supports currency options. Default locale `"en-US"`. |
| `$jsonToJsonSchema(json, options?)` | Generate JSON Schema from JSON. Options: `{required, arrays: {mode}}`. |
| `$jsonToMarkdown(array)` | Convert JSON array to markdown via json2md format. |

---

## Core -- String

| Function | Description |
|----------|-------------|
| `$startsWith(string, pattern)` | True if string starts with pattern. |
| `$endsWith(string, pattern)` | True if string ends with pattern. |
| `$camelCase(string)` | Convert to lowerCamelCase. |
| `$snakeCase(string)` | Convert to snake_case. |
| `$kebabCase(string)` | Convert to kebab-case. |
| `$startCase(string)` | Convert to Start Case. |
| `$lowerFirst(string)` | Lowercase first character. |
| `$upperFirst(string)` | Uppercase first character. |
| `$pluralize(word, locale)` | Pluralize word using grammatical rules. |
| `$singularize(word, locale)` | Singularize word using grammatical rules. |
| `$htmlEscape(string)` | Escape `&<>"'` to HTML entities. |
| `$htmlUnescape(string)` | Convert HTML entities back to characters. |
| `$uriEscape(string)` | URI encode (preserves `?=/&`). |
| `$uriUnescape(string)` | URI decode. |
| `$uriEscapeComponent(string)` | Full URI component encode. |
| `$uriUnescapeComponent(string)` | Full URI component decode. |
| `$convertCharacterSet(string, target, source?)` | Re-encode string between character encodings. Default source `"utf8"`. |
| `$parseUrl(string)` | Parse URL to object `{protocol, host, pathname, query, ...}`. |
| `$urlStringify(params, options?)` | Object to querystring. |
| `$urlJoin(array)` | Join URL path segments, normalizing slashes. |
| `$removeLeadingValues(string, value)` | Remove all leading occurrences of value. |
| `$replaceLeadingValues(string, value, replacement)` | Replace all leading occurrences of value with replacement. |
| `$getContrastText(backgroundColor)` | Return `"#212121"` or `"#fff"` for contrast against background color. |
| `$evalHandlebarsTemplate(template, fields, options?)` | Evaluate Handlebars template `{{placeholders}}` with field values. |
| `$parseExpression(string)` | Parse JSONata expression to AST. |
| `$parseGraphQLStatement(string)` | Parse GraphQL statement to AST. |

---

## Core -- Rich Text / Markdown

| Function | Description |
|----------|-------------|
| `$markdownToHtml(string)` | Convert markdown to HTML. |
| `$richTextToMarkdown(draftContent)` | Convert RawDraftContent (Draft.js) to markdown. |
| `$markdownToRichText(string)` | Convert markdown to RawDraftContent. |
| `$plainTextToRichText(string)` | Convert plain text to RawDraftContent. |
| `$richTextToPlainText(draftContent)` | Convert RawDraftContent to plain text. |
| `$richTextToHTML(draftContent)` | Convert RawDraftContent to HTML. |

---

## Core -- Object

| Function | Description |
|----------|-------------|
| `$path(object, path)` | Get value at dot-path or path array. |
| `$omit(object, keys)` | Return object without specified keys. |
| `$pick(object, keys)` | Return object with only specified keys. |
| `$values(object)` | Return array of all values. |
| `$has(object, property)` | True if property exists on object. |
| `$toPairs(object)` | Convert to `[[key, value], ...]` pairs. |
| `$fromPairs(pairs)` | Convert `[[key, value], ...]` to object. |
| `$mapValues(object, fn)` | Map over values. `fn(value, key, obj)`. |
| `$mapKeys(object, fn)` | Map over keys. `fn(value, key, obj)`. |
| `$mergeDeep(array)` | Recursive deep merge of objects array. Arrays at same path concatenated. |
| `$jsonParse(string)` | Parse JSON string to value. |
| `$jsonStringify(value, options?)` | Serialize to JSON string. Options: `{space}` for indentation. |
| `$flattenObject(object, options?)` | Flatten nested object to dot-keyed single level. Options: `{delimiter, safe, maxDepth}`. |
| `$unflattenObject(object, options?)` | Reverse flatten. Options: `{delimiter, object, overwrite}`. |
| `$objectDiff(before, after, options?)` | Compare two objects. With `{detailed: true}` returns `{added, deleted, updated}`. `{ignore: [...]}` excludes paths. |

---

## Core -- Array

| Function | Description |
|----------|-------------|
| `$chunk(array, size)` | Split into groups of `size`. Last chunk may be smaller. |
| `$uniq(array)` | Remove duplicates (reference equality for objects). |
| `$flatten(array, depth?)` | Flatten nested arrays to `depth` (default 1). |
| `$first(array)` | First element. |
| `$last(array)` | Last element. |
| `$takeFirst(array, n?)` | First n elements. |
| `$takeLast(array, n?)` | Last n elements. |
| `$dropFirst(array, n)` | All but first n elements. |
| `$dropLast(array, n)` | All but last n elements. |
| `$partition(array, predFn)` | Split into `[matches, nonMatches]`. |
| `$groupBy(array, keyFn)` | Group by key function result. Returns `{key: [items]}`. |
| `$indexBy(array, keyFn)` | Like `$groupBy` but keeps only last item per key. |
| `$uniqBy(array, keyFn)` | Remove duplicates by key function. Keeps first occurrence. |
| `$findFirst(array, predFn)` | First element where predFn returns true. |
| `$findLast(array, predFn)` | Last element where predFn returns true. |
| `$findFirstIndex(array, predFn)` | Index of first match. |
| `$findLastIndex(array, predFn)` | Index of last match. |
| `$flatMap(array, fn)` | Map then flatten one level. |
| `$partitionBetween(array, beginFn, endFn, options?)` | Partition into groups bounded by begin/end predicates. Options: `{includeEndElement}`. |
| `$all(array, predFn)` | True if ALL elements satisfy predicate. |
| `$any(array, predFn)` | True if ANY element satisfies predicate. |

---

## Core -- Parallel Execution

For async operations. Default parallelism is 8.

| Function | Description |
|----------|-------------|
| `$mapParallel(array, mapFn, parallelism?)` | Map with concurrent execution. |
| `$mapValuesParallel(object, mapFn, parallelism?)` | Map object values with concurrent execution. |
| `$filterParallel(array, filterFn, parallelism?)` | Filter with concurrent predicate evaluation. |
| `$groupByParallel(array, keyFn, parallelism?)` | Group by key with concurrent key-function calls. |
| `$timesParallel(count, fn, parallelism?)` | Execute function N times in parallel (functional for-loop). |

---

## Core -- Predicate Filters

| Function | Description |
|----------|-------------|
| `$predicateFilter(payload, predicates, options?)` | Filter using GraphQL-style operators (`_eq`, `_in`, `_gt`, `_lt`, `_contains`, etc.). Default case-insensitive. Options: `{caseSensitiveComparison}`. |

---

## Core -- Schema Validation

| Function | Description |
|----------|-------------|
| `$validateSchema(value)` | True if value is a valid JSON Schema. |
| `$validateJson(data, schema)` | Validate data against JSON Schema. Returns data if valid; throws on invalid. |
| `$isValidJson(data, schema)` | True if data matches schema; false otherwise. |

---

## Core -- Tree

| Function | Description |
|----------|-------------|
| `$visitPreorder(treeOrForest, visitor)` | Preorder traversal of nested objects. `visitor(node, branchName, parentNode, parentBranchName)` can transform nodes. |

---

## Semver (28 functions)

Semantic versioning functions. All accept optional `loose?` boolean for lenient parsing.

**Parsing:** `$semverParse(v)`, `$semverValid(v)`, `$semverClean(v)`, `$semverCoerce(v, opts)`

**Components:** `$semverMajor(v)`, `$semverMinor(v)`, `$semverPatch(v)`, `$semverPrerelease(v)`

**Mutation:** `$semverInc(v, release, loose?, id?)` -- increment by `major|minor|patch|premajor|preminor|prepatch|prerelease`

**Diff:** `$semverDiff(v1, v2)` -- returns diff type string or null

**Comparison:** `$semverCompare(v1, v2)`, `$semverRcompare(v1, v2)`, `$semverCompareLoose(v1, v2)`, `$semverCompareBuild(v1, v2)`, `$semverGt(v1, v2)`, `$semverLt(v1, v2)`, `$semverEq(v1, v2)`, `$semverNeq(v1, v2)`, `$semverGte(v1, v2)`, `$semverLte(v1, v2)`, `$semverCmp(v1, op, v2)`

**Sorting:** `$semverSort(versions)`, `$semverRsort(versions)`

**Ranges:** `$semverSatisfies(v, range)`, `$semverMaxSatisfying(versions, range)`, `$semverMinSatisfying(versions, range)`, `$semverMinVersion(range)`, `$semverValidRange(range)`, `$semverOutside(v, range, hilo)`, `$semverGtr(v, range)`, `$semverLtr(v, range)`, `$semverIntersects(r1, r2)`, `$semverSimplifyRange(versions, range)`, `$semverRangeSubset(sub, super)`, `$semverToComparators(range, v)`

---

## Joins (5 functions)

SQL-style joins between arrays. Accessors can be a string (field name), array of strings (composite key), or function.

| Function | Description |
|----------|-------------|
| `$crossJoin(left, right, joinedKey, options?)` | Every left paired with every right. Options: `{grouped}`. |
| `$innerJoin(left, right, leftAccessor, rightAccessor, joinedKey, options?)` | Only rows with matches in both sides. |
| `$leftOuterJoin(left, right, leftAccessor, rightAccessor, joinedKey, options?)` | All left rows; right matches where available. |
| `$leftSemiJoin(left, right, leftAccessor, rightAccessor)` | Left rows that have a right match (no right data merged). |
| `$leftAntiJoin(left, right, leftAccessor, rightAccessor)` | Left rows that have NO right match. |

### Join Example

```jsonata
(
  $orders := [{"id": 1, "custId": "A"}, {"id": 2, "custId": "B"}];
  $customers := [{"id": "A", "name": "Acme"}, {"id": "B", "name": "Beta"}];
  $innerJoin($orders, $customers, "custId", "id", "customer")
)
/* Each order gains a "customer" key with the matched customer object */
```

---

## Moment.js (7 functions)

Full moment.js API available on returned objects (`.format()`, `.add()`, `.diff()`, `.isBefore()`, etc.).

| Function | Description |
|----------|-------------|
| `$moment(value?, format?, localeOrStrict?, strict?)` | Create moment instance. Accepts date strings, arrays, objects. |
| `$momentDuration(value?, unitOfTime?)` | Create duration instance. Supports ISO 8601 (`"PT8H"`), numbers, objects. |
| `$momentTz(date?, format?, timezone?)` | Create moment with specific timezone. |
| `$momentTzTimezones()` | List all available IANA timezone names. |
| `$momentTzGuess(ignoreCache?)` | Guess user's timezone. Returns `"UTC"` on backend. |
| `$momentMax(values, ignoreInvalidDates?)` | Most future moment from array. |
| `$momentMin(values, ignoreInvalidDates?)` | Most past moment from array. |

### Common Moment Patterns

```jsonata
/* Current date formatted */
$moment().format("YYYY-MM-DD")

/* Add 7 days to a date */
$moment(dateStr).add(7, "days").toISOString()

/* Hours between two dates */
$moment(endDate).diff($moment(startDate), "hours")

/* Humanize a duration */
$momentDuration("PT1H30M").humanize()
/* "2 hours" */

/* Parse in specific timezone */
$momentTz(dateStr, "YYYY-MM-DD", "America/New_York")

/* Check if a date is in the past */
$moment(dueDate).isBefore($moment())

/* Start/end of day */
$moment().startOf("day").toISOString()
$moment().endOf("day").toISOString()

/* Format with locale-aware output */
$moment(dateStr).format("dddd, MMMM Do YYYY, h:mm a")
/* "Monday, March 15th 2024, 2:30 pm" */
```

---

## XML (2 functions)

| Function | Description |
|----------|-------------|
| `$jsonToXml(data, options?)` | Convert JSON to XML string. |
| `$xmlToJson(xmlString, options?)` | Parse XML to JSON. |

---

## EDI (6 functions)

| Function | Description |
|----------|-------------|
| `$parseX12(string)` | Parse X12 EDI string to JSON object. |
| `$formatX12(array)` | Format parsed X12 array to structured JSON. |
| `$readEDI(format, data, options)` | Read EDI documents. Format: `"x12"` or `"edifact"`. |
| `$writeEDI(format, data, options)` | Write EDI documents. |
| `$validateEDI(format, data, options)` | Validate EDI documents. |
| `$ackEDI(format, data, options)` | Generate EDI acknowledgments. |

---

## Encryption (2 functions)

| Function | Description |
|----------|-------------|
| `$encryptHmac(algorithm, key, string, encoding?)` | HMAC digest. Algorithm: OpenSSL method (e.g., `"sha256"`). Default encoding `"base64"`. |
| `$hash(algorithm, string, encoding?)` | Hash string. Default encoding `"base64"`. |

---

## Network (1 function)

| Function | Description |
|----------|-------------|
| `$http(method, env, body?)` | HTTP request. Method: `"get"|"post"|"put"|"patch"|"delete"|"head"|"options"`. `env`: http-client config object. Returns base64-encoded response body. |

---

## Calendars (6 functions)

| Function | Description |
|----------|-------------|
| `$eventsBetween(start, end, calendar, options?)` | Events between two moments. Options: `{includeStart, includeEnd, assignOccurrenceIds}`. |
| `$getEventEnd(event, after?)` | End of first (or next after `after`) occurrence. |
| `$getEventsAt(moment, calendar)` | Events occurring at a specific moment. |
| `$getAvailabilityBetween(start, end, calendar, options?)` | Events categorized by availability. Options: `{exact}`. |
| `$availableAt(moment, calendar)` | True if any available event at the moment. |
| `$getTimeline(start, end, calendar, options?)` | Timeline for a time range on calendar. |

---

## Scheduling (2 functions)

| Function | Description |
|----------|-------------|
| `$scheduleGroup(id)` | Get schedule group. Methods: `.getCurrentSchedules()`, `.getTimeline()`, `.getEventsIntersections()`, `.getAvailabilityBetween()`, `.getCalendarIntervals()` |
| `$schedule(id)` | Get individual schedule. Methods: `.getAvailabilityBetween()`, `.getTimeline()`, `.getEventsIntersections()`, `.getEventsBetween()`, `.getExceptionsBetween()`, `.getCalendarIntervals()` |

---

## Unit Conversion (3 functions)

| Function | Description |
|----------|-------------|
| `$convertUnit(fromUnitId, toUnitId, value)` | Convert between units of same type. Also works as `[1,5,10].$convertUnit("km","mi")`. |
| `$getConversionFactor(fromUnitId, toUnitId)` | Get conversion factor between units (equivalent to converting 1). |
| `$getUnit(identifier)` | Retrieve Unit record by `{id}`, `{code}`, or `{name}` (case-insensitive). |

---

## MFGx Application Functions (12 functions)

Available in data flows and screen element transforms that have app context.

| Function | Description |
|----------|-------------|
| `$query(input)` | Execute GraphQL query. Input: `{api?, statement, variables}`. API defaults to APPLICATION. Returns `data` property. |
| `$mutate(input)` | Execute GraphQL mutation. Same interface as `$query`. |
| `$integrate(data)` | Post data to integration connection API. Returns response body. |
| `$document(payload, options?)` | Render document via `renderDocument` mutation. Options: `{returnContent}`. |
| `$executeFlow(flowId, payload?)` | Execute orchestration flow by ID with optional payload. |
| `$executeTransform(savedTransformId, payload, bindings?)` | Execute saved transform with payload and optional bindings. |
| `$executeDataMapping(dataMappingId, payload)` | Execute data mapping by ID. |
| `$executeSavedQuery(savedQueryId, parameters?)` | Execute saved query by ID with parameters. |
| `$getCalendar(queryInput)` | Fetch calendar by ID or name. |
| `$addNotificationMessage(title, options?)` | Show UI notification. Options: `{message, data, severity, snackbar}`. Severity: `"info"|"success"|"warning"|"error"`. |
| `$executeDeviceFunction(payload)` | Execute device function. Returns `{requestId, deviceGatewayId, response, error}`. |
| `$executeDeviceGatewayFunction(payload)` | Execute device gateway function. Returns `{requestId, response, error}`. |

### $query -- Query Data

```jsonata
$query({
  "statement": "query($filter: JSON) { WorkOrder(filter: $filter) { edges { id name status } } }",
  "variables": { "filter": { "status": { "_eq": "Active" } } }
}).WorkOrder.edges
```

### $mutate -- Update Data

```jsonata
$mutate({
  "statement": "mutation($input: UpdateWorkOrderInput!) { updateWorkOrder(input: $input) { workOrder { id } } }",
  "variables": { "input": { "id": id, "status": "Complete" } }
})
```

### $executeFlow -- Run a Flow

```jsonata
$executeFlow("flow-id-here", { "orderId": id })
```

### $integrate -- Call Integration

```jsonata
$integrate({
  "connectionId": "my-connection-id",
  "data": { "partNumber": partNum, "quantity": qty }
})
```

### $addNotificationMessage -- Show Notification

```jsonata
$addNotificationMessage("Success", {
  "severity": "success",
  "message": "Record saved successfully"
})
```

### $moment with $query -- Date-Filtered Query

```jsonata
(
  $startOfDay := $moment().startOf("day").toISOString();
  $query({
    "statement": "query($filter: JSON) { Event(filter: $filter) { edges { id name startTime } } }",
    "variables": {
      "filter": {
        "startTime": { "_gte": $startOfDay }
      }
    }
  }).Event.edges
)
```

---

## Frontend-Only Functions

Available only in browser context (screen transforms, onChange).

### Clipboard

| Function | Description |
|----------|-------------|
| `$writeToClipboard(data)` | Write data to system clipboard. |
| `$readFromClipboard()` | Read data from system clipboard. |

### PDF / File Operations

| Function | Description |
|----------|-------------|
| `$pdfToJson(base64String, options?)` | Convert base64 PDF to JSON representation. |
| `$mergePDFs(pdfArray)` | Merge array of base64 PDFs into one. Returns base64. |
| `$rotatePDF(base64String, angle)` | Rotate all pages by angle (multiple of 90). Returns base64. |

### Navigation

| Function | Description |
|----------|-------------|
| `$navigateTo(path)` | Navigate to a screen path. |
| `$navigateBack()` | Navigate back in history. |
| `$navigateReload()` | Reload current screen. |
| `$log(message, meta?, level?)` | Console log with level. Levels: `"error"|"warn"|"info"|"verbose"|"debug"|"silly"`. Default `"info"`. |

### Dialogs

| Function | Description |
|----------|-------------|
| `$showAlertDialog(message, options?)` | Show alert dialog. |
| `$showConfirmDialog(message, options?)` | Show confirmation dialog (returns boolean). |
| `$showFormDialog(formProps)` | Show form dialog. |
| `$showScreenDialog(props)` | Show screen dialog. |

### Files

| Function | Description |
|----------|-------------|
| `$retrieveFileContent(fileId, encoding?)` | Download and decode a file by ID. |
