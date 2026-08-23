---
name: fuuz-data-model
description: Create and configure Fuuz data models (ModelDefinition). Use when the user needs to define models, add fields, set up relations, configure triggers, sequences, indices, or migrations in the Fuuz/MFGx platform.
---

# Fuuz Data Model Reference

How to create and configure data models in the Fuuz/MFGx platform. Each model becomes a fully-featured GraphQL type with queries, mutations, subscriptions, filtering, sorting, and pagination.

---

## Reuse system models before creating custom ones

> ⚠️ **Always check the existing SYSTEM data models before authoring a custom
> model** (`fuuz_list_models` with `service: "system"`). The platform already
> ships many models — reuse them and reference them by relation instead of
> duplicating. Creating a custom `Shift` or `Site` when the platform already has
> one fragments the data and breaks built-in behavior.

Common platform models to reuse: `Site`, `Product`, `Uom`, `AppUser`, and status
lookups. In particular:

- **Shifts & shift cycles are defined via `ScheduleGroup` and `Schedule`** — a
  `ScheduleGroup` groups schedules; `Schedule` entries define shifts and shift
  cycles. Do NOT create custom shift/shift-cycle models; relate to these instead.

Only create a custom model when no system model fits the requirement.

---

## Model Definition Structure

A model definition has five top-level properties:

```json
{
  "name": "WorkOrder",
  "kind": "Reference",
  "description": "A manufacturing work order.",
  "metadata": { },
  "fields": [ ]
}
```

- **name** -- PascalCase. Becomes the GraphQL type name (e.g. `WorkOrder`).
- **kind** -- One of `Reference`, `Embeddable`, or `Abstract`.
- **description** -- Human-readable summary.
- **metadata** -- Controls API exposure, access, triggers, indices, and more.
- **fields** -- Array of field definitions.

### Model Kinds

| Kind | Purpose |
|------|---------|
| `Reference` | Standard model stored in its own collection. Generates full query/mutation API. This is the kind you author in package-data. |
| `Embeddable` | Nested object type embedded inside Reference models. No own collection or top-level API. Only built-in embeddable types are available. |
| `Abstract` | Derived types generated at runtime (Connection, Edge, WhereInput, etc.). Never authored directly. |

---

## Package-Data Container

In `package-data.json`, each data model is wrapped in a container with `header`, `version`, `migration`, and `migrations`. The `version.modelDefinition` holds the actual model. See the Complete Model Example at the end for the full structure.

### dataModelTypeId

Classifies the model's data lifecycle:

| Value | Use Case |
|-------|----------|
| `setup` | Configuration data (e.g. Unit, Area, WorkCenter) |
| `master` | Master data (e.g. Item, Process, Customer) |
| `transactional` | Transactional data (e.g. WorkOrder, ProductionRecord) |
| `null` | Unclassified |

---

## Model Metadata

The `metadata` object has three sections: `mfgx`, `mongo`, and `graphql`.

### metadata.mfgx

Controls platform behavior. Properties:

| Property | Description |
|----------|-------------|
| `exposed` | Whether the model appears in the GraphQL API |
| `mutable` | Whether mutations are allowed at all |
| `mutations.create/update/del` | Enable or disable specific mutation types |
| `queries.defaultReadPreference` | MongoDB read preference (`primaryPreferred` or `secondary`) |
| `dataChangePublishEnabled` | Publish events when records change (per operation or boolean for all) |
| `dataChangeCapture` | Track change history with optional field exclusions and retention |
| `customFields.exposed` | Allow tenant-defined extension fields via `_customFields` |
| `labelField` | Field used as the display label (e.g. `"name"`, `"code"`) |
| `tenantTypeAccess` | Restrict access by tenant type |
| `accessControl.permissionRoot` | Whether this model is a permission root |
| `exposeTrace` | Add `_trace` field with change trace information |
| `exposeMetadata` | Add `_metadata` field with package installation info |

