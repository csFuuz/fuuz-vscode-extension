# JavaScript Scripting Reference

JavaScript is available as an alternative to JSONata for transformations in **data flow Script nodes**, **Saved Scripts**, and **Data Mappings**. It runs in a sandboxed environment with access to the same custom platform bindings as JSONata, but **not** the JSONata built-in functions.

---

## Execution Model

All JavaScript code is wrapped in an anonymous `async` arrow function at runtime. You **must use an explicit `return` statement** -- there is no implicit last-expression return like in JSONata.

```js
// Your code is wrapped as:
// (async () => { /* your code here */ })();

// So you MUST return a value:
const result = $.items.map(i => i.name);
return result;
```

### Backend (Server -- vm2 Sandbox)

On the server, JavaScript executes inside a sandboxed VM:
- `async`/`await` is supported
- `eval()` is blocked
- WebAssembly is blocked

### Frontend (Browser -- iframe Sandbox)

In the browser, JavaScript executes inside a sandboxed iframe:
- Uses Proxy objects to intercept all global access
- Only exposes an allowlist of globals: `String`, `Number`, `Array`, `Symbol`, `Math`, `RegExp`, `Object`, `JSON`, `Error`
- All built-in prototypes are frozen to prevent prototype pollution
- Dynamic `import()` statements are blocked

**Browser compatibility note:** Features available in Node.js (like certain APIs or newer ES syntax) may not work in the browser sandbox.

---

## Input Bindings

### Payload (`$` and `$$`)

The input payload is bound to both `$` and `$$` as read-only globals:

```js
// Access the input payload
const items = $.items;
const total = $.items.reduce((sum, item) => sum + item.price, 0);
return { ...$ , total };
```

### Custom Platform Bindings

All custom platform bindings from the JSONata binding maps are available with the `$` prefix. These are the same functions documented in `functions-platform.md` -- including `$query`, `$mutate`, `$moment`, `$integrate`, `$executeTransform`, `$executeFlow`, etc.

```js
// Query the GraphQL API
const result = await $query({
  statement: `query ($id: ID!) {
    item(where: { id: { _eq: $id } }) {
      edges { node { id name } }
    }
  }`,
  variables: { id: $.itemId }
});
return result;

// Use moment for date operations
const formatted = $moment($.createdAt).format('YYYY-MM-DD');
return { ...$ , formattedDate: formatted };
```

Available binding libraries (same as JSONata):
- **Core** -- `$uuid`, `$cuid`, `$coalesce`, `$isArray`, `$isString`, `$pick`, `$omit`, `$groupBy`, `$chunk`, etc.
- **Moment** -- `$moment`, `$momentDuration`, `$momentTz`, `$momentMax`, `$momentMin`
- **XML** -- `$jsonToXml`, `$xmlToJson`
- **EDI** -- `$readEDI`, `$writeEDI`, `$validateEDI`, `$ackEDI`
- **Encryption** -- `$encryptHmac`, `$hash`
- **Network** -- `$http`
- **Calendars** -- `$eventsBetween`, `$getEventsAt`, `$availableAt`, etc.
- **Joins** -- `$innerJoin`, `$leftOuterJoin`, `$crossJoin`, etc.
- **Units** -- `$convertUnit`, `$getConversionFactor`, `$getUnit`
- **MFGx App** -- `$query`, `$mutate`, `$integrate`, `$document`, `$executeTransform`, `$executeDataMapping`, `$executeFlow`, `$executeSavedQuery`

### Additional Context Bindings

Depending on the execution context, additional bindings may be available:

| Binding | Context | Description |
|---------|---------|-------------|
| `$state` | Data Flow nodes | The flow state object (`{ payload, context, claims, batches, messageId, metadata }`) |
| `$appConfig` | All transforms | The tenant's application configuration |
| `$before` | Triggers | Record state before mutation |
| `$after` | Triggers | Projected record state after mutation |
| `$where` | Triggers | The mutation's where predicate |

---

## What is NOT Available

### JSONata Built-in Functions

JSONata built-in functions are **not** available in JavaScript. Use JavaScript equivalents:

| JSONata | JavaScript Equivalent |
|---------|----------------------|
| `$sum(arr)` | `arr.reduce((a, b) => a + b, 0)` |
| `$map(arr, fn)` | `arr.map(fn)` |
| `$filter(arr, fn)` | `arr.filter(fn)` |
| `$reduce(arr, fn)` | `arr.reduce(fn)` |
| `$sort(arr)` | `[...arr].sort()` |
| `$join(arr, sep)` | `arr.join(sep)` |
| `$split(str, sep)` | `str.split(sep)` |
| `$trim(str)` | `str.trim()` |
| `$uppercase(str)` | `str.toUpperCase()` |
| `$lowercase(str)` | `str.toLowerCase()` |
| `$now()` | `new Date().toISOString()` |
| `$round(n, p)` | `Number(n.toFixed(p))` |
| `$exists(x)` | `x !== undefined && x !== null` |
| `$not(x)` | `!x` |
| `$count(arr)` | `arr.length` |
| `$append(a, b)` | `[...a, ...b]` |
| `$merge(arr)` | `Object.assign({}, ...arr)` |
| `$distinct(arr)` | `[...new Set(arr)]` |
| `$keys(obj)` | `Object.keys(obj)` |
| `$values(obj)` | `Object.values(obj)` |
| `$string(val)` | `String(val)` or `JSON.stringify(val)` |
| `$number(val)` | `Number(val)` |
| `$contains(str, pat)` | `str.includes(pat)` or `pat.test(str)` |
| `$substring(s, i, l)` | `s.substring(i, i + l)` |

### Restricted Globals (Browser)

In the browser sandbox, only these globals are exposed: `String`, `Number`, `Array`, `Symbol`, `Math`, `RegExp`, `Object`, `JSON`, `Error`. Everything else (`window`, `document`, `fetch`, `console`, `setTimeout`, etc.) is **not accessible**.

### Restricted Features (Backend)

On the server (vm2): `eval()` and WebAssembly are blocked.

---

## Key Differences from JSONata

| Aspect | JSONata | JavaScript |
|--------|---------|------------|
| Return | Implicit (last expression) | Explicit `return` required |
| Async | Not applicable | `async`/`await` supported |
| Syntax | JSONata expressions | Standard JavaScript (ES2017+) |
| Built-in functions | 65+ JSONata functions | Standard JS built-ins only |
| Platform bindings | Available as `$name()` | Available as `$name()` |
| Error on missing field | Returns `undefined` (silent) | Returns `undefined` (may throw on `.prop` of undefined) |
| Iteration | `$map`, `array.field` auto-map | `.map()`, `.forEach()`, `for...of` |
| Negation | `$not(expr)` function | `!expr` operator |
| String concat | `&` operator | `+` operator or template literals |
| Comparison | `=` (single equals) | `===` (strict equals) |
| Null check | `$exists(x)`, `x ?? default` | `x != null`, `x ?? default` |
| Comments | `/* block only */` | `//` line and `/* block */` |

---

## Examples

### Simple Transformation

```js
const { items, taxRate } = $;
const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
const tax = subtotal * taxRate;
return {
  subtotal,
  tax,
  total: subtotal + tax,
};
```

### Async Query with Processing

```js
const { data } = await $query({
  statement: `query ($status: String!) {
    workOrder(where: { status: { _eq: $status } }) {
      edges { node { id name quantity } }
    }
  }`,
  variables: { status: $.status },
});

const orders = data.workOrder.edges.map(e => e.node);
const totalQuantity = orders.reduce((sum, o) => sum + o.quantity, 0);

return {
  orders,
  count: orders.length,
  totalQuantity,
};
```

### Using Moment for Date Math

```js
const dueDate = $moment($.startDate).add($.leadTimeDays, 'days').toISOString();
return { ...$ , dueDate };
```

### Error Handling with Try/Catch

```js
try {
  const result = await $mutate({
    statement: `mutation($input: UpdateInput!) {
      updateRecord(input: $input) { record { id } }
    }`,
    variables: { input: { id: $.id, status: "Complete" } }
  });
  return { success: true, data: result };
} catch (error) {
  return { success: false, error: error.message };
}
```

### Batch Processing with Parallel Execution

```js
const items = $.items;
const batchSize = 10;
const results = [];

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  const batchResults = await Promise.all(
    batch.map(item => $query({
      statement: `query($id: ID!) { Part(where: {id: {_eq: $id}}) { edges { id name stock } } }`,
      variables: { id: item.partId }
    }))
  );
  results.push(...batchResults);
}

return { processedItems: results };
```

### Working with Flow State

```js
// Access flow context set by previous nodes
const { workOrderId, batchNumber } = $state.context;

// Access auth claims
const userId = $state.claims.sub;

// Build result using context + payload
const enrichedItems = $.items.map(item => ({
  ...item,
  workOrderId,
  batchNumber,
  processedBy: userId,
  processedAt: new Date().toISOString()
}));

return { items: enrichedItems };
```

### Data Mapping Pattern

```js
// Map source fields to target schema
const source = $;
return {
  externalId: source.id,
  fullName: `${source.firstName} ${source.lastName}`,
  email: source.contactEmail || source.email || null,
  phone: source.phones?.[0]?.number || null,
  address: source.address ? {
    line1: source.address.street,
    city: source.address.city,
    state: source.address.state,
    zip: source.address.postalCode
  } : null,
  createdAt: $moment(source.created).toISOString(),
  tags: [...new Set(source.categories || [])]
};
```
