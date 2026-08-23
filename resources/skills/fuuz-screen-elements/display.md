# Display Elements

4 elements that display data without being bound to a form — calendars, charts, timers, and
event streams.

The registry's **Display** category holds ten types. The other six — `DisplayText`, `Image`,
`PDFViewer`, `ProgressBar`, `SVGInput` and `Visualization` — carry `requiresForm` and behave
like inputs, so they are documented in [input.md](input.md).

`CalendarInput` sits behind an `isSchedulingExcluded()` gate: its toolbox visibility is decided
at runtime, and a tenant with scheduling disabled will not show it. The same gate covers
`SchedulingConfiguration` in [data.md](data.md). Both resolved *open* on the surveyed tenant.

---

## Calendar

**resolvedName:** `CalendarInput`
**Flags:** `registersSharedState`

FullCalendar component. Renders either a **saved** `Calendar` record or a **dynamic** event set
returned by a transform. `type` is seeded as `"calendar"`, but it is **not** form-bound — it
declares none of the Basic set, no `field`, no `dataPath`, and no `label`.

### Sections

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `alignItems` | combobox | `start`, `end`, `center` (default: `"start"`) |
| `visible` | transform | Visibility (default: `true`) |
| `initialView` | options | View on load: `dayGridMonth` (Month), `timeGridWeek` (Week), `timeGridDay` (Day), `listWeek` (List) |
| `useBasicTitleFormat` | checkbox | Use the basic title format (default: `false`) |

**Query**

| Field | Type | Description |
|-------|------|-------------|
| `calendarSetting` | combobox | `Saved Calendar` or `Dynamic Calendar` |
| `calendarId` | combobox | Which saved calendar to load; the option list is a `$query` against the tenant's `Calendar` model, so it shows only what has loaded |
| `calendarEvents` | transform | Returns the event payload handed to the calendar (dynamic mode) |
| `calendarParameters` | jsonata | Returns the parameter object handed to the calendar |
| `calendarTransformRemote` | checkbox | Run the calendar transform server-side; better for complex transforms, worse for trivial ones |
| `autoSave` | checkbox | Save events automatically when they are created, edited or deleted (default: `true`) |
| `onChange` | jsonata | Transform run when the calendar changes |
| `resourceView` | checkbox | Enable the resource lane view (default: `false`) |
| `resources` | transform | Returns the resource list for that view |

There are no `startField` / `endField` / `titleField`-style mappings: the shape of an event is
fixed (`{ title, description, priority, timeZone, eventJson: { start, end, allDay, recurring, duration, rrule } }`)
and you build it in `calendarEvents`.

### Exposed Functions

| Function | Description |
|----------|-------------|
| `save(calendar?)` | Save the calendar; defaults to its current state. The argument, when given, is a full calendar object with a `calendarEvents` array |

### Exposed State

| State | Description |
|-------|-------------|
| `data` | The current calendar object |

*Unverified rows: `label`, `defaultView`, `views`, `dataSource`, `query.*`, `startField`, `endField`, `titleField`, `colorField`, `allDayField`, `resourceModel`, `resourceLabelField`, `resourceIdField`, `onEventClick`, `onSlotSelect`, `onEventDrop`, `onEventResize`, and the `load()` / `navigateToDate()` / `setView()` functions — the registry declares none of them and no production screen stores them.*

---

## Chart

**resolvedName:** `Chart`
**Flags:** `registersSharedState`

Standalone chart with its own configuration and refresh interval. Seven declared properties in
total — the data and series live inside the composite `chart` editor, not in separate query
fields.

