# Naming and deploy rules — found the hard way

Every rule here was discovered by a **failed or falsely-successful deploy** on a
live tenant, not from documentation. None of them fail at generation time, and
several do not fail at all — they succeed and quietly do less than you asked.

Check generated models against this list *before* pushing a batch. One naming
mistake fails all of them at once.

## Model names

| rule | what happens if you break it |
| --- | --- |
| **Alphabetic only — no digits** | every model in the batch is rejected. A `sapS4…` prefix failed 213 models at once; `sap…` passed. (Module ids and ApplicationConfiguration ids *may* contain digits — model names may not.) |
| **May not end in `Node`, `Edge` or `Document`** | *"reserved Data Model name suffix"*. `Node`/`Edge` collide with the generated `edges { node }` types; `Document` collides with the data-change models' `document`/`documentId`. Abbreviate the tail: `BillingDoc`. |
| The **id** is unconstrained | `plexDocument` is a legal id; `PlexDocument` is an illegal *name*. It is easy to read the error and change the wrong one. |

## Field names

- **Must begin with a lowercase letter.** Every property of a PascalCase source
  schema fails. Lowercase only the first character so `homePageURL` stays
  readable.
- **An `ID`-typed field's name must end in `Id`.** `buildingCode: ID` is
  rejected — and **neither validator names the field**: version-create says
  *"One or more fields contains an invalid type"*, deploy says *"Fields of type ID
  should include Id post field name"*. Find it by scanning your own definition.
- **Reserved, and the error names the model but not the field:**
  `createdByUser(Id)`, `changedByUser(Id)`, `updatedByUser(Id)`, `createdAt`,
  `updatedAt`, `changedAt`, `document`, `documentId`, `documentLabel`,
  `dataChanges`, `_customFields`, `_externalId`. (Found by intersecting the
  failing models' fields against the passing ones — budget for that if you hit an
  unattributed failure.)

## Relations

- **The FK scalar must be `ID` or `ID!`, never `String`.** A `String` FK silently
  breaks the reference — it deploys, and the traversal simply returns nothing.
  Type both ends the same. (The extension's compliance check `relation-fk-is-id`
  flags this.)
- **`relation.fields.to` is a field name, not hardwired to `id`.** A relation can
  resolve against any *unique* column — `partId → Part.externalId` works, verified
  end to end (create, traversal, reverse collection, upsert). That is what lets a
  mirror carry a vendor's own key as the FK with nothing computed.
- **Embedded value types are not relations.** `Measure`, `RatioMeasure`,
  `Address` and `Duration` are composite scalars stored inline. A `height: Measure`
  field has no FK and no relation; only a field ending in `Id` paired with a
  navigation field is one.
- **A dangling FK is rejected; a NULL FK is not validated.** That asymmetry is
  what makes a two-pass load possible — insert with references null, fill them in
  afterwards.
- **Deploy order is dependency order, not alphabetical.** A model carrying a
  relation cannot deploy before its target: *"references type X which is neither
  deployed nor being deployed"*.

## Deploy mechanics — where "success" is not success

**Deployment is asynchronous, and the readiness signal is the FIELDS in
introspection.** `deployDataModelVersion` returns an id immediately;
`dataModelVersion.deployed` can still be `false` seconds later and
`__type(name:"XNode")` still `null` — so the next model's relation fails with the
*same* "neither deployed nor being deployed" error a genuine ordering bug gives
you, which sends you looking in the wrong place.

**A reverse collection whose child is not yet deployed is DROPPED SILENTLY.** The
definition claims the field, the schema lacks it, nothing errors. So:

> **Never infer deploy success.** Introspect `<Name>Node { fields }` and compare
> against the relations you declared, then repair.

That single check once caught 25 missing fields across 9 models that
version-exists, the deployed flag, the deploy log *and* a second pass had all
called finished.

**The most recently deployed version serves — not the highest version number.**
A model carrying deployed 1.0.0, 1.2.0, 9.0.1, 9.0.2 and then 2.0.0 behaved as
2.0.0. So stray experimental version numbers need not be cleaned up before
shipping a lower "real" version — and version number alone never tells you what is
live. Use `dataModelVersion.deployed`, and remember a version that exists but
never deployed is not up to date.

