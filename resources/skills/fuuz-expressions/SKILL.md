---
name: fuuz-expressions
description: Write JSONata expressions and JavaScript scripts for the Fuuz/MFGx platform. Use when the user needs to write transforms, validation expressions, onChange handlers, data flow transforms, or scripts. Covers both JSONata (used in screen transforms, flow transforms, validation) and JavaScript (used in Script nodes in data flows).
---

# Fuuz Expressions Skill

This skill covers how to write JSONata expressions and JavaScript scripts for the Fuuz/MFGx platform.

> **Platform JSONata version: 2.1.1.** Write expressions against JSONata **2.1.1** semantics and its
> built-in function set. Do not rely on syntax or functions introduced after 2.1.1, and prefer
> features known to exist in 2.1.1 when in doubt.

> ⚠️ **JSONata is NOT JavaScript — the #1 source of broken transforms.** Use these, not the JS lookalikes:
> | Intent | JSONata (correct) | JavaScript (WRONG — will error) |
> |---|---|---|
> | ≥ / ≤ | `>=` / `<=` | `=>` / `=<` |
> | equal | `=` | `==` / `===` |
> | boolean AND / OR | `and` / `or` | `&&` / `\|\|` |
> | NOT | `$not(x)` | `!x` |
> | string concat | `&` (`"a" & "b"`) | `+` |
> Errors like *"=> is not a unary operator"* or *"& cannot be used as a unary operator"* mean a JS operator leaked in — replace it with the JSONata form above.

---

## Which Language to Use

| Use Case | Language | Reason |
|----------|----------|--------|
| Screen element transform props | JSONata | Native transform engine; auto-reactivity via `__dynamicFields` |
| Screen element onChange handlers | JSONata | Direct access to `$components`, metadata, UI functions |
| Validation expressions | JSONata | Boolean result determines validity |
| Data flow Transform nodes | JSONata | Default node type; concise for data shaping |
| Data flow Conditional nodes | JSONata | Boolean expressions for If/Else, Route, Accept/Reject |
| Set Context / Merge Context | JSONata | Result becomes/merges into `$state.context` |
| Table column data/style | JSONata | Per-row expressions with component context |
| Data flow Script nodes | JavaScript | Full imperative control, loops, try/catch, async/await |
| Saved Scripts | JavaScript | Reusable logic called from flows |
| Data Mappings | JavaScript | Complex field-by-field mapping logic |

**Rule of thumb:** Use JSONata unless you need imperative control flow, complex error handling, or multi-step async operations -- then use JavaScript.

---

## Core JSONata Syntax

### Path Expressions

```jsonata
Account.Order.Product        /* Navigate nested objects */
Account.Order[0]             /* Array index (zero-based) */
Account.Order[-1]            /* Negative index = from end */
Phone[type="mobile"]         /* Filter predicate */
Account.Order.Product.Price  /* Implicit map over arrays */
*.Price                      /* Wildcard -- all children */
**.Price                     /* Descendant wildcard -- any depth */
```

### Result Construction

```jsonata
/* Object construction */
Account.Order.{
  "product": Product.Description,
  "total": Price * Quantity
}

/* Array construction */
[Account.Order.Product.Price]  /* Wrap in array */
```

### Singleton Array Equivalence (Critical)

JSONata treats a single-element array and the element itself as equivalent:
- `[42]` and `42` are interchangeable in path expressions
- `Phone[0]` on a non-array returns the value itself
- `Phone.number[0]` gets the first `number` of EACH phone (map then index)
- `(Phone.number)[0]` gets the first from ALL numbers (flatten then index)

#### Force a projection to stay an array with trailing `[]` (critical for aggregation)

A path/projection that happens to match **exactly one** item returns the *bare item*, not a
1-element array. Downstream code that assumes an array then misbehaves:
- `$count(x)` on a bare object returns **1** (ok) but `$count` on a bare *string* also returns 1 — but
  `$sum`, `$append`, `.node` mapping, and index access `x[0]` silently do the wrong thing on a singleton.
