# Interaction Elements

10 elements for triggering actions, flows, and operations.

---

## Flow Button

**resolvedName:** `FlowButton`
**Flags:** `isButton`

Executes a data flow when clicked. Configure the flow ID and input parameters.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Button label |
| `icon` | icon | Button icon |
| `variant` | options | Button variant (filled, outline, light, subtle, default) |
| `color` | color | Button color |
| `size` | options | Button size (xs, sm, md, lg, xl) |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |
| `fullWidth` | switch | Full-width button (default: `false`) |

**Flow**

| Field | Type | Description |
|-------|------|-------------|
| `flowId` | text | Data flow ID to execute |
| `flowInput` | transform | Input data for the flow |
| `confirmMessage` | text | Confirmation dialog message (if set, prompts before executing) |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `disabled` | transform | Disabled state |
| `loading` | switch | Show loading spinner while executing |
| `onSuccess` | action | Action after successful flow execution |
| `onError` | action | Action on flow error |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `execute()` | Trigger the flow programmatically |

---

## Action Button

**resolvedName:** `ActionButton`
**Flags:** `isButton`

Executes an array of action steps when clicked. Actions can include navigation, API calls, setting context, notifications, etc.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Button label |
| `icon` | icon | Button icon |
| `variant` | options | Button variant |
| `color` | color | Button color |
| `size` | options | Button size |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |
| `fullWidth` | switch | Full-width button |

**Actions**

| Field | Type | Description |
|-------|------|-------------|
| `actions` | action | Array of action steps to execute |
| `confirmMessage` | text | Confirmation dialog message |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `disabled` | transform | Disabled state |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `execute()` | Trigger the actions programmatically |

---

## Split Button

**resolvedName:** `SplitButton`
**Flags:** `isButton`

A button with a dropdown. The main button triggers a primary action/flow, and the dropdown shows additional options.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Primary button label |
| `icon` | icon | Button icon |
| `variant` | options | Button variant |
| `color` | color | Button color |
| `size` | options | Button size |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |

**Primary Action**

| Field | Type | Description |
|-------|------|-------------|
| `primaryAction` | action | Action(s) for the main button |
| `primaryFlowId` | text | Flow for the main button (alternative to actions) |
| `primaryFlowInput` | transform | Flow input for primary |

**Dropdown Items**

| Field | Type | Description |
|-------|------|-------------|
| `items` | json | Array of dropdown items: `{ label, icon, action, flowId, flowInput, disabled, divider }` |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `disabled` | transform | Disabled state |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `execute()` | Trigger the primary action |

---

## Menu Button

**resolvedName:** `MenuButton`
**Flags:** `isButton`

A dropdown menu button. Clicking opens a menu of actions.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Button label |
| `icon` | icon | Button icon (default: ellipsis/more icon) |
| `variant` | options | Button variant |
| `color` | color | Button color |
| `size` | options | Button size |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `0`) |
| `width` | text | Width (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |

**Menu Items**

| Field | Type | Description |
|-------|------|-------------|
| `items` | json | Array of menu items: `{ label, icon, action, flowId, flowInput, disabled, divider, color }` |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `disabled` | transform | Disabled state |

---

## Custom Action Buttons

The following 6 buttons are pre-configured for common operations. They have the `isActionButton` flag and no editor fields — their behavior is automatic based on their parent context.

---

### Create Button

**resolvedName:** `AddButton`
**Flags:** `isActionButton`
**Requires:** Parent Table

Triggers the creation flow for the parent Table's model. Opens a create form or dialog based on the table's configuration.

**Defaults:**
- Label: "Create"
- Icon: plus

---

### Edit Button

**resolvedName:** `EditButton`
**Flags:** `isActionButton`
**Requires:** Parent Table

Opens the edit view for the selected row in the parent Table.

**Defaults:**
- Label: "Edit"
- Icon: pencil

---

### Save Button

**resolvedName:** `SaveButton`
**Flags:** `isActionButton`
**Requires:** Parent Form

Triggers `save()` on the parent Form, executing the update or create mutation.

**Defaults:**
- Label: "Save"
- Icon: floppy-disk

---

### Print Button

**resolvedName:** `PrintButton`
**Flags:** `isActionButton`
**Requires:** Parent Form

Triggers the browser print dialog for the parent Form's content.

**Defaults:**
- Label: "Print"
- Icon: print

---

### Delete Button

**resolvedName:** `DeleteButton`
**Flags:** `isActionButton`
**Requires:** Parent Table or Form

Triggers the delete mutation for the selected row (Table) or current record (Form). Shows a confirmation dialog before deleting.

**Defaults:**
- Label: "Delete"
- Icon: trash
- Color: red

---

### Search Button

**resolvedName:** `SearchButton`
**Flags:** `isActionButton`
**Requires:** Parent Table

Triggers a search/filter refresh on the parent Table. Typically used alongside a filter form.

**Defaults:**
- Label: "Search"
- Icon: magnifying-glass
