# Scripts

Nodes for running transformation scripts against the workflow state payload.

## State Bindings in Expressions

Both JSONata and JavaScript expressions share the same state bindings. The full workflow state is accessible via `$state`:

| Binding | Description |
|---------|-------------|
| `$` | In JSONata, the contextual focus — at the root of a script this is the input payload, but inside a nested path (e.g., `$.items.( $ )`) it shifts to the current item. In JavaScript, `$` is always the input payload. |
| `$$` | The root input payload — always refers to the top-level input regardless of nesting depth. Use this to escape back to the root from within a nested JSONata scope. |
| `$state.context` | Persistent key-value store set by Set Context / Merge Context nodes |
| `$state.claims` | Authentication claims from the initiating user or system |
| `$state.lastError` | Error details when routed through a Try Catch handler (`message`, `stack`, `node`) |

Context values persist across nodes once set (via Set Context or Merge Context) and remain available to all downstream nodes unless explicitly removed by a Remove From Context node.

For detailed coverage of JSONata and JavaScript expression syntax, scoping rules, and available functions, see the **fuuz-expressions** skill.

---

## JSONata (Transform)

| | |
|---|---|
| **Name** | `transform` |
| **Title** | JSONata |
| **Responsibility** | transition |
| **Description** | Runs a script using the JSONata language on the workflow state. This is the primary transformation node for most data flow logic. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `transform` | string | jsonata | Yes | A JSONata script to run on the workflow state. |

Standard output port.

**Validation:** minimumNoteLength: 20, requireChangedName, requireInputNode, requireWalkthrough

### Example Configuration

```json
{
  "transform": "{ \"fullName\": firstName & ' ' & lastName, \"total\": $sum(items.price) }"
}
```

---

## JavaScript

| | |
|---|---|
| **Name** | `javascriptTransform` |
| **Title** | JavaScript |
| **Responsibility** | transition |
| **Description** | Runs a script using the JavaScript language on the workflow state. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `transform` | string | javascript | Yes | A JavaScript script to run on the workflow state. |

Standard output port.

### Example Configuration

```json
{
  "transform": "const items = $$.items.map(i => ({ ...i, total: i.qty * i.price })); return items;"
}
```

---

## Saved Script

| | |
|---|---|
| **Name** | `savedTransformV2` |
| **Title** | Saved Script |
| **Responsibility** | transition |
| **Description** | Transforms the state payload using a saved script (a reusable Saved Transform authored outside the flow). The script can be JSONata or another supported language (e.g. JavaScript). Use this to run large/shared logic — such as an HTML-rendering script — without inlining it in the flow. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `transformScriptLanguage` | string | -- | Yes | The language used by the saved script. Default: `"JSONata"`. Must match the saved script's language (e.g. `"JavaScript"`). |
| `transformId` | object \| string | -- | Yes | **Reference to the saved script.** In the flow engine this is an object, not a bare id — see the binding note below. |
| `requestTransform` | string | jsonata | Yes | Transform applied to the state **before** the saved script runs; its result becomes the script's input (`$`). Default: `"$"` (pass the whole state). |
| `responseTransform` | string | jsonata | Yes | Transform applied to the saved script's **output** before continuing. Default: `"$"` (pass the result through unchanged). |
| `enableAdvancedConfiguration` | boolean | -- | Yes | When true, Input, Output, and Advanced Configuration transforms become configurable. Default: `false`. |

Standard output port.

### `transformId` is an object reference, not just an id — binding gotcha

Although the toolbox shows a single "Saved Script" picker, the flow engine stores `transformId` as a **full reference object**, and the flow **designer only treats the node as bound when that object is present**:

```json
{
  "transformScriptLanguage": "JavaScript",
  "requestTransform": "$",
  "responseTransform": "$",
  "enableAdvancedConfiguration": false,
  "transformId": {
    "id": "myRendererScript",
    "label": "my-renderer-script",
    "name": "my-renderer-script",
    "scriptLanguageId": "JavaScript"
  }
}
```