### Sections

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"400px"`) |
| `height` | text | Height (default: `"300px"`) |
| `allowFullscreen` | checkbox | Allow the chart to expand to fullscreen (default: `true`) |
| `enableBackground` | checkbox | Draw the background card; off makes it transparent (default: `true`) |

**Chart**

| Field | Type | Description |
|-------|------|-------------|
| `chart` | chart | The whole chart configuration — type, series, axes, legend, colors and its data query (default: `{}`) |
| `autoRefreshDuration` | duration | How often to reload; unset means load once on page load. **Minimum one minute** (default: `""`) |

`chart` and `autoRefreshDuration` are the registry's only uses of the `chart` and `duration`
field types.

### Exposed Functions

| Function | Description |
|----------|-------------|
| `loadData()` | Reload the chart data |
| `search()` | Alias of `loadData()` — takes no argument and does not filter |

### Exposed State

The bundle declares no state keys for `Chart`.

*Unverified rows: `elementName`-adjacent `label`, `visible`, `background`, `chartConfig`, `query.*`, `autoRefresh`, `refreshInterval`, `onDataPointClick`, and the `data` / `loading` state — the real names are `chart` and `autoRefreshDuration`.*

---

## Timer

**resolvedName:** `Timer`
**Flags:** `registersSharedState`

Countdown or count-up timer. Either count a duration, or count between two date/times — the
`useDateFields` switch chooses which pair of transforms is read.

### Sections

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"100%"`) |
| `height` | text | Height (default: `"auto"`) |
| `formatString` | text | Display format for the value |
| `align` | options | Horizontal alignment: `left`, `center`, `right` (default: `"left"`) |
| `variant` | options | Font size as a typography scale name: `h1`–`h6`, `subtitle1`, `subtitle2`, `body1`, `body2`, `button`, … |
| `color` | color | Text color |
| `showProgressBar` | switch | Show a progress bar of elapsed time (default: `false`) |

**Configuration**

| Field | Type | Description |
|-------|------|-------------|
| `useDateFields` | switch | Count between two date/times rather than for a fixed duration (default: `false`) |
| `durationTransform` | jsonata | The duration to run for — a number of seconds or a moment duration string |
| `startDateTimeTransform` | jsonata | Start point, when `useDateFields` is on |
| `endDateTimeTransform` | jsonata | End point, when `useDateFields` is on |

**Behavior**

| Field | Type | Description |
|-------|------|-------------|
| `countUpMode` | switch | Count up from zero rather than down to it (default: `false`) |
| `autoStart` | switch | Start counting on page load (default: `true`) |
| `flashWhenExpired` | switch | Flash the value three times on expiry (default: `true`) |
| `onTimerExpiredTransform` | jsonata | Transform run when the timer expires |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `start()` | Start the timer |
| `pause()` | Pause the timer |
| `reset()` | Reset to the initial state |
| `restart()` | Reset and start |

### Exposed State

| State | Description |
|-------|-------------|
| `expired` | True once the timer has reached its target |
| `seconds` | Seconds remaining (or elapsed in count-up mode); **`null` while flashing on expiry** |
| `totalSeconds` | The full configured duration in seconds |

There is no `running` state key — read `expired` and drive the rest from your own state.

*Unverified rows: `label`, `visible`, `fontSize`, `expiredColor`, `flashOnExpired`, `mode`, `sourceType`, `startField`, `endField`, `duration`, `format`, `onExpired`, `onTick`, and the `running` state. The real names are `variant`, `flashWhenExpired`, `countUpMode`, `useDateFields`, `durationTransform`, `formatString` and `onTimerExpiredTransform`.*

---

## Event Console

**resolvedName:** `EventConsoleAdapter`
**Flags:** `registersSharedState`

Real-time event stream display, bound to one event **binding key**. Six declared properties;
everything about message handling happens in the console itself, not in configuration.

### Sections

**Basic**

| Field | Type | Description |
|-------|------|-------------|
| `label` | text | Console label (default: `"Event Console"`) |
| `bindingKey` | transform | The binding key for the event data subscription |
| `subscribeOnMount` | checkbox | Subscribe when the screen loads (default: **`false`**) |

**Display**

| Field | Type | Description |
|-------|------|-------------|
| `padding` | slider | Inner padding (default: `8`) |
| `width` | text | Width (default: `"500px"`) |
| `height` | text | Height (default: `"650px"`) |

### Exposed Functions

| Function | Description |
|----------|-------------|
| `subscribe(bindingKey)` | Subscribe the console to an event binding key. The argument is **required** — there is no zero-argument re-subscribe |

There is no declared `unsubscribe()` or `clear()`.

### Exposed State

The bundle declares no state keys for `EventConsoleAdapter`.

*Unverified rows: `visible`, `filterTransform`, `messageTransform`, `maxMessages`, `onMessage`, the `unsubscribe()` / `clear()` functions and the `messages` / `connected` state. Note also that `subscribeOnMount` defaults to `false`, not `true`.*