### metadata.mongo

```json
{
  "mongo": {
    "collection": "workOrders"
  }
}
```

Specifies the MongoDB collection name. Usually the lowercase plural/camelCase of the model name.

### metadata.graphql

Used internally by the schema generation system. You typically do not set this.

---

## Triggers

JSONata expressions executed during mutations. Defined in `metadata.mfgx.triggers`.

```json
{
  "triggers": {
    "create": "$isNilOrEmpty($.id) ? $~>|$|{\"id\": $uppercase($.code)}| : $",
    "update": "$~>|$|{\"fullName\": $.firstName & ' ' & $.lastName}|",
    "delete": "..."
  }
}
```

Trigger keys: `create`, `update`, `delete`.

### Trigger Bindings

| Binding | Description |
|---------|-------------|
| `$` | The mutation input (create or update payload). Not set for delete. |
| `$before` | Current record state before the mutation. `null` for create. |
| `$after` | Projected record state after the mutation. `null` for delete. |
| `$where` | The `where` predicate (present on update and delete). |
| `$appConfig` | The tenant's application configuration. |

### Trigger Example: Conditional Recalculation

```
$before.quantity != $.quantity or $before.price != $.price
  ? $~>|$|{"total": $.quantity * $.price}|
  : $
```

Triggers run in **read-only mode**. They can call `$query` but cannot use `$mutate`, `$integrate`, `$executeTransform`, `$executeFlow`, or `$aggregate`.

---

## Fields

Each field has four properties:

```json
{
  "name": "code",
  "type": "String!",
  "description": "Unique code for this record.",
  "metadata": { }
}
```

- **name** -- camelCase.
- **type** -- GraphQL-style type string (see Type System below).
- **description** -- Human-readable.
- **metadata** -- Controls relations, mutations, defaults, validation, and more.

### Field Metadata (metadata.mfgx)

Properties:

| Property | Description |
|----------|-------------|
| `relation` | Defines a relationship to another model (see Relations) |
| `mutable` | Whether this field can be changed after creation |
| `mutations.create` | `{ "include": true/false }` or `{ "required": true/false }` |
| `mutations.update` | `{ "include": true/false }` |
| `where.include` | Whether this field appears in WhereInput for filtering |
| `orderBy.include` | Whether this field appears in OrderByInput for sorting |
| `defaultValue` | Default value when not provided |
| `schema` | JSON Schema validation for the field value |
| `sequence` | Auto-increment configuration (see Sequences) |
| `dependsOnFields` | Fields this field depends on (for computed fields) |

---

## Type System

### Type String Format

| Format | Meaning | Example |
|--------|---------|---------|
| `Type` | Nullable value | `String` |
| `Type!` | Non-null (required) value | `String!` |
| `[Type]` | Nullable list of nullable items | `[String]` |
| `[Type!]` | Nullable list of non-null items | `[String!]` |
| `[Type!]!` | Required list of non-null items | `[ID!]!` |

### Primitive Types

| Type | Description |
|------|-------------|
| `ID` | Unique identifier (string) |
| `Int` | 32-bit integer |
| `Float` | Double-precision floating point |
| `Boolean` | True/false |
| `String` | UTF-8 string |
| `DateTime` | ISO 8601 date-time (`"2024-01-15T10:30:00Z"`) |
| `Date` | ISO 8601 date (`"2024-01-15"`) |
| `Time` | ISO 8601 time (`"10:30:00"`) |
| `JSON` | Arbitrary JSON value |
| `JSONObject` | JSON object (not array or scalar) |
| `TimeZone` | IANA time zone (`"America/New_York"`) |
| `Duration` | ISO 8601 duration (`"PT1H30M"`) |
| `IPCidr` | IP address in CIDR notation |
| `IPv4Cidr` | IPv4 in CIDR notation |
| `IPv6Cidr` | IPv6 in CIDR notation |