**Authoring caveat (important when creating flows programmatically / from JSON, e.g. via the data-flow mutations MCP tool):** that API validates `transformId` as a **string** and will reject the object above. But a bare-string `transformId` (just the id) is **not enough to bind the saved script** — the node deploys with its script *unset*, so at runtime the render/transform produces **no output** (downstream sees empty data, a screen that runs the flow just spins). Symptoms: the flow "works" structurally but returns nothing; opening the flow in the designer shows the Saved Script node with no script selected.

**How to author a Saved Script node reliably:**
- Prefer building/editing the node in the **flow designer** so the picker writes the full reference object, then save + deploy.
- If you generated the flow from JSON with a bare-string `transformId`, open the flow designer, **re-select the saved script** in the node, and **save/deploy** — this writes the object form and binds it.
- To re-deploy an already-correctly-bound version, deploy that **existing version by id** (don't round-trip it back through a string-only create call, or you re-break the binding).

### Saved script I/O contract

- The saved script receives `requestTransform`'s output as its input. In a **JavaScript** saved script, that input is `$`, and the script `return`s its result (which then flows through `responseTransform`).
- Return the result **unwrapped** — e.g. a renderer that yields `{ "dashboardUri": "…" }` should return exactly that object, not `{ "payload": { … } }`.
- The saved-script sandbox is isolated: it sees only its input, **not** `$state`/`$state.context`/`$metadata`. Anything the script needs (theme, timezone, filters, etc.) must be assembled into the payload by an upstream node and passed in via `requestTransform`.

---

## Data Mapping

| | |
|---|---|
| **Name** | `dataMapping` |
| **Title** | Data Mapping |
| **Responsibility** | transition |
| **Description** | Transforms the state payload using a saved data mapping. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `dataMappingId` | string | -- | Yes | The data mapping to run on the payload. |
| `transformScriptLanguage` | string | -- | Yes | The language used by the transform. Default: `"JSONata"`. |
| `requestTransform` | string | jsonata | Yes | Transform to populate the data mapping request. Default: `"$"`. |
| `responseTransform` | string | jsonata | Yes | Transform to reformat the data mapping output. Default: `"$"`. |
| `enableAdvancedConfiguration` | boolean | -- | Yes | Enables configuration of the Script Language and Request/Response transforms. Default: `false`. |

Standard output port.

---

## Object Diff

| | |
|---|---|
| **Name** | `objectDiff` |
| **Title** | Object Diff |
| **Responsibility** | transition |
| **Description** | Compares two objects and returns the differences. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `inputTransform` | string | jsonata | No | Transform to reformat the input payload. Default: `"$"`. |
| `originalObj` | string | jsonata | Yes | The first comparison object. |
| `updatedObj` | string | jsonata | Yes | The second comparison object. |
| `ignore` | array | jsonata | No | Array of key paths to exclude from comparison. |
| `detailed` | boolean | -- | Yes | Shows breakdown of added, removed, and changed properties. Default: `true`. |
| `outputTransform` | string | jsonata | No | Transform to format the output. Default: `"$"`. |
| `enableAdvancedConfiguration` | boolean | -- | Yes | When true, Input/Output transforms become configurable. Default: `false`. |

Standard output port.

### Example Configuration

```json
{
  "originalObj": "$state.context.original",
  "updatedObj": "$",
  "ignore": ["updatedAt", "version"],
  "detailed": true
}
```

---

## Saved Script (Legacy) -- *Deprecated*

| | |
|---|---|
| **Name** | `savedTransform` |
| **Title** | Saved Script (Legacy) |
| **Responsibility** | transition |
| **Description** | Legacy version of the Saved Script node. Deprecated: use the current Saved Script node (`savedTransformV2`) from the toolbox. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `transformId` | string | -- | Yes | The saved script to run. |

Standard output port.
