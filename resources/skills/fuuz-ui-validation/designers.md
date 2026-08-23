# Driving the App Designer

Everything here was established live against a real tenant and confirmed by
reading the saved record back — never by looking at the canvas. Do the same.

Prefer the API for anything the API can do. Come here for what it cannot:
relations, ID fields, screen generation from a template, injecting a flow, and
seeing whether a thing actually renders.

## Landing page and surfaces

Designer **cards**: Data Model, Data Flow, Screen — plus Application Graph,
Script Editor, GraphQL Editor, Data Explorer, API Documentation.
`#createNewButton` is the "new component" plus.

| surface | selector |
| --- | --- |
| screen canvas | `#mfgx-screen-designer-canvas` |
| schema canvas | `#mfgx-data-model-diagram` |
| flow canvas | `[id$="-mfgx-data-flow-diagram"]` (prefix = flow id) |
| open tab | `[data-tab-id]` — also how you resolve the screen id in the designer |
| menu items | `[data-menu-bar-menu-item="Save"|"Save All"|"Deploy All"|"New Model"|…]` |
| structure tree | `ul[role=tree]` → `li[role=treeitem][data-node-id]` (craft node id) |
| canvas element | `[data-system-name="<elementName>"]` (containers also get `id`) |

**The structure tree is lazy and filtered.** A collapsed row renders zero
children whatever its count label says, and the filter chips can hide everything
("Nothing matches the selected filters."). Children sit under
`ul[role=group] > .MuiCollapse-wrapper > .MuiCollapse-wrapperInner > div` — not as
direct descendants. Anything that scrapes the tree must report completeness or it
will present a truncated tree as the whole thing.

## Confirm buttons: the icon varies per dialog

`button[data-button=<icon>]`, and the affirmative icon is **not** always `check`:

| dialog | icon |
| --- | --- |
| New Model, Create Relation | `check` |
| New Flow | `file` |
| Save New Flow | `save` |
| Deploy Data Flow | `upload` |
| Generate screen from template | `desktop` |

Matching only `check` hunts a button that does not exist. A "click the last
button in the dialog" fallback finds the **xmark** and cancels. Match the icon
set, and assert the dialog closed.

Save / deploy on toolbars are `svg[data-icon=floppy-disk]` /
`svg[data-icon=upload]`. **Never locate them by pixel box** — a hardcoded rect is
valid at exactly one window width.

## Schema designer (data models)

- Model card `#mfgx-node-<ModelName>`; the platform PascalCases what you type.
- Add a field: `input[placeholder="New field name"]` on the card, type, Enter —
  commits as `String`.
- A field row's name is a `<p>` normally but an **`<input>` while that row is
  active**, so match both — otherwise lookup fails on the field you just added,
  which is the one you are about to configure.
- The type picker offers **scalars only**. Relations are a gesture, not a type.

**Three things are gated on SAVE, and each fails as an empty control, not an
error:**

1. **ID Field** — makes a business key the primary reference (a machine's `id`
   *is* its `code`). The field must be flagged Unique **and saved**; until then
   the select offers zero options, indistinguishable from a broken control.
2. **Label Field** — model-level display label; this one does take pre-save.
3. **Relations** — drag from the parent card's port and **drop on the child
   card's BODY**. Dropping on the child's *port* (what a flow-canvas link
   targets) saves cleanly and creates no foreign key at all. Both models must
   already be saved, and the cards must not be stacked — new cards land at the
   same origin, and a card is moved by dragging its **title row** (anywhere else
   starts a link or lands in a field input).

**`File > Deploy All` does not deploy — it asks.** "Deploy 2 data models?" must be
confirmed; unanswered, the menu click succeeds, nothing errors, and the models sit
at `deployed: false` while your introspection poll times out looking exactly like
a slow deploy. And deploying a **change** to an already-deployed model asks an
extra required question — "Data migration required?" — that a fresh v1 never
shows. A confirm that ignores it leaves the version undeployed, silently.

## Flow designer

