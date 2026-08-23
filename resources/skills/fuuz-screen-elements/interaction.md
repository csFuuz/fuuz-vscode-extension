# Interaction Elements

10 toolbox entries in the registry's **Buttons** category — but only **four element types**.
`AddButton`, `EditButton`, `SaveButton`, `DeleteButton`, `PrintButton` and `SearchButton` are
toolbox presets, not types: every one of them persists as `type: "ActionButton"`.

| Toolbox entry | Stored `type` | `isButton` | Accepted by a Button Group |
|---|---|---|---|
| Action | `ActionButton` | yes | yes |
| Flow | `FlowButton` | yes | yes |
| Menu | `MenuButton` | yes | yes |
| Split | `SplitButton` | **no** | **no** |
| Create / Edit / Save / Delete / Print / Search | `ActionButton` | yes | yes |

**`SplitButton` sets no flags at all.** `ButtonsGroup` gates `canMoveIn` on `isButton`, so a
Split Button cannot be dropped into a Button Group — confirmed against a measured 900×400 group,
twice, once into an empty group and once after a real button had populated it. No node was
created, and **none of the group's declared rejection messages was rendered**. The drop simply
did nothing.

---

## Flow Button

**resolvedName:** `FlowButton`
**Flags:** `isButton`, `registersSharedState`

Executes one data flow when clicked.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `title` | text | Tooltip shown on hover |
| `useIconButton` | checkbox | Render as an icon button rather than a labelled button (default: `false`) |
| `text` | transform | Button text — used **instead of** the icon |
| `buttonColor` | combobox | `primary`, `secondary`, `error`, `red`, `green`, … (default: `"primary"`) |
| `icon` | transform | Icon descriptor: `{ icon, variant, size, color }` |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `margin` | slider | Outer margin (default: `6`) |
| `width` | text | Width (default: `"76px"`) |
| `height` | text | Height (default: `"48px"`) |

**Flow**

| Field | Type | Description |
|-------|------|-------------|
| `dataFlowId` | combobox | The data flow to execute; the option list is queried from the tenant |
| `payload` | transform | Payload the flow starts with (default: `{}`) |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `disabled` | transform | Disabled state (default: `false`) |
| `hidden` | transform | Hide the button (default: `false`) |
| `customButtonColor` | transform | Custom color, overriding `buttonColor` |
| `customIconColor` | transform | Custom icon color, overriding the icon's own |
| `customIconSize` | slider | Icon size in px |
| `customTextSize` | slider | Text size in px |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `execute()` | Run the button's flow |

**Only a FlowButton can invoke a Screen-type flow.** Action steps and remote transforms reach
Integration flows only — see `fuuz-data-flow`.

*Unverified rows: `label`, `variant`, `color`, `size`, `padding`, `visible`, `fullWidth`, `flowId`, `flowInput`, `confirmMessage`, `loading`, `onSuccess`, `onError`. The real names are `text`, `buttonColor`, `hidden`, `dataFlowId` and `payload`; there is no confirmation or success/error hook on this element.*

---

## Action Button

**resolvedName:** `ActionButton`
**Flags:** `isButton`, `registersSharedState`

Runs an array of action steps when clicked. 1,221 production instances across four tenants —
the most-used interaction element, and the target every button preset resolves to.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `title` | text | Tooltip shown on hover |
| `useIconButton` | checkbox | Render as an icon button (default: `false`) |
| `disableHover` | checkbox | Remove the icon button's hover effect (default: `false`) |
| `disableRipple` | checkbox | Remove the icon button's ripple effect (default: `false`) |
| `text` | transform | Button text — used **instead of** the icon |
| `buttonColor` | combobox | `primary`, `secondary`, `error`, `red`, `green`, … (default: `"primary"`) |
| `icon` | transform | Icon descriptor: `{ icon, variant, size, color }` |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `margin` | slider | Outer margin (default: `6`) |
| `width` | text | Width (default: `"76px"`) |
| `height` | text | Height (default: `"48px"`) |

**Action**

| Field | Type | Description |
|-------|------|-------------|
| `action` | action | The array of action steps to run on click (default: `[]`) — **singular**, and the registry's only `action` field type |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `disabled` | transform | Disabled state (default: `false`) |
| `hidden` | transform | Hide the button (default: `false`) |
| `customButtonColor` | transform | Custom color, overriding `buttonColor` |
| `customIconColor` | transform | Custom icon color |
| `customIconSize` | slider | Icon size in px |
| `customTextSize` | slider | Text size in px |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `execute(payload?)` | Fire the action steps and return immediately |
| `executeAsync(payload?)` | Fire the action steps and await their completion |

