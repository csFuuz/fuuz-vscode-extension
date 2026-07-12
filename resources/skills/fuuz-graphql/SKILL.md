---
name: fuuz-graphql
description: Write GraphQL queries and mutations for the Fuuz/MFGx platform API. Use when the user needs to query data, create/update/delete records, use filters, pagination, ordering, aggregations, or understand the auto-generated API types.
---

# Fuuz/MFGx GraphQL API

The platform dynamically generates a GraphQL API from model definitions at runtime. Every `Reference` kind model produces a full set of query and mutation operations following a consistent, predictable pattern.

## API Structure

For each exposed, mutable `Reference` model (e.g., `WorkOrder`), the system generates:

- **Query field**: `workOrder` (lowerCamelCase of model name) -- returns a `WorkOrderConnection!`
- **Mutations**: `createWorkOrder`, `updateWorkOrder`, `deleteWorkOrder`, `upsertWorkOrder` -- each returns `[WorkOrderDocument!]!`

### Key Conventions

- **Naming**: Query fields use `lowerCamelCase` (e.g., `workOrder`). Mutations use `create/update/delete/upsert` + model name (e.g., `createWorkOrder`).
- **Batch operations**: All mutations accept an array of payloads. You always create/update/delete in batches, even for a single item.
- **Transactions**: All operations in a single mutation call execute within one MongoDB transaction.
- **Return values**: Create/update/upsert mutations return the **after** state. Delete mutations return the **before** state (the deleted document).
- **Auto-generated fields**: Audit fields (`createdAt`, `updatedAt`, `createdByUser`, `updatedByUser`) and trace/metadata fields are automatically managed and excluded from mutation inputs.

---

## Derived Types

For a model named `WorkOrder`, these types are generated:

| Type | Purpose |
|------|---------|
| `WorkOrderConnection` | Wraps paginated results (edges, total, pageInfo) |
| `WorkOrderEdge` | Contains cursor + node |
| `WorkOrderNode` | The actual record fields (with relations resolved) |
| `WorkOrderDocument` | Raw document type (returned by mutations) |
| `WorkOrderWhereInput` | Field-level filter predicates |
| `WorkOrderOrderByInput` | Sort configuration (`field` + `direction`) |
| `WorkOrderCreateInput` | Fields available for creation |
| `WorkOrderUpdateInput` | Fields available for update |
| `WorkOrderCreatePayloadInput` | Payload wrapper: `{ create: WorkOrderCreateInput! }` |
| `WorkOrderUpdatePayloadInput` | Payload wrapper: `{ update: ..., where: ... }` |
| `WorkOrderDeletePayloadInput` | Payload wrapper: `{ where: WorkOrderWhereUniqueInput! }` |
| `WorkOrderUpsertPayloadInput` | Payload wrapper: `{ create: ..., update: ..., where: ... }` |
| `WorkOrderAggregate` | Aggregate fields for analytical queries |

---

## Queries

### Query Signature

```graphql
query {
  workOrder(
    where: WorkOrderWhereInput
    orderBy: [WorkOrderOrderByInput!]
    first: Int
    after: String
    readPreference: ReadPreferenceEnum
  ): WorkOrderConnection!
}
```

| Argument | Type | Description |
|----------|------|-------------|
| `where` | `{Model}WhereInput` | Filter predicate (see [predicates.md](predicates.md)) |
| `orderBy` | `[{Model}OrderByInput!]` | Sort criteria -- array of `{ field, direction }` |
| `first` | `Int` | Maximum results to return (page size) |
| `after` | `String` | Cursor for forward pagination |
| `readPreference` | `ReadPreferenceEnum` | `primaryPreferred` (default) or `secondary` |

### Connection Pattern

```graphql
type WorkOrderConnection {
  total: Int!                  # Total matching records (ignoring pagination)
  pageInfo: PageInfo!          # Pagination metadata
  edges: [WorkOrderEdge!]      # The page of results
}

type WorkOrderEdge {
  cursor: String!              # Opaque cursor for this position
  node: WorkOrderNode!         # The actual record
}

type PageInfo {
  startCursor: String!
  endCursor: String!
  hasPreviousPage: Boolean!
  hasNextPage: Boolean!
}
```

### Ordering

The `orderBy` argument accepts an array of sort criteria, applied in order:

```graphql
query {
  workOrder(
    orderBy: [
      { field: status, direction: asc }
      { field: createdAt, direction: desc }
    ]
  ) {
    edges { node { id name status createdAt } }
  }
}
```

Direction values: `asc` (ascending, nulls last), `desc` (descending, nulls last). Only fields marked as orderable in the model definition appear in the enum.

### Cursor-Based Forward Pagination

```graphql
# First page
query {
  workOrder(first: 25) {
    total
    pageInfo { endCursor hasNextPage }
    edges { cursor node { id name } }
  }
}

# Next page -- use endCursor from previous response
query {
  workOrder(first: 25, after: "eyJpbmRleCI6MjR9") {
    total
    pageInfo { endCursor hasNextPage }
    edges { cursor node { id name } }
  }
}
```

Cursors are opaque, index-based strings. Do not construct them manually.

### Nested Relation Queries

**Single relations** (many-to-one) return a node directly. **List relations** (one-to-many) return a full Connection with their own filtering and pagination arguments.

```graphql
query {
  workOrder(where: { status: { _eq: "In Progress" } }, first: 10) {
    edges {
      node {
        id
        name

        # Single relation -- returns a node
        customer { id name }

        # List relation -- returns a Connection
        operations(
          where: { complete: { _eq: false } }
          orderBy: [{ field: sequence, direction: asc }]
          first: 50
        ) {
          total
          edges { node { id name sequence complete } }
        }
      }
    }
  }
}
```

### Scalar Field Arguments

Certain field types accept arguments when queried:

| Field Type | Argument | Options |
|------------|----------|---------|
| `DateTime` | `round: DateTimeRoundingInput` | Unit: year, quarter, month, week, day, hour, minute, second |
| `Date` | `round: DateRoundInput` | Unit: year, quarter, month, week, day |
| `Time` | `round: TimeRoundingInput` | Unit: hour, minute, second |
| `Int` | `round: IntRoundingInput` | Multiple + direction (up, down, nearest) |
| `Float` | `round: FloatRoundingInput` | Multiple + direction |
| `RichText` | `format: RichTextFormatEnum` | `richText` (JSON), `markdown`, `plainText`, `html` |
| `RRule` | `format: RRuleFormatEnum` | Return format control |
| `Duration` | `format: DurationFormatEnum` | Return format control |

```graphql
query {
  workOrder(first: 10) {
    edges {
      node {
        id
        createdAt(round: { unit: month })
        description(format: plainText)
        quantity(round: { multiple: 10, direction: nearest })
      }
    }
  }
}
```

### Complete Query Example

```graphql
query GetActiveWorkOrders($status: String!, $limit: Int!) {
  workOrder(
    where: {
      status: { _eq: $status }
      quantity: { _gt: 0 }
    }
    orderBy: [
      { field: priority, direction: desc }
      { field: createdAt, direction: asc }
    ]
    first: $limit
  ) {
    total
    pageInfo { endCursor hasNextPage }
    edges {
      cursor
      node {
        id
        name
        status
        quantity
        priority
        createdAt
        customer { id name }
        createdByUser { id name }
      }
    }
  }
}
```

---

## Mutations

### Create

Creates one or more records.

```graphql
mutation CreateWorkOrders($payload: [WorkOrderCreatePayloadInput!]!) {
  createWorkOrder(payload: $payload) {
    id name status createdAt
  }
}
```

Variables:
```json
{
  "payload": [
    {
      "create": {
        "name": "WO-001",
        "status": "Open",
        "quantity": 100,
        "customerId": "cuid_abc123"
      }
    },
    {
      "create": {
        "name": "WO-002",
        "status": "Open",
        "quantity": 50
      }
    }
  ]
}
```

Payload structure: `{ create: {Model}CreateInput! }`. Auto-generated fields (id, timestamps, audit user) are excluded from the input.

### Update

Updates one or more records, identified by unique fields. Only supply the fields you want to change.

```graphql
mutation UpdateWorkOrder($payload: [WorkOrderUpdatePayloadInput!]!) {
  updateWorkOrder(payload: $payload) {
    id name status quantity updatedAt
  }
}
```

Variables:
```json
{
  "payload": [
    {
      "where": { "id": "cuid_abc123" },
      "update": {
        "status": "In Progress",
        "quantity": 150
      }
    }
  ]
}
```

Payload structure: `{ update: {Model}UpdateInput!, where: {Model}WhereUniqueInput! }`.

### Delete

Deletes one or more records. Returns the documents as they existed before deletion.