- **A new flow is named at SAVE, not at creation.** The New Flow dialog has no
  name field — only Module, Environment (Backend | Gateway | Web) and Type, where
  Environment gates Type. The first save raises "Save New Flow" with Name
  (required), Module, Description, Active, Version `0.0.1`. Miss that dialog and
  the save completes nothing: no error, and no `DataFlow` record afterwards.
- **Ports:** `div.port[data-name=<cuid>][data-nodeid=<id>]`, inputs on the left,
  outputs on the right, and on a node the outputs are **DOM-ordered** — `ifElse`
  is True then False. Wired backwards, the flow runs and is silently wrong, so
  assert `data.onTrueNextNodes` / `onFalseNextNodes` after saving.
- Dropped nodes get generated uuids. Discover them by diffing the node set across
  the drop, which also makes the drop self-verifying.
- **Running a flow in the designer is called INJECT** — there is no play button
  anywhere. `Edit > Inject All Nodes` (⇧⌘J) / `Inject Selected Nodes` (⌘J), and
  `Designer > Execute Last Debug Node` (⌘↩) to re-fire. The trigger is a
  **Source** (`debugSource`) node carrying `data.payload` / `data.context`, and
  **a dropped Source arrives DISABLED** with a `ban-bug` badge: Inject then does
  nothing at all — no error, no console line — until the badge is clicked to arm
  it. Output is a per-node input/output trace under `View > Toggle Console`.
- The stray "Only a transition node can intercept links!" warning is harmless.
- **MCP tool exposure is not in the designer.** `File > Edit Properties` carries
  only id/name/description/module/logLevel. The switch is on the flow's admin
  form at `/system/orchestration/dataFlows/<id>` → Details → **MCP Tool
  Configuration**. That form **will not save `inputSchema`** — it writes `null`
  over an existing one — so set it over the API instead. With it null the tool
  registers, is callable, and every call fails with a 500 that reads like a broken
  flow.
- API documentation for a flow appears **only once deployed**; on a draft the page
  shows name/module/type and looks broken.

## Screen designer

**Generating a screen from a data model** (`File > New` → Form | Table | Blank)
scaffolds a working screen in one gesture. Four traps, each silent:

- The confirm is `data-button="desktop"`, not `check`.
- `text=Table` **also matches the toolbox's Table element** — scope the template
  click to `[role=dialog]`, or the chooser never opens and the later data-model
  lookup times out looking like a render failure.
- "Data Model Fields" is a checkbox that **reveals** a field tree with "Select
  All" pre-ticked — 35 columns including `_trace.*`, `_metadata.*`, `_aggregate`
  and both audit relations. Clear it and pick. Rows read like
  `temperatureCField arguments: roundFloat`, so match on a prefix.
- The save dialog **requires Module** for screens. Without it, nothing is
  created — silently.

Then `File > Deploy`, then `Designer > Run Screen`, which opens
`/system/configuration/screens/<versionId>/run` in a **new tab**. The deploy
confirmation leaves an overlay that swallows the next menu click, so dismiss it
before reaching for Run Screen.

## Two habits that pay for themselves

**Reveal controls individually.** A blanket "expand every section" pass *toggles*
them, so an already-open Details section closes and its Name field disappears —
every later click then fails "element is not visible" while the container still
measures as visible.

**Probe the right node for visibility.** A react-select's own input is
deliberately near-invisible: check the `[data-data-path]` **container** for
selects, and the inner element for text and code editors. Get this backwards and
the reveal logic thrashes, leaving dialogs unfilled.

## Mutation envelopes (for the read-back, and for the API path)

All return HTTP 200 with any error in the body:

```
deleteX(payload: [{ where: { id } }])
createX(payload: [{ create: {…} }])
upsertX(payload: [{ where, create, update }])
```

`deployDataModelVersion(payload:[{dataModelVersionId}])` returns a deployment id
but has been observed **not** to complete the deploy — for models, trust the UI
path and verify by introspection.

A **deployed** model *can* be deleted once its rows are gone; the refusal is
"Cannot delete data model with existing data", not anything about deployment.
Purge children first, or the relation's `prevent` behaviour vetoes the parent.
