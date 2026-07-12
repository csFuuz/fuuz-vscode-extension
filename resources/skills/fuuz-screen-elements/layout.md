# Layout Elements

12 elements that structure and organize the screen canvas.

---

## Screen

**resolvedName:** `Screen` (internally `ScreenAccordion`)
**Flags:** `canvas`, `isContainer`, `excludeFromToolbox`

The root element of every screen. Always the ROOT node with `parent: null`. Not available in the toolbox — every screen has exactly one.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Screen element name |
| `padding` | slider | Inner padding (default: `0`) |
| `description` | text | Screen description |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |

**Screen Flows**

| Field | Type | Description |
|-------|------|-------------|
| `flows.onLoad` | action | Actions to run when the screen loads |
| `flows.onUnload` | action | Actions to run when the screen unloads |

**Page Load**

| Field | Type | Description |
|-------|------|-------------|
| `pageLoad.title` | transform | Browser tab title |
| `pageLoad.onLoad` | action | Additional page load actions |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `setContext(value)` | Replace the entire screen context object |
| `mergeContext(value)` | Merge values into existing context |
| `setContextValue(path, value)` | Set a single context value by path |
| `deleteContextValue(path)` | Remove a context value by path |
| `pushContextValue(path, value)` | Push a value onto a context array |
| `showNotification(options)` | Show a toast notification |
| `navigate(url)` | Navigate to a URL |
| `setUrlParameter(key, value)` | Set a URL query parameter |

---

## Container

**resolvedName:** `Container`
**Flags:** `canvas`, `isContainer`

General-purpose layout container. Supports flexible layout, borders, collapsibility, and conditional visibility.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Display label (shown in header when collapsible) |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `visible` | switch | Visibility (default: `true`) |
| `collapsible` | switch | Allow collapse/expand (default: `false`) |
| `collapsed` | switch | Initial collapsed state (default: `false`) |
| `loading` | switch | Show loading overlay (default: `false`) |

**Border**

| Field | Type | Description |
|-------|------|-------------|
| `border` | border | Border style configuration |

**Layout**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `flexDirection` | options | Flex direction: `row`, `column` (default: `"column"`) |
| `alignItems` | options | Flex align-items |
| `justifyContent` | options | Flex justify-content |
| `gap` | text | Gap between children |
| `background` | color | Background color |
| `overflow` | options | Overflow behavior |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `onClickAction` | action | Action on click |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `hide()` | Hide the container |
| `show()` | Show the container |
| `toggle()` | Toggle visibility |
| `collapse()` | Collapse the container |
| `expand()` | Expand the container |
| `loading(bool)` | Set loading state |

---

## Accordion

**resolvedName:** `ScreenAccordion`
**Flags:** `canvas`, `isContainer`

A collapsible panel with a header. Can be used standalone or inside an Accordion Group.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Accordion header title |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |
| `icon` | icon | Header icon |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `defaultOpened` | switch | Open by default (default: `true`) |
| `disableCollapse` | switch | Prevent collapsing (default: `false`) |

**Actions**

| Field | Type | Description |
|-------|------|-------------|
| `onToggle` | action | Action on open/close |

**Advanced**

| Field | Type | Description |
|-------|------|-------------|
| `disabled` | transform | Disable the accordion |
| `variant` | options | Visual variant |

---

## Accordion Group

**resolvedName:** `ScreenAccordionGroup`
**Flags:** `canvas`, `isContainer`

Groups multiple Accordion elements. In exclusive mode, only one accordion can be open at a time.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `exclusive` | switch | Only one open at a time (default: `false`) |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |

---

## Tabs

**resolvedName:** `TabBar`
**Flags:** none (children are managed via tab configuration, not canvas drops)

Tabbed navigation with configurable tabs. Each tab references a child container node.

### Sections

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |
| `variant` | options | Tab style variant (default, outline, pills) |
| `placement` | options | Tab position (top, bottom, left, right) |