### Extended Scalars

| Type | Description |
|------|-------------|
| `RichText` | Rich text content (supports format argument) |
| `RRule` | Recurrence rule per RFC 5545 (supports format argument) |

### Common Embeddable Types

These are nested object types you can use as field types:

**Measure** -- A value with a unit of measurement:
```json
{ "value": 10.5, "unitId": "unit-uuid" }
```
Fields: `value` (Float!), `unitId` (ID!), `unit` (Unit! -- resolved relation).

**RatioMeasure** -- A ratio between two units (e.g. pieces per hour):
```json
{
  "numeratorValue": 100,
  "numeratorUnitId": "pieces-uuid",
  "denominatorValue": 1,
  "denominatorUnitId": "hour-uuid"
}
```

**Address** -- A physical address:
```json
{ "lines": ["123 Main St"], "city": "Springfield", "state": "IL", "postalCode": "62701", "country": "US" }
```

Other embeddable types: `SavedQueryParameter`, `ExportHistoryFile`, `DataFlowMCPToolConfiguration`, `SchedulingConfigurationRunFilter`.

### Reference Types

When a field's type is the name of another Reference model (e.g. `Area`, `Item`, `User`), it represents a relation. The field must have `metadata.mfgx.relation` configured.

> **Embedded value types are NOT relations.** `Measure`, `RatioMeasure`, `Address`, and `Duration` are composite scalars stored inline (value + unit / parts). A field like `height: Measure` or `width: Measure` has **no foreign key and no relation** — do not add a `heightId`, a `metadata.mfgx.relation`, or an ERD edge for it. Only a field whose name ends in `Id` (e.g. `packagingConfigurationId: ID`, paired with the navigation field `packagingConfiguration: PackagingConfiguration`) is a relation FK.

---

## Relations

Relations link models via foreign keys. They require two fields defined together.

### Pattern

1. A **foreign key field** that stores the ID value.
2. A **relation field** that resolves to the related model, with `metadata.mfgx.relation.fields` mapping `from` (local FK) to `to` (target field, usually `"id"`).

> ⚠️ **RULE — relation foreign keys are typed `ID`, never `String`.** The scalar
> field named in `relation.fields.from` (e.g. `siteId`, `producedProductId`,
> `statusCodeId`) MUST be `ID!` (required relation) or `ID` (optional relation) —
> the same type family as the `to` target's `id`. Typing an FK `String` silently
> breaks the reference. This applies to **every** FK that backs a relation.
>
> ❌ `{ "name": "siteId", "type": "String" }` with a `site` relation pointing at it
> ✅ `{ "name": "siteId", "type": "ID" }` (nullable) or `"ID!"` (required)

### Example: Linking WorkOrder to Area

```json
[
  {
    "name": "areaId",
    "type": "ID!",
    "description": "The unique identifier of the Area.",
    "metadata": {
      "mfgx": {}
    }
  },
  {
    "name": "area",
    "type": "Area!",
    "description": "The associated Area.",
    "metadata": {
      "mfgx": {
        "relation": {
          "fields": { "from": "areaId", "to": "id" }
        }
      }
    }
  }
]
```

### Optional Relation

For optional relations, use nullable types (`ID` and `Area` instead of `ID!` and `Area!`).

### Required vs optional, and uniqueness — ASK the developer

Whether a relation is **required** (`ID!`/`Area!`) or **optional** (`ID`/`Area`), and
whether it is **unique** (at most one record may point at a given target — a 1:1),
are **business decisions specific to the use case**. Do not assume — ask the developer.

- **Heuristic to raise, not to auto-apply:** relations to **setup / lookup models**
  (status, type, category, and similar `StatusCode` / `*Type` / `*Category` references)
  are *usually* **required** — e.g. a formula must have a status. Propose `ID!` for
  these and confirm.
- **Uniqueness:** if only one record may reference a given target (1:1), mark the FK
  `metadata.unique: true`. This is rarely the default — confirm before setting it.
