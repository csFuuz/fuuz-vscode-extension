# Silent failures — a screen that deploys and renders less than you wrote

The platform accepts a structurally incomplete screen, reports `deployed: true`,
and renders less than you wrote. **Nothing errors** — not the API, not the console,
not the designer. Every item here was hit on a live tenant, most of them more than
once.

So the working practice is: **generate assertions, not care.** A generator that
cannot prove its own output rendered will ship blank screens.

## Three ways a screen deploys clean and renders nothing

**1. A component missing `type: "canvas"` → the whole screen is blank.**

```json
{ "name": "…", "tabTitle": "…", "type": "canvas",
  "props": { "design": { "ROOT": {…}, "<nodeId>": {…} } } }
```

`type: "canvas"` is the load-bearing key, and those four keys are exactly what a
working screen carries. There are two ways to get this wrong and both render empty
in silence: no `type: "canvas"`, and a node map somewhere other than
`props.design` (a bare `{"nodes": {…}}` deploys and reports success just the same).

**2. An element missing `custom.elementName` → that element is dropped.** An
ActionButton with correct props, correct action and the correct parent simply did
not appear until it was given a name.

**3. A filter form with nothing calling `fn.search()` → the filters render and do
nothing.** A form only builds a where-clause; the table's `search()` has to be
invoked, normally from an ActionButton.

**Assert all of it:** `type` is `"canvas"`; nodes are non-empty at
`components[0].props.design`; `name` and `tabTitle` present; a `ROOT` node of type
`Screen` exists; every element has an `elementName`; every table is named; a
`search()` call exists wherever a filter form does.

And when copying an element, copy it **field-for-field** from one that renders. A
near miss (`displayName: "Action Button"` where the working one says `"Action"`) is
indistinguishable from correct in the stored JSON.

Two more that cost a debugging session each: a screen needs a **Route** to be
reachable at all (dialogs opened via `screenDialog` do not); and `defaultSort` on a
Table names a column by its **`elementName`**, not by its field.

## The runtime discards what it does not declare

Measured across all 84 element types: the designer panel renders **every**
property the bundle declares — there are no declared-but-unexposed props — and the
runtime **discards every property it does not declare**.

`ScreenElementNode.definition` / `.configuration` are untyped `JSONObject`, so the
backend stores any key you send. **A successful write proves nothing.** Speculative
React/MUI props (`sx`, `elevation`, `tooltip`) are accepted and inert; on some
elements they are spread into the DOM, which is evidence they were *not* consumed.
There is no JSON-only configuration surface to exploit.

(The one apparent exception: `TextInput.placeholder` works because the attribute
reaches the native `<input>` and the *browser* honours it.)

Two counting notes, if you are enumerating element types: 84 exist in the resolver,
77 are placeable, but 6 of those (Add/Edit/Save/Delete/Print/Search Button) are
presets that all persist as `type: "ActionButton"` — so 71 real placeable types.
Placement refusals are **silent**. And the flat `screenElement` rows can lag
`screenVersion.design` by a whole generation after a save, so read the design.

## Forms that save

Copied field-for-field from platform screens that work:

- **Inputs bind by name, not by nesting.** Every input carries `formElement`
  (the Form's `elementName`), `dataPath`, `field` and `element`. An input missing
  `formElement` or `field` is bound to nothing and **saves nothing, silently** —
  the same failure class as a missing `elementName`.
- **Save** is an ActionButton whose action is
  `[{ type: "transformation", transformation: "$components.Form1.fn.save()", remote: false }]`,
  with `disabled` bound to the form's `formState`.
- **`query.parameters` is a JSON *string* whose values are JSONata**, e.g.
  `{"filter":{"id":{"_eq":id}},"first":1}`. A platform screen resolves a URL param
  as a **bare name** (`id`); a dialog screen reads
  `$metadata.urlParameters.<key>`. Both are real, so accept either.
  `autoLoad: false` with no `parameters` is a create form.
- **A Combobox binds the relation, never the FK**: `dataPath`/`field` of
  `"account"`, not `"accountId"`, plus `queryType` and a label field. Prefer it over
  SelectInput for any large option list — **a select truncates its options
  silently.**
- **A `flow` action carries no payload.** Both live examples are bare
  `{type: "flow", flowId: "…"}`, so a button cannot tell a flow which record to act
  on. Design the flow to work out its own worklist — better anyway, because one
  button then fixes every pending edit and a schedule can call the same flow.

### An undefined filter value matches EVERYTHING

A create form built as `parameters: {"filter":{"id":{"_eq": someUndefinedName}}}`
does **not** produce `id._eq: null` — the key is dropped. Measured:

```
where {id:{_eq:null}}  →  0 rows     (a null is a real constraint)
where {id:{}}          →  1 row      ← matches everything
where {}               →  1 row      ← matches everything
```

With `dataPath: "edges[0]"` the form then loads the **first record in the table**
and presents it as the contents of a "new" form. Guard with a value that is
*present but cannot match* (`"__none__"`), never with a null check.

## Tables

- **Fixed server-side filter** = `query.filterPredicate` (editor type
  `graphqlWhere`). `query.parameters` is a *jsonata* transform, not a static blob.
  Relation predicates take `_some` / `_all` / `_none`; `_none` is the only way to
  express "has no matching child". There is no `_neq`/`_nin`.
- **Filtering in a `dataTransform` drops rows AFTER paging**, so the row count and
  the "N of M" footer both lie.
- **A column needs `field` alongside `dataPath`**, or it renders a header with no
  data.
- **There is no usable row-click hook.** Master-detail is a `TableColumn` with
  `format: "action"` launching a `screenDialog`; the dialog reads what it was given
  as `$metadata.urlParameters.<key>`.
- **No TableColumn can style itself.** Across 407 deployed screen versions, not one
  uses a cell-styling prop. A conditional colour indicator must be **stored as
  markup in the data** and rendered by a `format: "markdown"` column — with
  **inline styles only**, because markdown cells strip `<style>`, `:hover` and
  `@keyframes`. Native `title=` is the only tooltip that survives.
- **An invisible element still runs its query.** A Table with `visible: false`
  keeps populating `$components.<name>.data`, so it works as a pure data conduit
  with no UI cost.

## Number formats — two traps that render plausible nonsense

```
money    format 'float'    formatString '$0,0.00'
percent  format 'integer'  and the '%' goes in the COLUMN LABEL
count    format 'integer'  no pattern
hours    format 'float'    formatString '0.0'
ratio    format 'float'    formatString '0.00'
```

- **`format: 'currency'` ignores `formatString`.** It renders a default, so a
  pattern set alongside it is never exercised. Money is `float` with a
  symbol-bearing pattern.
- **numeral's `%` multiplies by 100.** A percentage stored as a whole number (80
  meaning 80%) renders as **8000%** under a `'0%'` pattern. The honest
  implementation is an integer in a column labelled `%`.
