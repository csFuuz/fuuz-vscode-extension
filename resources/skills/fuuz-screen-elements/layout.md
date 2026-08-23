# Layout Elements

14 elements that structure and organize the screen canvas.

---

## Screen

**resolvedName:** `Screen`
**Flags:** `canvas`, `isContainer`, `registersSharedState`, `excludeFromToolbox`

The root element of every screen. Always the ROOT node with `parent: null`. Not available in the toolbox — every screen has exactly one.

`Screen`, `ScreenAccordion` and `ScreenAccordionGroup` are three **distinct** stored types. `Screen` is not "internally `ScreenAccordion`" — a `Screen` row stores `type: "Screen"`.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Screen element name (System section in the panel; stored on the node as `custom.elementName`) |
| `padding` | slider | Inner padding, 0–96 (default: `0`) |
| `margin` | slider | Outer margin, 0–96 (default: `0`) |
| `removeOuterMargin` | switch | Fill the viewport, overriding `margin` (default: `false`) |
| `background` | combobox | `accent`, `primary`, `light`, `default`, `paper`, `dark`, `custom` |
| `customBackground` | color | Background color when `background` is `custom` |
| `shadow` | checkbox | Box shadow (default: `false`) |
| `borderRadius` | slider | Corner rounding, 0–96 (default: `0`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `flex` | flexLayout | Composite flex editor; writes `flexDirection`, `flexWrap`, `alignItems`, `justifyContent` |
| `flexGrow` | checkbox | Expand to fill available space (default: `false`) |
| `hidden` | transform | Hide the screen and its contents (default: `false`) |
| `description` | text | Screen description |

**Screen Flows**

| Field | Type | Description |
|-------|------|-------------|
| `pageLoadDataFlowIds` | combobox | Screen flows to execute on page load |
| `flowsDelay` | slider | Delay before the page-load flows run, 0–10 s (default: `0`) |
| `screenDataFlowIds` | combobox | Additional screen flows loaded into the screen so they can run on events, on a schedule, or via `$executeFlow`. Flows already selected in Page Load Flows or on flow buttons do not need to be listed here |
| `flows.onLoad` | action | Actions to run when the screen loads |
| `flows.onUnload` | action | Actions to run when the screen unloads |

**Page Load**

| Field | Type | Description |
|-------|------|-------------|
| `pageLoadAction` | jsonata | Action run once on page load |
| `intervals` | fieldGroup | Repeating interval actions |
| `pageLoad.title` | transform | Browser tab title |
| `pageLoad.onLoad` | action | Additional page load actions |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `setContext(value)` | Replace the entire screen context object |
| `mergeContext(value)` | Deep-merge values into existing context |
| `setContextValue(path, value)` | Set a single context value by path |
| `deleteContextValue(path)` | Remove a context value by path |
| `executePageLoadAction()` | Re-run the page load action |
| `return(value)` | Close the enclosing dialog, resolving `$showScreenDialog(...)` to `value`; a no-op on a top-level screen |
| `hide()` / `show()` / `toggle()` / `resetHidden()` | Visibility control |
| `showLoading()` / `hideLoading()` | Screen loading spinner |
| `pushContextValue(path, value)` | Push a value onto a context array |
| `showNotification(options)` | Show a toast notification |
| `navigate(url)` | Navigate to a URL |
| `setUrlParameter(key, value)` | Set a URL query parameter |

### Exposed State

| State | Description |
|-------|-------------|
| `context` | The screen context object |

*Unverified rows: `flows.onLoad`, `flows.onUnload`, `pageLoad.title`, `pageLoad.onLoad`, and the last four exposed functions — the registry declares none of them and no production screen stores them.*

---

## Container

**resolvedName:** `Container`
**Flags:** `canvas`, `isContainer`, `registersSharedState`

General-purpose layout container. Supports flex and grid layout, borders, collapsibility, click actions and conditional visibility.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `padding` | slider | Inner padding, 0–96 (default: `0`) |
| `margin` | slider | Outer margin, 0–96 (default: `0`) |
| `background` | combobox | `accent`, `primary`, `light`, `default`, `paper`, `dark`, `custom` |
| `customBackground` | transform | Custom background color |
| `shadow` | checkbox | Box shadow (default: `false`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `flexGrow` | checkbox | Expand to fill available space (default: `false`) |
| `flexShrink` | checkbox | Shrink to fit available space (default: `false`) |
| `label` | text | Display label |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `hidden` | transform | Hide the container and its contents (default: `false`) |
| `collapsible` | checkbox | Allow collapse/expand (default: `false`) |
| `collapsedByDefault` | checkbox | Start collapsed on page load (default: `false`) |
| `collapsedSize` | slider | Height in px when fully collapsed, 0–1000 (default: `0`) |
| `collapsedFooter` | checkbox | Render the collapse control in a separate footer strip instead of floating bottom-right (default: `false`) |
| `onClickTransform` | checkbox | Enable the click handler; ignores clicks on child elements (default: `false`) |
| `onClickActions` | transform | The transform to run when the container is clicked |
| `visible` | switch | Visibility |
| `loading` | switch | Show loading overlay |

**Border**

| Field | Type | Description |
|-------|------|-------------|
| `bordersInput` | border | Border style, width, color and side selection |
| `borderRadius` | slider | Corner rounding, 0–96 (default: `0`) |
| `border` | border | Border style configuration |

**Layout**

| Field | Type | Description |
|-------|------|-------------|
| `layout` | options | `flex` (default) or `grid` |
| `flex` | flexLayout | Composite flex editor; writes `flexDirection`, `flexWrap`, `alignItems`, `justifyContent` |
| `columns` | transform | Grid column count (blank = auto) |
| `rows` | transform | Grid row count (blank = auto) |
| `gap` | text | Gap between children — any CSS length (`8px`, `1em`, `10%`) |
| `justifyItems` | options | Grid horizontal justification: `start`, `center`, `end` |
| `overflow` | options | Overflow behavior |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `style` | transform | Panel label "Additional Styles". A React inline-style object, merged last over everything the panel writes to the same node — camelCase keys, CSS values. Runtime-verified property list in `fuuz-screen-styling` |
| `onClickAction` | action | Action on click |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `hide(visible?)` | Hide the container |
| `show(visible?)` | Show the container |
| `toggle(visible?)` | Toggle visibility |
| `resetHidden()` | Reset to the container's default visibility |
| `collapse()` | Collapse the container |
| `expand()` | Expand the container |
| `toggleCollapse()` | Toggle the collapsed state |
| `showLoading()` / `hideLoading()` | Loading spinner |

`flexDirection`, `flexWrap`, `alignItems` and `justifyContent` are written by the composite `flex` control and are stored as **top-level** props — see `fuuz-screen-design` for the full layout recipe set.

`style` is set on 6,647 of the 6,980 production Containers, and 274 declarations were measured on
it at runtime in August 2026. It beats the panel for `padding`, `margin`, `height`,
`borderRadius`, `bordersInput`, `gap`, the flex and grid layout props, the `shadow` checkbox and
the `background` class, because it is merged after all of them. Three Container-specific results
are worth knowing before writing one: `style.width` reaches the DOM and is then overridden by the
wrapper's flex layout (use `flex: "none"`, or `minWidth`/`maxWidth` as bounds — `height` has no
such problem); `display: "inline-flex"` blockifies to `flex`; and an unrecognised **top-level**
prop on a Container is also treated as CSS and beats `style`, which is a reason not to invent
top-level keys. A malformed `style` value blanks the entire screen silently — see
`fuuz-screen-styling` for that hazard and for the property-by-property reference.

*Unverified rows: `border`, `loading`, `overflow`, `visible`, `onClickAction` — not declared by the registry and not stored by any production screen (`hidden` is the real visibility prop, `bordersInput` the real border prop).*

---

## Accordion

**resolvedName:** `ScreenAccordion`
**Flags:** `canvas`, `isContainer`

A collapsible panel with a header. Accepted directly at the Screen root, and can also sit inside an Accordion Group.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | transform | Accordion header title (default: `"Accordion"`) |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `margin` | slider | Margin around the accordion, 0–96 (default: `0`) |
| `padding` | slider | Inner padding |
| `visible` | switch | Visibility |
| `icon` | icon | Header icon |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `disabled` | transform | Prevent expand/collapse (default: `false`) |
| `hidden` | transform | Hide/show the accordion (default: `false`) |
| `defaultExpanded` | checkbox | Expanded when first rendered (default: `false`) |
| `defaultOpened` | switch | Open by default |
| `disableCollapse` | switch | Prevent collapsing |

**Actions**

| Field | Type | Description |
|-------|------|-------------|
| `actions` | fieldGroup | Action buttons rendered in the accordion header |
| `onToggle` | action | Action on open/close |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `renderOnExpansion` | checkbox | Mount the body only when first expanded — faster initial render, but the content loads on open (default: `true`) |
| `disposeOnCollapse` | checkbox | Unmount the body when collapsed — lower memory, but reloads on each reopen (default: `false`) |
| `variant` | options | Visual variant |

*Unverified rows: `padding`, `visible`, `icon`, `defaultOpened`, `disableCollapse`, `onToggle`, `variant`.*

---

## Accordion Group

**resolvedName:** `ScreenAccordionGroup`
**Flags:** `canvas`, `isContainer`

Groups multiple Accordion elements. In exclusive mode, only one accordion can be open at a time. Refuses table columns, and refuses grid cells unless the target uses grid layout.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `exclusive` | checkbox | Only one open at a time (default: `true`) |
| `defaultExpandedId` | text | `elementName` of the accordion expanded by default |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `padding` | slider | Inner padding |
| `visible` | switch | Visibility |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `hidden` | transform | Hide/show the group (default: `false`) |

*Unverified rows: `padding`, `visible`.*

---

## Tabs

**resolvedName:** `TabBar`
**Flags:** `registersSharedState` (children are managed via tab configuration, not canvas drops)

Tabbed navigation with configurable tabs.

**Tab panels live in `linkedNodes`, never in `nodes`.** Each tab is backed by a `Container` stored under the key `<elementName>Detail<index>`; at creation the element name is not yet set, so the first key is the literal `"undefinedDetail0"`. Renaming the TabBar re-derives the keys and strands the Container under the old key — a stranded panel is still stored, still emitted as an ordinary `Container` row, and renders nowhere.

### Sections

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `padding` | slider | Inner padding |
| `visible` | switch | Visibility |
| `variant` | options | Tab style variant |
| `placement` | options | Tab position |

**Configuration**

| Field | Type | Description |
|-------|------|-------------|
| `orientation` | options | `horizontal` (default) or `vertical` |
| `justifyTabs` | options | `start`, `center`, `end` — labels change with `orientation` (Left/Right vs Top/Bottom) |
| `defaultTabIndex` | options | Zero-based index of the tab open on load; option list is derived from `tabs` |
| `tabWidth` | integer | Width in px for every tab (default: `160`); per-tab widths override it |
| `tabActiveColor` | options | Active-tab indicator: `primary` or `secondary` (default: `secondary`) |
| `tabBarColor` | color | Tab bar background color |
| `hidden` | checkbox | Hide the tab bar UI and render only tab contents — useful for programmatic switching (default: `false`) |
| `alwaysKeepTabsMounted` | checkbox | Keep inactive tab contents mounted and merely hidden (default: `false`) |
| `defaultTab` | text | Tab key to show by default |
| `keepMounted` | switch | Keep inactive tabs in the DOM |

**Tabs**

| Field | Type | Description |
|-------|------|-------------|
| `tabs` | fieldGroup | Ordered tab list, at least one. Each tab: `{ tabTitle, tabIcon, tabColor, tabWidth, textWrap, disabled, hidden }` — `disabled` and `hidden` are always present |

### Exposed Functions

All five take a zero-based tab **index**, not a key.

| Function | Description |
|----------|-------------|
| `setTab(index)` | Switch to the tab at that index |
| `enableTab(index)` | Enable a disabled tab |
| `disableTab(index)` | Disable a tab |
| `showTab(index)` | Show a hidden tab |
| `hideTab(index)` | Hide a tab |

### Exposed State

| State | Description |
|-------|-------------|
| `tabIndex` | Zero-based index of the selected tab |
| `tabs` | All tabs, in display order |
| `currentTab` | The selected tab object (`tabs[tabIndex]`) |

*Unverified rows: `padding`, `visible`, `variant`, `placement`, `defaultTab`, `keepMounted`.*

---

## Grid Cell

**resolvedName:** `GridCell`
**Flags:** `canvas`, `isGridCell`

A cell within a grid layout. **Only accepted by a Container whose `layout` is `"grid"`** — a flex container refuses it silently, and its own size is not the cause.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `colSpan` | transform | Number of columns to span |
| `rowSpan` | transform | Number of rows to span |
| `padding` | slider | Inner padding |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `style` | transform | Panel label "Additional Styles". Same React inline-style object as `Container.style`, merged the same way — but every runtime measurement was taken on `Container`, so treat `GridCell` behaviour as expected, not verified |

---

## Resizable Panel

**resolvedName:** `ResizablePanelLayout`
**Flags:** `canvas`

A panel the user can resize at runtime by dragging its handle.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `axis` | switch | Labelled "Horizontal"; `false` (default) sizes by width, `true` by height |
| `handle` | options | Handle position — `left`/`right` when `axis` is false, `top`/`bottom` when true (default: `"right"`) |
| `defaultSize` | integer | Default width/height in px (default: `400`), clamped to `minSize`/`maxSize` |
| `minSize` | integer | Minimum width/height in px (default: `100`) |
| `maxSize` | integer | Maximum width/height in px (default: `800`) |
| `toggleHotkey` | text | Hotkey to toggle the panel, e.g. `"alt+1"` |
| `padding` | slider | Inner padding |
| `width` | text | Width |
| `height` | text | Height |
| `collapsible` | switch | Allow collapsing panels |
| `hotkey` | text | Keyboard shortcut to toggle collapse |

**Panels**

| Field | Type | Description |
|-------|------|-------------|
| `sizes` | json | Array of initial panel sizes as percentages |
| `minSizes` | json | Array of minimum panel sizes |
| `maxSizes` | json | Array of maximum panel sizes |

`handle`'s option list is computed from `axis` at render time; there is no static list.

*Unverified rows: `padding`, `width`, `height`, `collapsible`, `hotkey`, `sizes`, `minSizes`, `maxSizes` — the registry declares six properties in a single Basic section, and the singular `defaultSize`/`minSize`/`maxSize` are the real ones.*

---

## Button Group

**resolvedName:** `ButtonsGroup`
**Flags:** `canvas`, `isButtonGroups`

A horizontal or vertical group of buttons. **Only buttons can be dropped inside** — anything else is refused silently. Its default box is `200px × auto`, which is too small to hit reliably; widen it before dropping into it.

### Sections

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `width` | text | Width (default: `"200px"`) |
| `height` | text | Height (default: `"auto"`) |
| `margin` | slider | Margin, 0–96 (default: `6`) |
| `verticalOrientation` | switch | Stack the buttons vertically |
| `buttonGroupCustomColor` | transform | Custom button color for the group |
| `buttonGroupTextColor` | transform | Button text color for the group |
| `padding` | slider | Inner padding |
| `visible` | switch | Visibility |
| `variant` | options | Button variant |
| `color` | color | Custom button color |
| `orientation` | options | `horizontal` or `vertical` |
| `textColor` | color | Custom text color |

*Unverified rows: `padding`, `visible`, `variant`, `color`, `orientation`, `textColor` — `verticalOrientation` replaces `orientation`, and `buttonGroupCustomColor`/`buttonGroupTextColor` replace `color`/`textColor`.*

---

## Text

**resolvedName:** `RichText`
**Flags:** none

Displays rich text content. The toolbox calls it "Text".

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `content` | richText | Draft.js content model — `{ blocks: [...], entityMap: {} }`. Inline styling is carried in each block's `inlineStyleRanges` (e.g. `fontsize-12`, `fontfamily-Roboto`, `BOLD`) |
| `description` | text | Helper text |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `padding` | slider | Inner padding |
| `visible` | switch | Visibility |
| `fontSize` | text | Font size |
| `fontWeight` | options | Font weight |
| `textAlign` | options | Text alignment |
| `color` | color | Text color |

`content` is **not** a transform — dynamic text belongs in a `DisplayText` inside a Form, or in the inline style ranges of a static block.

*Unverified rows: `padding`, `visible`, `fontSize`, `fontWeight`, `textAlign`, `color` — the registry declares four properties only.*

---

## Widget

**resolvedName:** `ScreenWidget`
**Flags:** `isScreenWidget`, `registersSharedState`

Embeds another screen inside the current screen. The embedded screen receives parameters and runs independently.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `screenId` | combobox | The widget screen to render — **required** |
| `screenParams` | transform | Object passed to the widget screen as its URL parameters; leave blank to pass the parent screen's URL parameters through |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `setParams(params)` | Update the parameters passed to the embedded screen |

### Exposed State

| State | Description |
|-------|-------------|
| `components` | The embedded screen's own `$components` bag, keyed by its element names |

---

## Icon

**resolvedName:** `Icon`
**Flags:** `requiresForm: false`

Displays a FontAwesome icon. One of the few control elements accepted directly by the Screen root, which makes it the natural probe for whether a container is droppable at all.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `title` | text | Icon title (default: `"Icon"`) |
| `icon` | transform | Composite icon value: `{ icon, variant, color, size, customIconColor }` (default: `{ icon: "mouse-pointer", variant: "regular", color: "primary" }`) |
| `width` | text | Width (default: `"48px"`) |
| `height` | text | Height (default: `"48px"`) |
| `size` | options | Icon size |
| `color` | color | Icon color |
| `padding` | slider | Inner padding |
| `visible` | switch | Visibility |

`size`, `variant` and `color` are sub-keys of the composite `icon` value, not separate props. Icon variants: `solid`, `light`, `regular`, `duotone`, `brands`. Icon sizes: `nano`, `tiny`, `small`, `icon`, `medium`, `large`, `xlarge`.

*Unverified rows: `size`, `color`, `padding`, `visible` as top-level props.*

---

## Embedded Webpage

**resolvedName:** `EmbeddedWebpage`
**Flags:** `canvas`

Embeds an external webpage in an iframe. Configure allowed permissions for the embedded content.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `url` | transform | URL to embed — **must be HTTPS** |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `padding` | slider | Inner padding |
| `visible` | switch | Visibility |
| `title` | text | Iframe title for accessibility |

**Permissions**

All default to `false`.

| Field | Type | Description |
|-------|------|-------------|
| `allowSameOrigin` | switch | Allow the user to navigate the embedded page |
| `allowDownloads` | switch | Allow downloads from the embedded page |
| `allowPopups` | switch | Allow popups |
| `allowScripts` | switch | Allow scripts to run |
| `allowForms` | switch | Allow form submission |
| `windowModals` | switch | Allow window modals |
| `allow` | text | iframe `allow` attribute |
| `sandbox` | text | iframe `sandbox` attribute |
| `referrerPolicy` | options | Referrer policy |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `style` | transform | Panel label "Additional Styles". Same React inline-style object as `Container.style`, applying to the embedding element and unmeasured on this element. It is not a way to style the embedded page — that document is a separate surface these findings say nothing about |

*Unverified rows: `padding`, `visible`, `title`, `allow`, `sandbox`, `referrerPolicy` — the six `allow*` switches are the real permission controls.*

---

## Paper

**resolvedName:** `Paper`
**Flags:** `canvas`, `isContainer`, `registersSharedState`, `excludeFromToolbox`

**Deprecated and hidden from the toolbox** — "Paper has been deprecated. The Container element now supports more styling options." A stylized block container; it can still appear on screens that already contain one.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `padding` | slider | Inner padding, 0–96 (default: `8`) |
| `margin` | slider | Outer margin, 0–96 (default: `8`) |
| `square` | checkbox | Square rather than rounded corners (default: `false`) |
| `shadow` | checkbox | Box shadow (default: `true`) |
| `background` | color | Background color |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `flex` | flexLayout | Composite flex editor; writes `flexDirection`, `flexWrap`, `alignItems`, `justifyContent` |
| `hidden` | transform | Hide the paper and its contents (default: `false`) |
| `flexGrow` | checkbox | Expand to fill available space (default: `false`) |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `hide(visible?)` / `show(visible?)` / `toggle(visible?)` | Visibility control |
| `resetHidden()` | Reset to the paper's default visibility |

---

## Markdown Text (deprecated)

**resolvedName:** `Text`
**Flags:** `excludeFromToolbox`

**Deprecated and hidden from the toolbox** — "This markdown-based Text element has been deprecated. The new rich text-based Text element has replaced it." Still present in production screens. The replacement is `RichText`, documented above under **Text**; the two are separate components that exist simultaneously.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `content` | markdown | Markdown text to display (default: `"Text"`) |
| `description` | text | Helper text |