- **When creating any model with relations, ask up front**, e.g.:
  - "Is each of these relations required, or can a record exist without it?
    (`status`, `type`, `category` are usually required.)"
  - "Should any relation be unique (one-to-one)?"

The FK **type is still `ID`/`ID!` regardless** — requiredness only changes the `!`,
never `ID` → `String`.

### Deletion Reference Behavior

Set `deletionReferenceBehavior` on the relation field to control what happens when the referenced record is deleted:

| Value | Behavior |
|-------|----------|
| `prevent` | Block deletion if references exist (default) |
| `cascade` | Delete referencing records too |
| `setNull` | Set the foreign key to null |
| `ignore` | Allow deletion without checks |

---

## Sequences

Auto-incrementing fields. Configured via `metadata.mfgx.sequence` on the field.

```json
{
  "name": "number",
  "type": "Int!",
  "description": "Auto-generated sequence number.",
  "metadata": {
    "mfgx": {
      "sequence": {
        "id": "workOrderNumber",
        "keyField": "facilityId"
      },
      "mutations": {
        "create": { "include": false },
        "update": { "include": false }
      }
    }
  }
}
```

- **id** -- Name of the sequence.
- **keyField** -- Optional. Scopes the sequence per value of this field (e.g. separate numbering per facility).

Sequence fields should exclude themselves from mutations since values are auto-generated.

---

## Indices

Defined at the model level in `metadata.mfgx.indices`:

```json
{
  "indices": [
    {
      "name": "unique_code",
      "unique": true,
      "fields": ["code"]
    },
    {
      "name": "compound_area_sequence",
      "unique": true,
      "fields": ["areaId", "sequence"]
    }
  ]
}
```

- **name** -- Unique index name.
- **unique** -- Whether the index enforces uniqueness.
- **fields** -- Array of field names included in the index.

---

## Migrations

When a model's version changes, migrations define how existing data transforms to the new structure.

```json
{
  "migrations": [
    {
      "dataModelVersionId": "new-version-uuid",
      "dataModelVersion": { "number": 2 },
      "mappingExpression": "$~>|$|{\"newField\": $.oldField}|"
    }
  ]
}
```

- **mappingExpression** -- A JSONata expression transforming old records to the new schema.
- `"$"` -- Identity migration (no transformation needed). Use this for version 1 and for changes that only add new optional fields.

---

## Auto-Generated Fields

These fields are automatically added to every Reference model. You do not define them in the `fields` array.

### Audit Fields (always present)

| Field | Type | Description |
|-------|------|-------------|
| `createdAt` | `DateTime!` | When the record was created |
| `createdByUserId` | `ID!` | Creator's user ID |
| `createdByUser` | `User!` | Resolved creator |
| `updatedAt` | `DateTime!` | Last update timestamp |
| `updatedByUserId` | `ID!` | Last updater's user ID |
| `updatedByUser` | `User!` | Resolved last updater |

### Trace Fields (when exposeTrace is true)

| Field | Type |
|-------|------|
| `_trace` | `ApplicationTraceMetadata` |

### Metadata Fields (when exposeMetadata is true)

| Field | Type |
|-------|------|
| `_metadata` | `ApplicationMetadata` |

### Custom Fields (when customFields.exposed is true)

Adds a `_customFields` field allowing tenant-defined extension fields.

---

## Derived Types

Each Reference model automatically generates Abstract types at runtime. For a model named `Item`:

- **Query types**: `ItemNode`, `ItemConnection`, `ItemEdge`, `ItemAggregate`
- **Filter/sort types**: `ItemWhereInput`, `ItemWhereUniqueInput`, `ItemRelationWhereInput`, `ItemOrderByInput`
- **Mutation types**: `ItemCreateInput`, `ItemUpdateInput`, `ItemCreatePayloadInput`, `ItemUpdatePayloadInput`, `ItemDeletePayloadInput`, `ItemUpsertPayloadInput`
- **Other**: `ItemDataChange`, `Item_CustomFields`