- Numeric **form** fields are `FloatInput` / `IntegerInput` — never a `TextInput`
  with `type: "number"`, which stores a **string**.
- An unformatted numeric column shows a raw number and reads as a bug. Set the
  format explicitly on every money/percent/count column; infer it from the
  data-path leaf rather than naming columns by hand.

## Surfaces and spacing

Fuuz containers get **no implicit spacing**, and a bare `Container` renders flush
and transparent — so a generated action bar and table sit on the page with no
surface and no breathing room. Every element is present and wired, and it looks
unfinished.

```
action-bar container : background: 'default', margin: 1, padding: 3
table-slot container : background: 'default', margin: 1
table                : margin: 1        (the container owns the spacing)
ActionButton         : width/height 'auto' is correct — leave them
```

It is the **container surfaces** that need setting, not the buttons. On any dense
or multi-container screen, set a flex/grid `gap` on the parent and `padding` /
`margin` on the children, or siblings collapse together and overlap.

## Renaming a TabBar or a Table breaks its children

A TabBar's panels and a master-detail Table's detail live in the owner's
`linkedNodes`, keyed `<ownerElementName>Detail<n>` (`Tabs1` → `Tabs1Detail0`;
`Table1` → `Table1Detail`). At runtime the owner looks its panels up by
`<currentName>Detail<n>`.

Rename only the owner's `custom.elementName` and the keys still say the old name:
the owner finds nothing, renders empty tabs, and the original children are
orphaned in the definition under the old key. **Realign the `linkedNodes` keys and
the child container's own `elementName` in the same edit**, keeping the child
node-ids so content moves with the key. Then verify no key prefix differs from its
owner's current name. (TabBar also mints a literal `undefinedDetail0` at creation.)

## Charts are four artifacts

A chart is a saved query, a **SavedTransform** (JSONata → datasource, versioned
SemVer and *deployed*), a **Visualization** record, and a `Visualization` element
naming it. The element needs a non-empty `dataPath` whose key the transform
actually returns, plus a `formElement` naming a real Form.

**The carrier form must NOT declare a model.** `dataPath` names a key in the
*transform's* output, but the runtime resolves it against the *form's* model and
folds it into that form's GraphQL selection — so a chart form with `query.model`
set fails at runtime the moment `dataPath` is not also a real field on that model
(`Cannot query field "…" on type "…Node"`). The working shape: **no `model` key at
all**, `fields: ["id"]`, `dataPath: "edges[0]"`. The transform fetches its own rows;
the form is a carrier and nothing more. Assert it — a model on a chart's form is
always a bug.

`visualizationType` declares 104 ids — query them, don't guess — and
`visualizationTypeId` is **create-only**, so a wrong type means deleting the record
rather than editing it.

**Tabs on a canvas screen come from the `TabBar` element**, not from multiple
`design.components[]` entries (those render as tabs only for declarative
`form`/`table` components with no `props.design`).

## DateRangeInput

- Presets are controlled by `includePrevious` / `includeCurrent` / `includeNext` /
  `includeCustom` (default true). `includeNext: false` is how you keep the window
  in the past.
- **`minDate` / `maxDate` are not honoured on a range input** (they work on single
  `DateInput` / `DateTimeInput`). A `maxDate: $now()` envelope on a range is
  ignored — clamp server-side in the resolver instead.
- The value is a **relative descriptor** (`{data:{unit,offset,range,base},label}`),
  not ISO — resolve it to start/end in a transform.

## Never regenerate a screen a human has edited

A generator that rebuilds a screen from scratch is correct once and destructive
thereafter. Three ownership rules were tried before one held:

1. **Diff generator output against the live design** — false alarms, because
   changing a generator changes every derived node key (25 phantom "losses" on one
   table).
2. **The latest version's `updatedByUserId`** — patching somebody's draft sets
   `updatedBy` to you, so the next run treats their screen as yours.
3. **The latest version's `createdByUserId`** — patch-and-deploy creates a version
   under your id: the same hole, one step later.

The rule that works: **if any version in the history was created by another user,
refuse full regeneration permanently** and change the screen only by targeted
patches that assert they touched only the nodes they claimed. Saved transforms and
visualizations are safe to regenerate; they are not hand-edited.