*Unverified rows: `label`, `variant`, `color`, `size`, `padding`, `visible`, `fullWidth`, `actions`, `confirmMessage`. The step array is `action`, not `actions`, and there is no built-in confirmation.*

---

## Split Button

**resolvedName:** `SplitButton`
**Flags:** none — **not `isButton`**

A button with a dropdown: `format` chooses whether its entries are actions or flows.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `title` | title | Button title |
| `buttonColor` | combobox | `primary`, `secondary`, `error`, `red`, `green`, … (default: `"primary"`) |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `margin` | slider | Outer margin (default: `6`) |
| `width` | text | Width (default: `"150px"`) |
| `height` | text | Height (default: `"48px"`) |

**Action**

| Field | Type | Description |
|-------|------|-------------|
| `format` | combobox | What the entries are: `action` or `flow` |
| `actions` | fieldGroup | The action entries (default: `[]`) |
| `flows` | fieldGroup | The flow entries (default: `[]`) |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `disabled` | transform | Disabled state (default: `false`) |
| `hidden` | transform | Hide the button (default: `false`) |
| `customButtonColor` | transform | Custom color, overriding `buttonColor` |
| `customTextSize` | slider | Text size in px |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `execute(payload?)` | Run the selected action |

No tenant in the survey uses this element, so every property here is declared-only.

*Unverified rows: `elementName`-adjacent `label`, `icon`, `variant`, `color`, `size`, `padding`, `visible`, `primaryAction`, `primaryFlowId`, `primaryFlowInput`, `items`. The real shape is `format` + `actions`/`flows`, and there is no separate primary action.*

---

## Menu Button

**resolvedName:** `MenuButton`
**Flags:** `isButton`

A menu button. `isFlow` chooses whether the menu entries are actions or flows.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `title` | text | Tooltip shown on hover |
| `isFlow` | switch | Menu entries are flows rather than actions (default: `false`) |
| `flows` | fieldGroup | The flow entries |
| `actions` | fieldGroup | The action entries |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `menuIcon` | options | `ellipsis-v` (Kebab), `ellipsis-h` (Meatballs), `bars` (Hamburger), `grip-lines` (Hotdog) (default: `"ellipsis-v"`) |
| `iconSize` | options | `small`, `medium`, `large` (default: `"small"`) |
| `margin` | slider | Outer margin (default: `0`) |
| `width` | text | Width (default: `"48px"`) |
| `height` | text | Height (default: `"48px"`) |

### Exposed Functions

The bundle declares no runtime contract for `MenuButton`. That is not evidence it exposes
nothing — only that the registry does not say.

Default props seed `"elementName": "Menu Button"`, the one element whose registry default
includes a name.

*Unverified rows: `label`, `icon`, `variant`, `color`, `size`, `padding`, `visible`, `disabled`, `items` — the real entry lists are `actions` and `flows`, chosen by `isFlow`, and the icon is `menuIcon`.*

---

## Custom Action Buttons

Six toolbox presets carrying an `isCustomActionButton` flag (not `isActionButton`) and an
`actionProp` factory. **They are not element types.** Each drops an `ActionButton` with a few
props pre-filled by `defaultCreateProps`, gets the `ActionButton` property panel, and stores
`type: "ActionButton"`. The only record of which stub was dragged is `definition.custom.editor`.

**Nothing reading a stored screen will ever see a `SaveButton`.** Do not search a design blob
for these names, and do not write them into hand-authored JSON — write an `ActionButton`.

Their action steps are **not** automatic: the preset seeds an icon, a color and sometimes a
title, and the `action` array is still yours to fill in.

| Preset | Seeded props |
|---|---|
| Create | `icon: { icon: "plus", variant: "regular", size: "icon" }`, `buttonColor: "secondary"`, `title: "Create"` |
| Edit | `icon: { icon: "pencil", variant: "duotone", size: "icon" }`, `buttonColor: "secondary"`, `title: "Update"` |
| Save | `icon: { icon: "save" }`, `buttonColor: "primary"` |
| Delete | `icon: { icon: "trash", variant: "solid" }`, `buttonColor: "error"` |
| Print | `icon: { icon: "print" }` |
| Search | `icon: { icon: "search", variant: "duotone", size: "icon" }`, `buttonColor: "primary"`, `title: "Search"` |

`EditButton` additionally declares `requiresTable: true`. **Nothing enforces it** — it is
toolbox chrome, not a drop rule, and it drops happily onto a Table-free screen root. No panel
control surfaces the constraint either. Whether that is a dead constraint or an unimplemented
one is unresolved.

None of the six is documented with a "Requires: parent Table/Form" rule by the platform, and
none behaves differently by parent context. Their behaviour comes entirely from the `action`
array you configure.
