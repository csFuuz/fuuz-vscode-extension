# JSONata Built-in Functions

All 65 standard functions from the JSONata specification.

---

## String Functions (21)

| Function | Description |
|----------|-------------|
| `$string(value, prettify?)` | Cast to string. Optional `prettify` boolean for formatted JSON output. |
| `$length(str)` | String length. |
| `$substring(str, start, length?)` | Extract substring. Negative `start` counts from end. |
| `$substringBefore(str, chars)` | Substring before first occurrence of `chars`. |
| `$substringAfter(str, chars)` | Substring after first occurrence of `chars`. |
| `$uppercase(str)` | Convert to uppercase. |
| `$lowercase(str)` | Convert to lowercase. |
| `$trim(str)` | Remove leading/trailing whitespace. |
| `$pad(str, width, char?)` | Pad string to `width`. Negative = pad left. Default pad char is space. |
| `$contains(str, pattern)` | Test if `str` contains `pattern` (string or regex). Returns boolean. |
| `$split(str, separator, limit?)` | Split string. `separator` can be string or regex. |
| `$join(array, separator?)` | Join array of strings. Default separator is empty string. |
| `$match(str, pattern, limit?)` | Find all regex matches. Returns array of match objects with `match`, `index`, `groups`. |
| `$replace(str, pattern, replacement, limit?)` | Replace occurrences. `pattern` can be string or regex. `replacement` can be string or function. |
| `$eval(expr, context?)` | Evaluate JSONata expression string. Optional context object. |
| `$base64encode(str)` | Encode string to base64. |
| `$base64decode(str)` | Decode base64 to string. |
| `$encodeUrlComponent(str)` | URI component encode (like `encodeURIComponent`). |
| `$decodeUrlComponent(str)` | URI component decode (like `decodeURIComponent`). |
| `$encodeUrl(str)` | URI encode (like `encodeURI`). |
| `$decodeUrl(str)` | URI decode (like `decodeURI`). |

---

## Numeric Functions (12)

| Function | Description |
|----------|-------------|
| `$number(value)` | Cast to number. Strings, booleans, `null` converted. |
| `$abs(n)` | Absolute value. |
| `$floor(n)` | Round down to integer. |
| `$ceil(n)` | Round up to integer. |
| `$round(n, precision?)` | Round to `precision` decimal places. **Uses banker's rounding** (round half to even). `$round(2.5)` = 2, `$round(3.5)` = 4. |
| `$power(base, exp)` | Exponentiation. `$power(2, 3)` = 8. |
| `$sqrt(n)` | Square root. |
| `$random()` | Random float in [0, 1). |
| `$formatNumber(n, picture, options?)` | Format number using picture string (XPath 3.1 spec). `$formatNumber(1234.5, "#,##0.00")` = "1,234.50". |
| `$formatBase(n, radix?)` | Convert number to string in given base (2-36). Default radix 10. |
| `$formatInteger(n, picture)` | Format integer using picture string. `$formatInteger(42, "w")` = "forty-two". Patterns: `0`=digit, `#`=optional digit, `w`=words, `W`=WORDS, `Ww`=Title Words, `A`=letters, `a`=lowercase letters, `I`/`i`=roman. |
| `$parseInteger(str, picture)` | Parse integer from formatted string. Inverse of `$formatInteger`. |

---

## Aggregation Functions (4)

| Function | Description |
|----------|-------------|
| `$sum(array)` | Sum of numeric values. Ignores non-numeric. |
| `$max(array)` | Maximum value. Works with numbers and strings. |
| `$min(array)` | Minimum value. Works with numbers and strings. |
| `$average(array)` | Arithmetic mean. |

These operate on arrays. With path expressions, they aggregate the mapped results:

```jsonata
$sum(Account.Order.Product.Price)
```

---

## Boolean Functions (3)

| Function | Description |
|----------|-------------|
| `$boolean(value)` | Cast to boolean. Falsy: `false`, `0`, `null`, `undefined`, `""`, `[]`, `{}`. Everything else truthy. |
| `$not(value)` | Boolean NOT. **This is the only way to negate** -- there is no `!` operator. |
| `$exists(value)` | Returns `true` if value is not `undefined`. Use to test field existence. |

---

## Array Functions (7)