- A filter that matches one row (`edges[pred]`) collapses to that one object; iterating it as a list breaks.

**Fix: append `[]` to force sequence-to-array**, so 0/1/many are handled uniformly:

```jsonata
$activeOps := $wops.( ... )[];        /* always an array, even for a single match */
$exists($activeOps[0]) ? ... : null   /* presence test — NOT $count($x) > 0 on a maybe-singleton */
$rows := data.edges[status = "open"][];   /* one match still iterates as a list */
```

Rules of thumb:
- Building an array you will `$count`/`$sum`/`$append`/iterate? End the projection with `[]`.
- Presence check: prefer `$exists(x[0])` / `$exists(x)` over `$count(x) > 0`.
- Null-guard before dereferencing a maybe-null relation: `$cpr != null ? $append([], $cpr.x.edges.node.id) : []`
  and parenthesize `in`: `$cpr != null and ($pid in $ids)`. A deref on null throws and kills the whole transform.

---

## Critical Gotchas

1. **No `!` operator** -- Use `$not(expr)` function instead
2. **`$not()` is a function**, not an operator -- `$not($exists(x))` not `!$exists(x)`
3. **String concatenation uses `&`** -- Not `+`. `"hello" & " " & "world"`
4. **Comparison uses `=` not `==`** -- Single equals for comparison. No `===`.
5. **`in` operator for membership** -- `x in [1,2,3]` not `[1,2,3].includes(x)`
6. **`$round` uses banker's rounding** -- Rounds to nearest even on .5 boundary. `$round(2.5)` = 2, `$round(3.5)` = 4
7. **`$now()` and `$millis()` are frozen** -- Return same value for entire evaluation
8. **`undefined` propagates** -- Accessing a missing field returns `undefined`, which silently drops from results rather than erroring
9. **No explicit return** -- Last expression evaluated is the result
10. **Dot-before-brace matters** -- `Account.Order.{"p": Product}` constructs per-item; `Account.{"o": Order}` constructs once
11. **`$components`/`$metadata` go empty inside a `$executeFlow` argument** -- In a `__remote: true` transform, referencing `$components.X`/`$metadata.X` directly inside the `$executeFlow(...)` argument object resolves to empty. Bind them to `$variables` in the outer `(...)` scope first, then pass only those variables. See the `fuuz-screen-design` skill (`$executeFlow` Argument Scope).

---

## Operators Quick Reference

### Path Operators

| Operator | Name | Example |
|----------|------|---------|
| `.` | Map/Navigate | `Account.Order.Product` |
| `[ ]` | Filter/Index | `[0]`, `[-1]`, `[price > 10]` |
| `^( )` | Order-by | `^(>Price)` descending, `^(<Name)` ascending |
| `{ }` | Reduce/Group | `Product.{Description: $sum(Price)}` |
| `*` | Wildcard | All children at current level |
| `**` | Descendants | All fields at any depth |
| `%` | Parent | Access parent in nested filter |
| `#$var` | Index bind | Bind array index to variable |
| `@$var` | Focus bind | Bind current focus to variable |

### Numeric Operators

`+` (add), `-` (subtract/negate), `*` (multiply), `/` (divide), `%` (modulo), `..` (range: `[1..5]`)

### Comparison Operators

`=` (equal), `!=` (not equal), `<`, `<=`, `>`, `>=`, `in` (membership)

### Boolean Operators

`and`, `or` -- No `not` keyword; use `$not()` function.

### String Operator

`&` -- Concatenation. Coerces non-strings automatically.

### Conditional Operators

| Operator | Name | Example |
|----------|------|---------|
| `? :` | Ternary | `status = "active" ? "Yes" : "No"` |
| `?:` | Elvis | `name ?: "Anonymous"` (default when falsy) |
| `??` | Null coalescing | `count ?? 0` (default only when null/undefined) |

### Other Operators