---

## Complete Model Example

A "Machine" setup model with a relation, sequence, index, and trigger. Shows the full package-data container with modelDefinition inside:

```json
{
  "header": {
    "id": "aaaa-bbbb-cccc-dddd",
    "name": "Machine",
    "description": "A production machine.",
    "dataModelKindId": "reference"
  },
  "version": {
    "id": "eeee-ffff-0000-1111",
    "number": 1,
    "dataModelId": "aaaa-bbbb-cccc-dddd",
    "dataModelTypeId": "setup",
    "modelDefinition": {
      "name": "Machine",
      "kind": "Reference",
      "description": "A production machine.",
      "metadata": {
        "mfgx": {
          "module": { "id": "manufacturing", "group": { "id": "core" } },
          "exposed": true, "mutable": true,
          "mutations": { "create": true, "update": true, "del": true },
          "labelField": "name",
          "customFields": { "exposed": true },
          "dataChangePublishEnabled": true,
          "indices": [{ "name": "unique_code", "unique": true, "fields": ["code"] }],
          "triggers": { "create": "$isNilOrEmpty($.id) ? $~>|$|{\"id\": $uppercase($.code)}| : $" }
        },
        "mongo": { "collection": "machines" }
      },
      "fields": [
        { "name": "id", "type": "ID!", "description": "Unique identifier.",
          "metadata": { "mfgx": { "mutations": { "create": { "include": true }, "update": { "include": false } } } } },
        { "name": "code", "type": "String!", "description": "Unique machine code.",
          "metadata": { "mfgx": { "mutations": { "create": { "required": true }, "update": { "include": true } },
            "schema": { "type": "string", "minLength": 1, "maxLength": 50 } } } },
        { "name": "name", "type": "String!", "description": "Display name.",
          "metadata": { "mfgx": { "mutations": { "create": { "required": true }, "update": { "include": true } } } } },
        { "name": "status", "type": "String!", "description": "Current status.",
          "metadata": { "mfgx": { "defaultValue": "ACTIVE" } } },
        { "name": "maxCapacity", "type": "Measure", "description": "Maximum production capacity.",
          "metadata": { "mfgx": {} } },
        { "name": "areaId", "type": "ID!", "description": "FK to Area.",
          "metadata": { "mfgx": { "mutations": { "create": { "required": true }, "update": { "include": true } } } } },
        { "name": "area", "type": "Area!", "description": "The associated Area.",
          "metadata": { "mfgx": { "relation": { "fields": { "from": "areaId", "to": "id" }, "deletionReferenceBehavior": "prevent" } } } },
        { "name": "number", "type": "Int!", "description": "Auto-generated sequence number per area.",
          "metadata": { "mfgx": { "sequence": { "id": "machineNumber", "keyField": "areaId" },
            "mutations": { "create": { "include": false }, "update": { "include": false } } } } }
      ]
    }
  },
  "migration": "$",
  "migrations": [{ "dataModelVersionId": "eeee-ffff-0000-1111", "dataModelVersion": { "number": 1 }, "mappingExpression": "$" }]
}
```

## Before you deploy: read [deploy-rules.md](./deploy-rules.md)

Naming and deploy behaviour that fails **only** at `createDataModelVersion` /
`deployDataModelVersion` — or does not fail at all and quietly serves an
incomplete schema. Model names may not contain digits or end in `Node`/`Edge`/
`Document`; an `ID` field's name must end in `Id`; a reverse collection to an
undeployed child is dropped **silently**; deployment is asynchronous, so the only
proof it worked is introspecting `<Name>Node { fields }`; and the *most recently
deployed* version serves, not the highest number. Also there: derived ids, unique-
key-only mutations, and the system `Schedule*` models to reuse instead of building
a calendar.
