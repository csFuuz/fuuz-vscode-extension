# JSONata Programming Constructs

---

## Comments

```jsonata
/* Block comments only -- no line comments */
Account.Order.(
  /* Calculate line total */
  Price * Quantity
)
```

---

## Variable Binding

Variables are bound with `:=` and prefixed with `$`. Scoped to the block they are defined in.

```jsonata
(
  $price := Product.Price;
  $tax := $price * 0.1;
  $price + $tax
)
```

**Block expressions** use `( )` with `;` separating statements. The last expression is the result.

```jsonata
(
  $name := FirstName & " " & LastName;
  $upper := $uppercase($name);
  $upper
)
```

---

## Context References

| Symbol | Meaning |
|--------|---------|
| `$` | Current input/scope (changes as you navigate into objects) |
| `$$` | Root input -- always refers to the top-level input, regardless of navigation depth |

```jsonata
Account.Order.Product.(
  $$.Account.Name & ": " & Description
  /* $$ reaches back to root to get Account.Name */
)
```

---

## Conditional Expressions

### Ternary

```jsonata
status = "active" ? "Active" : "Inactive"
```

Falsy values: `false`, `null`, `undefined`, `0`, `""`, `[]`, `{}`.

### Chained Conditions (if/else if/else pattern)

```jsonata
(
  status = "active" ? "Active" :
  status = "pending" ? "Pending" :
  "Unknown"
)
```

### Elvis Operator `?:`

Returns left side if truthy, otherwise right side. Note: **no space** between `?` and `:`.

```jsonata
name ?: "Anonymous"    /* "Anonymous" if name is falsy */
```

### Null Coalescing `??`

Returns left side if not `null`/`undefined`, otherwise right side. Unlike `?:`, keeps `0`, `false`, `""`.

```jsonata
count ?? 0        /* 0 only if count is null/undefined */
count ?: 0        /* 0 if count is null/undefined/0/false/"" */
```

---

## Lambda Functions

```jsonata
/* Named lambda */
$fn := function($x, $y) { $x + $y };

/* Inline in higher-order functions */
$map(data, function($item) { $item.name })

/* Short form -- lambda with implicit parameter via path */
Account.Order.(Price * Quantity)
```

### Function Signatures (Type Constraints)

Optional type annotations on lambda parameters:

```jsonata
$fn := function($x, $y)<nn:n> { $x + $y }
```

Signature codes:

| Code | Type |
|------|------|
| `s` | string |
| `n` | number |
| `b` | boolean |
| `o` | object |
| `a` | array |
| `f` | function |
| `j` | JSON |
| `x` | any |
| `l` | null |
| `u` | undefined |
| `?` | optional |

Format: `<params:return>`. Example: `<ss:s>` means two string params, returns string.

---

## Closures

Functions capture variables from their enclosing scope:

```jsonata
(
  $multiplier := 3;
  $multiply := function($x) { $x * $multiplier };
  $multiply(5)  /* 15 */
)
```

---

## Partial Application

Use `?` as a placeholder to create a partially applied function:

```jsonata
$add := function($x, $y) { $x + $y };
$add5 := $add(5, ?);
$add5(3)  /* 8 */
```

Works with built-in functions too:

```jsonata
$trim := $substringBefore(?, "@");
emails ~> $map($trim)
/* Extracts the part before "@" from each email */
```

---

## Function Chaining (`~>`)

Pipe operator passes the left result as the first argument of the right function:

```jsonata
Account.Order.Product ~>
  $filter(function($p) { $p.Price > 50 }) ~>
  $map(function($p) { $p.Description }) ~>
  $sort() ~>
  $join(", ")
```

Equivalent to nested calls:

```jsonata
$join($sort($map($filter(Account.Order.Product, fn1), fn2)))
```

---

## Regular Expressions

JSONata uses JavaScript regex syntax:

```jsonata
/pattern/flags
```

Flags: `i` (case-insensitive), `m` (multiline), `g` (global -- only in `$match`/`$replace`).

```jsonata
$contains(name, /^[A-Z]/)           /* Starts with uppercase */
$match(text, /(\d+)-(\w+)/g)        /* All matches with groups */
$replace(str, /\s+/g, "-")          /* Replace whitespace with dash */
$split(csv, /,\s*/)                 /* Split on comma + optional space */
```

Regex in predicates:

```jsonata
Phone[$contains(number, /^07/)]     /* Filter phones starting with 07 */
```

---

## Recursive Processing

JSONata supports tail-call optimization for recursive lambdas:

```jsonata
(
  $factorial := function($n) {
    $n <= 1 ? 1 : $n * $factorial($n - 1)
  };
  $factorial(5)  /* 120 */
)
```

**Important:** Ensure the recursive call is in tail position when processing large datasets to prevent stack overflow.

---

## Transform Operator

Create modified copies of data without mutation:

```jsonata
/* Update fields */
$ ~> | Account | {"Status": "Active"} |

/* Remove fields */
$ ~> | Account.Order | {} | ["InternalId"] |

/* Nested updates with path reference */
$ ~> | Account.Order.Product | {"Price": Price * 1.1} |
```

Combine with chaining for multi-step transforms:

```jsonata
$ ~> | Account | {"Name": $uppercase(Name)} |
  ~> | Account.Order | {"Total": Price * Quantity} |
```

The transform operator:
- Returns a deep copy (does not mutate original)
- Can target nested paths
- `update_expr` can reference fields of the matched object
- `delete_keys` is optional

---

## Common Patterns

### Null-Safe Navigation

```jsonata
Account.Order.Product.Price          /* undefined if any step missing */
$exists(Account.Order) ? Account.Order.Product : "N/A"
```

### Default Values

```jsonata
(Account.Name ?? "Unknown")          /* Null coalescing */
(Account.Name ?: "Unknown")          /* Elvis (also covers empty string) */
```

### Conditional Object Construction

```jsonata
{
  "name": Name,
  "email": Email,
  "phone": $exists(Phone) ? Phone : undefined
  /* undefined fields are omitted from result */
}
```

### Array Aggregation with Grouping

```jsonata
Account.Order.Product.{
  Description: {
    "total": $sum(Price),
    "count": $count(Price)
  }
}
```

### Dynamic Field Names

```jsonata
$fieldName := "status";
{ $fieldName: "active" }    /* {"status": "active"} */
```

### Building Objects Conditionally

```jsonata
(
  $base := {"name": Name, "id": id};
  $extra := $exists(Phone) ? {"phone": Phone} : {};
  $merge([$base, $extra])
)
```

### Flattening Nested Arrays

```jsonata
/* Using path expressions (auto-flattens) */
Account.Order.Product.Description

/* Explicit flatten */
$flatten(nestedArrays, 2)
```

### Lookup Pattern

```jsonata
(
  $lookup_map := $merge(referenceData.{"" & id: name});
  items.({"item": name, "category": $lookup($lookup_map, "" & categoryId)})
)
```

### Safe Numeric Operations

```jsonata
/* Avoid division by zero */
denominator != 0 ? numerator / denominator : 0

/* Banker's rounding gotcha -- use floor/ceil if needed */
$floor(value * 100 + 0.5) / 100  /* Standard rounding instead of banker's */
```