| Function | Description |
|----------|-------------|
| `$count(array)` | Number of elements. Returns 1 for non-array values, 0 for `undefined`. |
| `$append(arr1, arr2)` | Concatenate arrays. Non-array args wrapped in array first. |
| `$sort(array, comparator?)` | Sort array. Optional `comparator(a, b)` function returns boolean. Default: ascending. |
| `$reverse(array)` | Reverse array order. |
| `$shuffle(array)` | Randomly reorder array elements. |
| `$distinct(array)` | Remove duplicates. Uses deep equality for objects. |
| `$zip(arr1, arr2, ...)` | Zip arrays together. `$zip([1,2],[3,4])` = `[[1,3],[2,4]]`. |

---

## Object Functions (9)

| Function | Description |
|----------|-------------|
| `$keys(obj)` | Array of field names. |
| `$lookup(obj, key)` | Get field value by name. `$lookup(obj, "field")` equivalent to `obj.field`. |
| `$spread(obj)` | Convert object to array of single-key objects. `$spread({"a":1,"b":2})` = `[{"a":1},{"b":2}]`. |
| `$merge(array)` | Merge array of objects into one. Later values override earlier for same key. |
| `$sift(obj, fn)` | Filter object fields. `fn(value, key)` returns boolean. Keep fields where true. |
| `$each(obj, fn)` | Map over object fields. `fn(value, key)` returns transformed value. Returns array of results. |
| `$error(message?)` | Throw error with message. Halts evaluation. |
| `$assert(condition, message?)` | Throw error if condition is falsy. |
| `$type(value)` | Returns type string: `"null"`, `"number"`, `"string"`, `"boolean"`, `"array"`, `"object"`, `"function"`, or `"undefined"`. |

---

## Date/Time Functions (4)

| Function | Description |
|----------|-------------|
| `$now()` | Current timestamp as ISO 8601 string. **Frozen per evaluation** -- returns same value throughout. |
| `$millis()` | Current time as Unix milliseconds. **Frozen per evaluation**. |
| `$fromMillis(ms, picture?, timezone?)` | Convert milliseconds to formatted string. Default ISO 8601. Picture uses XPath date format. |
| `$toMillis(str, picture?)` | Parse date string to milliseconds. Default parses ISO 8601. |

### XPath Date/Time Picture Symbols

| Symbol | Meaning | Example |
|--------|---------|---------|
| `[Y0001]` | Year (4 digit) | 2024 |
| `[M01]` | Month (2 digit) | 03 |
| `[D01]` | Day (2 digit) | 15 |
| `[H01]` | Hour 24h (2 digit) | 14 |
| `[h1]` | Hour 12h | 2 |
| `[m01]` | Minute (2 digit) | 30 |
| `[s01]` | Second (2 digit) | 45 |
| `[f001]` | Millisecond (3 digit) | 123 |
| `[P]` | AM/PM | PM |
| `[Z]` | Timezone | +05:00 |
| `[ZN]` | Timezone name | EST |
| `[FNn]` | Day name | Monday |
| `[MNn]` | Month name | March |

Example:

```jsonata
$fromMillis($millis(), "[MNn] [D01], [Y0001] [H01]:[m01]:[s01]")
/* "March 15, 2024 14:30:45" */
```

---

## Higher-Order Functions (5)

| Function | Description |
|----------|-------------|
| `$map(array, fn)` | Map function over array. `fn(value, index, array)`. |
| `$filter(array, fn)` | Filter array. `fn(value, index, array)` returns boolean. |
| `$single(array, fn?)` | Returns the one matching element. Errors if 0 or 2+ match. Optional `fn` predicate. |
| `$reduce(array, fn, init?)` | Reduce array. `fn(accumulator, value, index, array)`. |
| `$sift(obj, fn)` | Filter object entries. `fn(value, key)`. (Also listed under Object.) |

### Common Patterns

```jsonata
/* Map */
Account.Order ~> $map(function($order) { $order.Product })

/* Filter */
Account.Order ~> $filter(function($o) { $o.Price > 100 })

/* Reduce to sum */
[1,2,3,4] ~> $reduce(function($acc, $val) { $acc + $val }, 0)

/* Chain map + filter */
data ~> $map(fn1) ~> $filter(fn2) ~> $sort(fn3)

/* Partial application */
$map(data, $substringBefore(?, "@"))
```