**Configuration**

| Field | Type | Description |
|-------|------|-------------|
| `defaultTab` | text | Tab key to show by default |
| `keepMounted` | switch | Keep inactive tabs in DOM (default: `true`) |

**Tabs**

| Field | Type | Description |
|-------|------|-------------|
| `tabs` | json | Array of tab objects: `{ key, label, icon, disabled, visible }` |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `setTab(key)` | Switch to tab by key |
| `enableTab(key)` | Enable a disabled tab |
| `disableTab(key)` | Disable a tab |
| `showTab(key)` | Show a hidden tab |
| `hideTab(key)` | Hide a tab |

---

## Grid Cell

**resolvedName:** `GridCell`
**Flags:** `canvas`, `isGridCell`

A cell within a CSS grid layout. Used to position children in grid rows/columns.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `colSpan` | integer | Number of columns to span (default: `1`) |
| `rowSpan` | integer | Number of rows to span (default: `1`) |
| `padding` | slider | Inner padding (default: `0`) |

---

## Resizable Panel

**resolvedName:** `ResizablePanelLayout`
**Flags:** `canvas`

A layout with resizable panels separated by drag handles. Panels can be resized by the user at runtime.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `axis` | options | Split direction: `horizontal`, `vertical` (default: `"horizontal"`) |
| `handle` | switch | Show drag handle (default: `true`) |
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |

**Panels**

| Field | Type | Description |
|-------|------|-------------|
| `sizes` | json | Array of initial panel sizes as percentages |
| `minSizes` | json | Array of minimum panel sizes |
| `maxSizes` | json | Array of maximum panel sizes |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `hotkey` | text | Keyboard shortcut to toggle collapse |
| `collapsible` | switch | Allow collapsing panels |

---

## Button Group

**resolvedName:** `ButtonsGroup`
**Flags:** `canvas`, `isButtonGroups`

A horizontal or vertical group of buttons. Drop button elements inside.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `orientation` | options | `horizontal` or `vertical` (default: `"horizontal"`) |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |
| `variant` | options | Button variant |
| `color` | color | Custom button color |
| `textColor` | color | Custom text color |

---

## Text

**resolvedName:** `RichText`
**Flags:** none

Displays rich text content. Supports HTML-like formatting configured in the editor.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `content` | transform | Rich text content (supports dynamic expressions) |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |
| `fontSize` | text | Font size |
| `fontWeight` | options | Font weight |
| `textAlign` | options | Text alignment |
| `color` | color | Text color |

---

## Widget

**resolvedName:** `ScreenWidget`
**Flags:** none

Embeds another screen inside the current screen. The embedded screen receives parameters and runs independently.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `screenId` | text | ID of the screen to embed |
| `screenParams` | transform | Parameters to pass to the embedded screen |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `setParams(params)` | Update the parameters passed to the embedded screen |

---

## Icon

**resolvedName:** `Icon`
**Flags:** none

Displays a FontAwesome icon. Useful for visual indicators and decorative elements.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `icon` | icon | FontAwesome icon name |
| `size` | options | Icon size (xs, sm, md, lg, xl) |
| `color` | color | Icon color |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `0`) |
| `visible` | switch | Visibility (default: `true`) |

---

## Embedded Webpage

**resolvedName:** `EmbeddedWebpage`
**Flags:** `canvas`

Embeds an external webpage using an iframe. Configure allowed permissions for the embedded content.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `url` | transform | URL to embed |
| `title` | text | Iframe title for accessibility |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"500px"`) |
| `visible` | switch | Visibility (default: `true`) |

**Permissions**

| Field | Type | Description |
|-------|------|-------------|
| `allow` | text | iframe `allow` attribute (e.g., `"camera; microphone"`) |
| `sandbox` | text | iframe `sandbox` attribute |
| `referrerPolicy` | options | Referrer policy |
