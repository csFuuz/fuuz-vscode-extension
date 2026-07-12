# Display Elements

4 elements that display data visually — calendars, charts, timers, and event streams.

---

## Calendar

**resolvedName:** `CalendarInput`
**Flags:** `requiresForm: true`

Full calendar component displaying events from saved data or dynamic queries. Supports day, week, month, and resource views.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Calendar label |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"600px"`) |
| `visible` | switch | Visibility (default: `true`) |
| `defaultView` | options | Initial view: `month`, `week`, `day`, `agenda`, `resource` |
| `views` | json | Enabled views array |

**Data**

| Field | Type | Description |
|-------|------|-------------|
| `dataSource` | options | `saved` (from form data) or `dynamic` (query) |
| `query.api` | text | API target (dynamic mode) |
| `query.model` | text | Model name (dynamic mode) |
| `query.parameters` | transform | Query parameters (dynamic mode) |
| `startField` | text | Data path for event start date/time |
| `endField` | text | Data path for event end date/time |
| `titleField` | text | Data path for event title |
| `colorField` | text | Data path for event color |
| `allDayField` | text | Data path for all-day flag |

**Resource View**

| Field | Type | Description |
|-------|------|-------------|
| `resourceModel` | text | Model for resources |
| `resourceLabelField` | text | Resource display label field |
| `resourceIdField` | text | Field linking events to resources |

**Actions**

| Field | Type | Description |
|-------|------|-------------|
| `onEventClick` | action | Action when clicking an event |
| `onSlotSelect` | action | Action when selecting a time slot |
| `onEventDrop` | action | Action when dragging an event to a new time |
| `onEventResize` | action | Action when resizing an event |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `save()` | Save calendar changes |
| `load()` | Reload calendar data |
| `navigateToDate(date)` | Navigate to a specific date |
| `setView(view)` | Switch calendar view |

### Exposed State

| State | Description |
|-------|-------------|
| `data` | Current event data array |
| `selectedEvent` | Currently selected event |
| `currentDate` | Currently displayed date |
| `currentView` | Currently active view |

---

## Chart

**resolvedName:** `Chart`
**Flags:** none

Standalone chart/visualization component with its own data query. Supports auto-refresh on an interval.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Chart label |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"400px"`) |
| `visible` | switch | Visibility (default: `true`) |
| `enableBackground` | switch | Enable background color |
| `background` | color | Background color |

**Chart Configuration**

| Field | Type | Description |
|-------|------|-------------|
| `chartConfig` | chart | Full chart configuration (type, series, axes, legend, colors, etc.) |

**Data**

| Field | Type | Description |
|-------|------|-------------|
| `query.api` | text | API target |
| `query.model` | text | Model to query |
| `query.autoLoad` | switch | Auto-load (default: `true`) |
| `query.parameters` | transform | Query parameters |
| `query.filterPredicate` | transform | Filter predicate |
| `query.fields` | json | Query fields |
| `query.query` | text | Raw GraphQL query override |

**Auto-Refresh**

| Field | Type | Description |
|-------|------|-------------|
| `autoRefresh` | switch | Enable auto-refresh (default: `false`) |
| `refreshInterval` | integer | Refresh interval in seconds |

**Actions**

| Field | Type | Description |
|-------|------|-------------|
| `onDataPointClick` | action | Action when clicking a data point |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `loadData()` | Reload chart data |
| `search(term)` | Filter chart data |

### Exposed State

| State | Description |
|-------|-------------|
| `data` | Current chart data |
| `loading` | Whether chart is loading |

---

## Timer

**resolvedName:** `Timer`
**Flags:** none

Countdown or count-up timer. Can count down to a target date, count up from a start date, or count a fixed duration.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Timer label |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"auto"`) |
| `height` | text | Height (default: `"auto"`) |
| `visible` | switch | Visibility (default: `true`) |
| `fontSize` | text | Display font size |
| `color` | color | Text color |
| `expiredColor` | color | Text color when expired |
| `flashOnExpired` | switch | Flash animation on expiry (default: `false`) |

**Configuration**

| Field | Type | Description |
|-------|------|-------------|
| `mode` | options | Timer mode: `countUp`, `countDown` |
| `sourceType` | options | Time source: `dateField`, `duration` |
| `startField` | text | Data path for start date (dateField mode) |
| `endField` | text | Data path for end/target date (dateField mode) |
| `duration` | transform | Fixed duration value (duration mode) |
| `autoStart` | switch | Start timer automatically (default: `true`) |
| `format` | text | Display format (e.g., `"HH:mm:ss"`) |

**Actions**

| Field | Type | Description |
|-------|------|-------------|
| `onExpired` | action | Action when timer reaches zero (count down) |
| `onTick` | action | Action on each tick |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `start()` | Start the timer |
| `pause()` | Pause the timer |
| `reset()` | Reset the timer |

### Exposed State

| State | Description |
|-------|-------------|
| `expired` | Whether the timer has expired |
| `seconds` | Current elapsed/remaining seconds |
| `totalSeconds` | Total duration in seconds |
| `running` | Whether the timer is running |

---

## Event Console

**resolvedName:** `EventConsoleAdapter`
**Flags:** none

Real-time event stream display. Subscribes to messaging topics and displays events as they arrive.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `elementName` | text | Element name |
| `label` | text | Console label |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"400px"`) |
| `visible` | switch | Visibility (default: `true`) |

**Subscription**

| Field | Type | Description |
|-------|------|-------------|
| `bindingKey` | text | Message topic binding key pattern |
| `subscribeOnMount` | switch | Auto-subscribe when mounted (default: `true`) |
| `filterTransform` | transform | Filter incoming messages |
| `messageTransform` | transform | Transform messages before display |
| `maxMessages` | integer | Maximum messages to display |

**Actions**

| Field | Type | Description |
|-------|------|-------------|
| `onMessage` | action | Action on each received message |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `subscribe()` | Start or restart the subscription |
| `unsubscribe()` | Stop the subscription |
| `clear()` | Clear displayed messages |

### Exposed State

| State | Description |
|-------|-------------|
| `messages` | Array of received messages |
| `connected` | Whether the subscription is active |
