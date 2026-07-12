# GraphQL Filter Predicates

Every queryable model generates a `{Model}WhereInput` type with field-level filtering. Each field maps to a predicate input type based on its scalar type. Multiple field predicates at the top level of a `where` object are combined with implicit AND.

---

## Predicate Types by Field Type

| Field Type | Predicate Type | Available Operators |
|------------|---------------|---------------------|
| `Boolean` | `BooleanPredicateInput` | `_eq`, `_isNull`, `_in`, `_gt`, `_gte`, `_lt`, `_lte` |
| `String`, `ID` | `StringPredicateInput` | `_eq`, `_isNull`, `_in`, `_gt`, `_gte`, `_lt`, `_lte`, `_startsWith`, `_endsWith`, `_contains` |
| `Int` | `IntPredicateInput` | `_eq`, `_isNull`, `_in`, `_gt`, `_gte`, `_lt`, `_lte` |
| `Float` | `FloatPredicateInput` | `_eq`, `_isNull`, `_in`, `_gt`, `_gte`, `_lt`, `_lte` |
| `DateTime` | `DateTimePredicateInput` | `_eq`, `_isNull`, `_in`, `_gt`, `_gte`, `_lt`, `_lte` |
| `Date` | `DatePredicateInput` | `_eq`, `_isNull`, `_in`, `_gt`, `_gte`, `_lt`, `_lte` |
| `Time` | `TimePredicateInput` | `_eq`, `_isNull`, `_in`, `_gt`, `_gte`, `_lt`, `_lte` |
| `RichText` | `RichTextPredicateInput` | `_eq`, `_isNull`, `_in`, `_gt`, `_gte`, `_lt`, `_lte`, `_startsWith`, `_endsWith`, `_contains` |
| `JSON` | `JSONPredicateInput` | `_eq`, `_isNull`, `_in`, `_gt`, `_gte`, `_lt`, `_lte`, `_startsWith`, `_endsWith`, `_contains`, `_has`, `_containsObject` |
| `TimeZone` | `StringPredicateInput` | Same as String |
| `RRule` | `JSONPredicateInput` | Same as JSON |
| Embeddable types | `{Type}WhereInput` | Nested field predicates |
| List relations | `{Type}RelationWhereInput` | `_some`, `_all`, `_none` |

---

## Comparison Operators

Available on all primitive predicate types.

### `_eq` -- Equality

Exact match. Case sensitive for strings.

```graphql
where: { status: { _eq: "Open" } }
```

### `_isNull` -- Null Check

Matches when the field is null (`true`) or is not null (`false`).

```graphql
where: { customerId: { _isNull: true } }
where: { customerId: { _isNull: false } }
```

### `_in` -- List Inclusion

Matches when the field value is in the provided list. Case sensitive for strings.

```graphql
where: { status: { _in: ["Open", "In Progress", "On Hold"] } }
```

### `_gt` -- Greater Than

```graphql
where: { quantity: { _gt: 100 } }
```

### `_gte` -- Greater Than or Equal

```graphql
where: { createdAt: { _gte: "2025-01-01T00:00:00Z" } }
```

### `_lt` -- Less Than

```graphql
where: { priority: { _lt: 5 } }
```

### `_lte` -- Less Than or Equal

```graphql
where: { updatedAt: { _lte: "2025-12-31T23:59:59Z" } }
```

---

## String Operators

Available on `StringPredicateInput` and `RichTextPredicateInput`. All three are **case insensitive**.

### `_startsWith`

```graphql
where: { name: { _startsWith: "WO-" } }
```

### `_endsWith`

```graphql
where: { email: { _endsWith: "@example.com" } }
```

### `_contains`

```graphql
where: { description: { _contains: "urgent" } }
```

Note: `_eq`, `_in`, `_gt`, `_gte`, `_lt`, `_lte` on strings are **case sensitive**. Only `_startsWith`, `_endsWith`, and `_contains` are case insensitive.

---

## JSON Operators

The `JSONPredicateInput` type filters JSON fields. Because JSON fields have dynamic structure, most operators require a **path** to specify which nested value to test.

### Path-Based Standard Operators