**Forward relations resolve against DataModel records that exist at
version-create time**, while *deploy* additionally needs the target deployed. No
single ordering satisfies both, so: create **all** headers first, then deploy in
rounds, deferring what is not ready.

**`dataModel(first:N)` paginates by cursor (`after`), not offset — there is no
`skip`.** A truncated existence check turns every upgrade into a create that
fails "a record already exists" and leaves versionless model shells behind.

## Mutations

- **`update<Model>` / `delete<Model>` take a unique key only.** A predicate bulk
  update is rejected (`Field "_and" is not defined by type
  "<Model>WhereUniqueInput"`) — but GraphQL answers **HTTP 200 with the error in
  the body**, so a flow's mutate node reports success and changes nothing. Any
  "update everything matching X" must be **query → collect ids → update by id**.
  Query where-clauses are unrestricted; only mutations are keyed.
- `where.id` takes a **bare** id (`where: {id: x}`), not a predicate.
- **Nothing partial lands.** If the payload names a field the model does not have,
  the whole mutation is rejected — a failed apply leaves 0 rows, not half a page.
- Idempotent upsert, with `id` create-only:
  `{ where: {id}, create: $, update: $sift($, function($v,$k){ $k != "id" }) }`
- Excluding `id` from **both** create and update makes the platform mint a cuid.
- A reverse collection returns a **Connection** (`edges { node { … } }`), not a
  plain list.

## Bulk deploys: batch, then throttle

`createDataModelVersion` and `deployDataModelVersion` both take array payloads,
and a batch shares **one** schema regeneration — which is the entire cost.
Measured at 3,335 models: serial 12.0 s/model (~11 h) versus batched-50
0.76 s/model.

But regeneration is queued, and firing chunks back-to-back queues them faster than
the tenant retires them: one run degraded to 500s, then 503s, and finally **reads
started failing too** (60 s timeouts on a 175 ms query) — a real outage for anyone
else on that tenant. It recovered within seconds of stopping.

A safe shape, if you are deploying a catalogue: chunks of ~100 with ~30 s between
them, a per-call deadline (the client has no socket timeout), transport retry
backing off 5 s → 5 min (a 503 needs minutes, not seconds), and a guard for a
response carrying neither `errors` nor `data` — otherwise it reads as success and
crashes on the next line.

## Derived ids

Some platform models derive their `id` from a business key: `StorageUnit.id` is
`<code>_SU`, and `code` is immutable ("used to create the unique ID"). Reference
the derived id, not the code, or you get *"invalid reference id"* — and in an
upsert, set `id` explicitly so `where: {id}` matches on re-run, with `code`
excluded from the update half. Other derived-id models likely follow the same
`<code>_XX` pattern: **query `id` and `code` together before referencing either.**

## Reuse before you author

Verify the system models first (`service="system"`) — `Site`, `Product`, `Uom`,
`AppUser`, status lookups. In particular, working patterns are already modelled:

    ScheduleGroup → Schedule → ScheduleEvent { rrule, duration }
                  → ScheduleGroupExceptionEvent { rrule, duration }

Never build a custom shift/holiday calendar. `Schedule.timeline(start, end,
exception)` expands the RRULEs **server-side** and returns `[EventRange]`, which is
the whole reason to use it. Three facts that are not guessable:

- **`RRule` requires a `DTSTART`** (`DTSTART;TZID=…:20250106T090000\nRRULE:…`).
- **A day covered by an exception has its working range suppressed**, not returned
  alongside — so `workdays = count(ranges where exception == false)`, and holidays
  are derived by subtraction. Do not count exception ranges: **adjacent exceptions
  merge into one range.**
- **Parent FKs are create-only** (`Schedule.scheduleGroupId`,
  `ScheduleEvent.scheduleId`), so an upsert must drop them from the `update` half.

Custom models can relate *into* these, which is the intended pattern.