| Operator | Name | Example |
|----------|------|---------|
| `:=` | Assignment | `$x := 42` |
| `~>` | Chaining/Pipe | `data ~> $map(fn) ~> $filter(fn2)` |
| `\| \| \|` | Transform | `$ ~> \| Account \| {"Status": "Active"} \|` |

---

## Platform Contexts

JSONata expressions run in different contexts with different available bindings.

### Screen Element Context

Used in: transform props, onChange handlers, validation, table column data/style.

| Available | Description |
|-----------|-------------|
| `$` (root) | Component-specific data (form values, row data, etc.) |
| `$$` | Root input -- always the top-level input |
| `metadata.user` | Current user (id, name, email, roles) |
| `metadata.tenant` | Current tenant (id, name) |
| `metadata.settings` | Localization settings (date/time formats, locale, timezone) |
| `metadata.screen` | Current screen metadata |
| `metadata.urlParameters` | URL path parameters |
| `metadata.querystring` | URL query parameters |
| `$components.<Name>` | Screen component shared state (.data, .fn, .context) |
| `$appConfig` | Tenant application configuration |
| UI functions | `$navigateTo`, `$showAlertDialog`, `$showConfirmDialog`, etc. |

### Data Flow Context

Used in: Transform nodes, Conditional nodes, Set/Merge Context, Response, Log.

| Available | Description |
|-----------|-------------|
| `$` (root) | Current node payload (from previous node) |
| `$state.payload` | Same as `$` |
| `$state.context` | Shared flow context (set via Set/Merge Context nodes) |
| `$state.claims` | Auth claims of the triggering user |
| `$state.batches` | Batch tracking (Fork/Broadcast/Combine) |
| `$state.messageId` | Unique message ID for this flow execution |
| `$state.metadata` | Flow metadata (tenantId, enterpriseId, flowId) |
| `$state.lastError` | Error from last caught error |
| `$state.catchErrorNode` | ID of the error handler node |

### Context Differences

| Feature | Screen Elements | Data Flows |
|---------|----------------|------------|
| Root `$` | Component data | Node payload |
| `metadata` | User, tenant, settings, URL params | Not available |
| `$components` | Screen component state | Not available |
| `$state` | Not available | Full flow state |
| `$appConfig` | Application config | Not available |
| UI functions | Available | Not available |
| Evaluation | Browser (or remote with `__remote: true`) | Always server-side |

---

## Transform Props Pattern

Screen element props that accept JSONata use this object structure:

```json
{
  "__transform": "expression string or { id: savedTransformId }",
  "__remote": false,
  "__language": "JSONata",
  "__dynamicFields": {
    "payload": ["data.status"],
    "context": ["metadata.user"]
  },
  "__cacheKey": "unique-key",
  "__refreshInterval": 5000,
  "__fallbackValue": "default"
}
```

| Key | Description |
|-----|-------------|
| `__transform` | JSONata expression string, or `{id}` / `{name}` for saved transform |
| `__remote` | `true` to evaluate server-side (default `false`) |
| `__language` | `"JSONata"` (default) or `"JavaScript"` |
| `__dynamicFields` | Paths that trigger re-evaluation on change. Set to `false` for evaluate-once. |
| `__cacheKey` | Unique key for caching the transform result, scoped to the element |
| `__refreshInterval` | Milliseconds between automatic re-evaluations |
| `__fallbackValue` | Default value while transform is pending |

---

## Reference Files

| File | Contents |
|------|----------|
| `functions-builtin.md` | All 65 standard JSONata functions (String, Numeric, Aggregation, Boolean, Array, Object, Date/Time, Higher-Order) |
| `functions-platform.md` | All 182 custom platform bindings organized by package |
| `context.md` | Platform evaluation context -- screen elements and data flows |
| `programming.md` | Programming constructs -- variables, lambdas, conditionals, regex, chaining, patterns |
| `javascript.md` | JavaScript scripting reference -- execution model, bindings, differences from JSONata |