```graphql
mutation DeleteWorkOrders($payload: [WorkOrderDeletePayloadInput!]!) {
  deleteWorkOrder(payload: $payload) {
    id name
  }
}
```

Variables:
```json
{
  "payload": [
    { "where": { "id": "cuid_abc123" } },
    { "where": { "id": "cuid_def456" } }
  ]
}
```

Payload structure: `{ where: {Model}WhereUniqueInput! }`.

**Cascade behavior**: When a record is deleted, foreign key fields in other collections that reference it are set to `null` within the same transaction.

### Upsert

Creates a record if it does not exist, or updates it if it does. The match is based on the `where` unique fields.

```graphql
mutation UpsertWorkOrder($payload: [WorkOrderUpsertPayloadInput!]!) {
  upsertWorkOrder(payload: $payload) {
    id name status quantity
  }
}
```

Variables:
```json
{
  "payload": [
    {
      "where": { "id": "cuid_abc123" },
      "create": {
        "name": "WO-001",
        "status": "Open",
        "quantity": 100
      },
      "update": {
        "status": "Open",
        "quantity": 100
      }
    }
  ]
}
```

Payload structure: `{ create: {Model}CreateInput!, update: {Model}UpdateInput!, where: {Model}WhereUniqueInput! }`.

### WhereUniqueInput

Generated from fields marked as unique in the model definition. For most models, this is just `id`:

```graphql
input WorkOrderWhereUniqueInput {
  id: ID!
}
```

Models with multiple unique fields accept any combination:

```graphql
input ItemWhereUniqueInput {
  id: ID
  code: String
}
```

### disableReferenceChecks

All mutations accept an optional `disableReferenceChecks: Boolean` argument. When `true`, foreign key validation is skipped. Useful for bulk imports where referential integrity is managed externally.

---

## Aggregations

The API supports inline aggregation through the `_aggregate` field on Node types. Aggregations respect the parent query's `where` filters.

### Aggregate Operators

**All scalar types:**

| Operator | Description |
|----------|-------------|
| `count` | Count of documents in group |
| `uniqueCount` | Count of unique values |
| `values` | All field values in group |
| `uniqueValues` | Unique field values |
| `first(values: Int)` | First N values per `orderBy` (default 1) |
| `last(values: Int)` | Last N values per `orderBy` (default 1) |
| `minimum(values: Int)` | Smallest N values (default 1) |
| `maximum(values: Int)` | Largest N values (default 1) |

**Numeric types only (Int, Float):**

| Operator | Description |
|----------|-------------|
| `average` | Average of values |
| `sum` | Sum of values |
| `standardDeviation(method:)` | Standard deviation (`sample` default, or `population`) |
| `median` | Median value |
| `percentile(percentiles: [Int!]!)` | Percentile values (array of 0-100) |

### Ungrouped Aggregation

Select only `_aggregate` fields for whole-result-set aggregation:

```graphql
query {
  workOrder(where: { status: { _eq: "Open" } }) {
    edges {
      node {
        _aggregate {
          quantity { count sum average minimum maximum }
        }
      }
    }
  }
}
```

### Grouped Aggregation

Select regular fields alongside `_aggregate` to group by those fields:

```graphql
query {
  workOrder(
    where: { status: { _in: ["Open", "In Progress"] } }
    orderBy: [{ field: status, direction: asc }]
  ) {
    edges {
      node {
        status   # group-by dimension

        _aggregate {
          quantity { count sum average }
          priority { average minimum maximum }
        }
      }
    }
  }
}
```

Returns one edge per unique `status` value with the aggregate results for that group.

### Complete Aggregation Example

```graphql
query WorkOrderAnalytics {
  workOrder(
    where: {
      createdAt: { _gte: "2025-01-01T00:00:00Z" }
      status: { _in: ["Open", "In Progress", "Complete"] }
    }
    orderBy: [{ field: status, direction: asc }]
  ) {
    total
    edges {
      node {
        status
        _aggregate {
          quantity {
            count
            sum
            average
            median
            minimum
            maximum
            standardDeviation
            percentile(percentiles: [25, 50, 75])
          }
        }
      }
    }
  }
}
```

---

## Filtering Reference

For the complete reference on all filter predicates (`_eq`, `_in`, `_contains`, `_some`, `_none`, logical operators, JSON path queries, etc.), see [predicates.md](predicates.md).