The comparison operators (`_eq`, `_isNull`, `_in`, `_gt`, `_gte`, `_lt`, `_lte`) and string operators (`_startsWith`, `_endsWith`, `_contains`) use a path-based input for JSON fields:

```graphql
# Equality at a path
where: {
  configuration: {
    _eq: { path: ["settings", "mode"], value: "automatic" }
  }
}

# Null check at a path
where: {
  configuration: {
    _isNull: { path: ["settings", "override"], value: true }
  }
}

# List inclusion at a path
where: {
  configuration: {
    _in: { path: ["settings", "mode"], value: ["automatic", "manual"] }
  }
}

# String contains at a path
where: {
  configuration: {
    _contains: { path: ["settings", "label"], value: "test" }
  }
}
```

### `_has` -- Key Existence

Checks whether a specific key exists at the given path.

```graphql
where: {
  configuration: {
    _has: { path: ["settings"], key: "override" }
  }
}
```

### `_containsObject` -- Object Containment

Matches when the JSON field contains the provided object at the specified path.

```graphql
where: {
  configuration: {
    _containsObject: {
      path: ["settings"],
      value: { mode: "automatic", enabled: true }
    }
  }
}
```

---

## Logical Operators

Available on every `{Model}WhereInput`. Used to combine multiple predicates.

### `_and` -- Logical AND

All predicates in the array must match. Use when you need multiple conditions on the **same field** or for complex nesting (top-level fields are already implicitly ANDed).

```graphql
where: {
  _and: [
    { quantity: { _gte: 10 } },
    { quantity: { _lte: 100 } }
  ]
}
```

### `_or` -- Logical OR

At least one predicate must match.

```graphql
where: {
  _or: [
    { status: { _eq: "Open" } },
    { status: { _eq: "In Progress" } }
  ]
}
```

### `_not` -- Logical NOT

The predicate must not match.

```graphql
where: {
  _not: { status: { _eq: "Closed" } }
}
```

### Combining Logical Operators

Logical operators nest for complex expressions:

```graphql
where: {
  _and: [
    {
      _or: [
        { status: { _eq: "Open" } },
        { status: { _eq: "In Progress" } }
      ]
    },
    { quantity: { _gt: 0 } },
    {
      _not: { priority: { _lt: 3 } }
    }
  ]
}
```

This matches: `(status = "Open" OR status = "In Progress") AND quantity > 0 AND NOT (priority < 3)`.

---

## Relation Predicates

For **list relation fields** (one-to-many), the system generates a `{Model}RelationWhereInput` with three operators. The inner predicate is the full `{RelatedModel}WhereInput`, so any combination of field predicates and logical operators can be used inside.

### `_some`

Matches when **at least one** related record matches. If no related records exist, `_some` never matches.

```graphql
where: {
  operations: {
    _some: { complete: { _eq: false } }
  }
}
```

### `_all`

Matches when **every** related record matches. If no related records exist, `_all` always matches (vacuous truth).

```graphql
where: {
  operations: {
    _all: { complete: { _eq: true } }
  }
}
```

### `_none`

Matches when **no** related records match. If no related records exist, `_none` always matches.

```graphql
where: {
  operations: {
    _none: { status: { _eq: "Failed" } }
  }
}
```

---

## Embeddable Type Predicates

For fields referencing embeddable types, predicates drill down into the embedded fields. Each embedded field gets its own predicate type based on its scalar type.

```graphql
where: {
  address: {
    city: { _eq: "Chicago" }
    state: { _in: ["IL", "IN", "WI"] }
  }
}
```

---

## Complete Filtering Example

```graphql
query FilteredWorkOrders {
  workOrder(
    where: {
      # Implicit AND across all top-level fields
      status: { _in: ["Open", "In Progress"] }
      quantity: { _gt: 0 }
      createdAt: { _gte: "2025-01-01T00:00:00Z" }
      name: { _contains: "priority" }
      customerId: { _isNull: false }

      # At least one incomplete operation
      operations: {
        _some: { complete: { _eq: false } }
      }

      # Exclude low-priority items
      _not: { priority: { _lte: 1 } }
    }
    orderBy: [{ field: priority, direction: desc }]
    first: 50
  ) {
    total
    edges {
      node {
        id
        name
        status
        quantity
        priority
      }
    }
  }
}
```
