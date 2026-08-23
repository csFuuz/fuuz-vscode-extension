---
name: fuuz-screen-styling
description: Style Fuuz/MFGx platform screens following internal design guidelines. Use when the user needs to build dashboards, admin panels, or home pages with correct colors, spacing, card patterns, typography, naming conventions, and brand elements. Covers the three-zone page layout, metric KPI cards, help/link cards, getting-started checklists, brand gradient separator, and semantic color system. Also carries the runtime-verified "Additional Styles" (`style`) reference — which CSS properties work on native screen elements, the casing and value rules, precedence against the panel, and the two hazards that silently break a screen.
---

# Fuuz Screen Styling Guidelines

Follow these guidelines when building Fuuz platform internal screens (dashboards, admin panels, home pages).

## Load Reference Docs

Read the styling documentation for detailed specs:
- `.claude/docs/screen-styling/_overview.md` — design philosophy and file index
- `.claude/docs/screen-styling/layout.md` — page zones, spacing scale, section structure
- `.claude/docs/screen-styling/cards.md` — metric KPI cards, help cards, checklist cards, activity cards
- `.claude/docs/screen-styling/typography.md` — font sizes, text patterns, RichText inline styles
- `.claude/docs/screen-styling/colors.md` — brand palette, semantic colors, borders, shadows
- `.claude/docs/screen-styling/naming.md` — element naming conventions, descriptions, ISA metadata

## Quick Reference

### Three-Zone Page Layout
```
ROOT (Screen, dark, forceFullscreen)
├── HeaderContainer (paper, row, padding: 6)
│   ├── TitleGroup (row, gap: 12px, flexGrow)
│   │   ├── IconWrapper (40×40, borderRadius: 8, bg: #3b82f620)
│   │   │   └── Icon (32×32, #2563eb, light)
│   │   └── PageTitle (RichText, fontsize-16, bold)
│   └── ActionGroup (row, gap: 8px, flex-end)
│       └── ActionButtons (useIconButton, 20×20)
├── BrandSeparator (4px, gradient: #39005a → #5b30df → #03caaf)
└── MainContentArea (column, margin: 6, gap: 20px)
    ├── MetricsRow (row, wrap, gap: 16px, columns: 4)
    │   └── MetricCard × N
    ├── GettingStartedSection (paper, shadow, gap: 12px)
    ├── HelpSection (paper, shadow, gap: 12px)
    └── RecentActivitySection (paper, shadow, gap: 12px)
```

### Metric KPI Card (310×110)
- `padding: 8, margin: 8, borderRadius: 8, shadow: true, background: 'paper'`
- Border: `1px solid rgba(148, 163, 184, 0.3)` (standard) or `2px solid #2563eb` (featured)
- Shadow: `box-shadow: 2px 2px 6px #8b5cf6`
- Header: RichText title `fontsize-14 BOLD` + subtitle `fontsize-10`
- Values: DisplayText `fontSize: 'h4'` with semantic colors (green=#16a34a, amber=#d97706)

### Help/Link Card (310×90)
- `padding: 6, margin: 6, borderRadius: 8, cursor: pointer, onClickTransform: true`
- Shadow: `box-shadow: 0px 0px 1px 1px #8b5cf6`
- Text: title `fontsize-14 BOLD` + description `fontsize-12`

### Spacing Scale
| 4px | 8px | 12px | 16px | 20px |
|-----|-----|------|------|------|
| Inner card | Buttons, items | Sections, cards | Metric rows | Major sections |

### Color Palette
| Role | Color |
|------|-------|
| Primary icon | `#2563eb` |
| Icon wrapper bg | `#3b82f620` |
| Card shadow | `#8b5cf6` |
| Deployed/positive | `#16a34a` |
| Healthy total | `#10b981` |
| Complete | `#2FBF71` |
| Draft/warning | `#d97706` |
| Incomplete | `#3B82F6` |
| Standard border | `rgba(148, 163, 184, 0.3)` |

### Property Names These Recipes Depend On

Checked against the designer's registry and four production tenants in August 2026. The layout
sketch above uses shorthand; these are the props to actually write.

| Written above | Real property | Note |
|---|---|---|
| `forceFullscreen` on ROOT | `removeOuterMargin` | `removeOuterMargin` is the declared Screen property. `forceFullscreen` is stored by real screens but declared nowhere — unproven |
| `cursor: pointer` on a help card | — | Container declares no `cursor`. The clickable affordance comes from `onClickTransform` |
| `onClickTransform: true` | `onClickTransform` + `onClickActions` | `onClickTransform` only *enables* the handler; `onClickActions` holds the transform that runs. A card with `onClickTransform` alone does nothing. Clicks on child elements are ignored |
| `box-shadow: …` | `style` | Raw CSS goes in `style`, a transform holding a CSS object with camelCase keys (`{ "boxShadow": "2px 2px 6px #8b5cf6" }`). `shadow: true` is the boolean preset |
| `Border: 1px solid …` | `bordersInput` | The declared border property is `bordersInput` (style, width, color, sides). There is no `border` prop |
| `columns: 4` on MetricsRow | `layout: "grid"` + `columns` | `columns` only applies when the Container's `layout` is `"grid"`; in a flex row it does nothing |
| `collapsed` | `collapsedByDefault` | With `collapsible: true`. `collapsedSize` sets the collapsed height, `collapsedFooter` moves the control into a footer strip |
| RichText `fontsize-14 BOLD` | — | These are classes inside the rich text **content**, not props. `RichText` declares only `content`, `width`, `height` and `description` — no `fontSize`, `color`, `fontWeight` or `textAlign` |
| DisplayText `fontSize: 'h4'` | `fontSize` | Correct — `DisplayText` is the only element declaring `fontSize`, and it takes typography names (`h1`–`h5`, `body1`), not pixels. Its label size is `labelFontSize` |

`sx`, `elevation`, `tooltip`, `aria-label` and `data-testid` are stored by the backend and
honoured by nothing. Do not reach for them when a style will not apply.

### Naming Rules
- PascalCase with screen prefix: `AdminCardDataModels`, `EnterpriseMetricsRow1`
- End with role: `Container`, `Header`, `Icon`, `Label`, `Form`, `Action`, `Value`, `Section`
- Every element needs `description` prop explaining its purpose
- Screen element needs `custom.isaLevel`, `custom.isaDescription`, `custom.template`, `custom.version`

---

## Additional Styles — the `style` prop

Runtime-measured against the deployed platform in August 2026: **274 probes across four lanes,
every one rendered and read back with `getComputedStyle`** — 241 work, 27 inert, 4 inconclusive,
2 delivered-but-overridden. Each row below carries the channel it was measured on. Nothing here is
inferred from a property's siblings: if a declaration is not named, it was not measured, and this
skill says nothing about it — which is the honest position, and more useful than a guess that reads
like a fact.

**Two ways a declaration can fail, and they debug differently.** *Ignored* means it never reached
the DOM — no inline declaration, nothing to see in DevTools. *Delivered-but-overridden* (the
box-model lane calls it `declared-not-effective`) means it **did** reach the element's inline
`style` attribute and then lost to something else — you will see it in DevTools, struck through
or simply not winning. When a style you wrote is visibly present and doing nothing, you are
looking at the second kind, and the fix is a different one.

**Scope.** All of this describes **native Fuuz screen-designer elements** — the Craft.js element
tree and the `style` prop bag those components hand to React. It does **not** describe a screen
built as hand-written HTML/CSS, nor content inside an `EmbeddedWebpage` document, a
`RichText`/markdown body, or any other surface that bypasses the element tree. The limits below
are properties of the *component* pipeline. Do not generalise them to raw HTML.

### Where the property lives

| Element | Property | Panel label | Section | Transform-capable |
|---|---|---|---|---|
| `Container` | `style` | Additional Styles | Advanced | yes |
| `GridCell` | `style` | Additional Styles | Advanced | yes |
| `EmbeddedWebpage` | `style` | Additional Styles | Advanced | yes |
| `TableColumn` | `style` | Styles | Display | yes |

It is used on **6,647 production Containers** and **1,066 TableColumns** across four tenants.
Every runtime probe here was run on `Container`, plus four on `TableColumn`. `GridCell` and
`EmbeddedWebpage` declare the same field and merge it into their inline style the same way in the
shipped bundle, but neither was measured — treat their behaviour as expected, not verified.

### It is a React inline-style object

Not CSS-in-JS, not a stylesheet. The bag is merged into the element's single inline `style`
object and handed to React, which assigns each key straight onto the node's `CSSStyleDeclaration`.
That one fact explains everything below: selectors and at-rules have nowhere to land, bare
numbers get a unit appended, and an inline declaration outranks any class the panel adds.

### Two hazards, before anything else

> **1 — A malformed value blanks the entire screen, silently.**
> Measured as five isolated cases, one deployed screen each, behind a baseline that rendered:
> a `style` holding a **string** (`"background-color: red; min-height: 77px"`), an **array**, an
> **unparseable `__transform`**, and a **well-formed `__transform` that returns a string** each
> left the app shell rendering and the entire screen body empty — not one of the 255 elements
> drew. Only a bare **number** survived. It is not a syntax problem (the returning-a-string
> transform is valid JSONata) and `typeof` is not the guard (an array is `typeof "object"` and
> still kills the screen). No snackbar, no error-boundary message and no partial render reach the
> author — an unparseable transform at least writes `Transform Error:` to the console, and the
> non-object `style` writes nothing at all. Pasting a CSS declaration block into a field labelled
> "Additional Styles" is exactly how this happens. Platform defect **D8**.

> **2 — Quoted keys are dead, and re-editing makes it worse.**
> The JSON smart input writes key names back **wrapped in literal quote characters**, and does it
> again on each subsequent edit: `box-shadow` → `"box-shadow"` → `"\"box-shadow\""`. A quoted name
> matches no CSS property, so the declaration is inert — measured directly (a bag whose only key
> was `"box-shadow"` moved nothing). **484 stored declarations across 16 key paths are already
> dead this way**, all on Containers. Check any style bag for stray quotes around its keys, and
> fix it by rewriting the key, never by re-editing in place. Platform defect **D7**.

### Casing — camelCase is the safe default

With **string** values both spellings resolve identically: 7 of 7 kebab/camel pairs matched
(`box-shadow`/`boxShadow`, `border-radius`, `overflow-y`, `border-bottom`, `background-color`,
`min-height`, `-webkit-line-clamp`). Kebab-case is not inert, and the 675 kebab declarations in
production are mostly fine.

With **bare numbers** they diverge: 0 of 4 kebab pairs applied. React appends `px` from a
unitless table keyed by camelCase, and a kebab key is never found in it.

| Written | Result |
|---|---|
| `{"fontWeight": 700}` | works |
| `{"font-weight": "700"}` | works — the value is a string |
| `{"font-weight": 700}` | **stores cleanly, reads back byte-identical, does nothing** |
| `{"z-index": 7}` / `{"flex-grow": 2}` | dropped — written out as `7px` / `2px`, which the parser rejects |
| `{"line-height": 1.7}` | **worse — silently becomes `1.7px`** instead of a ratio |

The wrong-but-accepted case is the dangerous one. Write camelCase keys, or quote the value.

### Values

- **A bare number gets `px` appended** unless the camelCase name is on React's unitless list.
  Measured as unitless and safe as bare numbers: `lineHeight`, `zIndex`, `opacity`, `flexGrow`,
  `order`. Measured as unit-appended (usually what you wanted): `marginTop`, `padding`, `gap`,
  `minHeight`, `fontSize`.
- **`{"aspectRatio": 2}` is rejected** — the bare number is written out as `2px`, the parser
  throws it away, and the computed value never moves. Write the string `{"aspectRatio": "2 / 1"}`,
  which applied.
- **Functions and variables that were measured working:** `linear-gradient(...)` (as
  `backgroundImage` and as the `background` shorthand), `rgba(...)`, `var(--x, fallback)`, and
  setting a custom property and consuming it in the same bag (`{"--epProbeVar": "rgb(3,5,7)",
  "color": "var(--epProbeVar)"}` resolved).
- **`calc()` is unsettled.** Its only probe wrote `width: "calc(100px + 10%)"`, which reached the
  element's inline style and then lost to the wrapper's flex layout like every other `width`
  (below) — `delivered-but-overridden`, not ignored. So the value travels; whether it resolves on
  a property that is not `width` was not measured.
- **`!important` inside a value string measured `inconclusive`** — it is a no-op even applied
  natively through the same API, so the result says nothing about the platform. Do not write it;
  do not claim the platform strips it.

### What does not work — all measured

| Written | Verdict |
|---|---|
| `{"&:hover": {...}}` | ignored — nested pseudo-class |
| `{"&::before": {...}}` | ignored — nested pseudo-element |
| `{"& div": {...}}` | ignored — descendant selector |
| `{"@media (min-width: 1px)": {...}}` | ignored — even when always true |
| `{"-webkit-backdrop-filter": "blur(8px)"}` | ignored in every spelling — write `backdropFilter`, which applied |
| `{"zzzNotARealProperty": "..."}` | ignored, in both spellings — a typo is completely silent |
| a key that is itself quoted | ignored — see hazard 2 |

The `&:hover` row is a real behavioural measurement, not a timeout: the probe hovered the element
and nothing moved. There is no way to express a hover, a breakpoint or a pseudo-element through
this field — reach for a panel control, a transform on a state value, or a different element.

**`animation` is the one that reads as working and is not.** The shorthand does reach computed
style — `animation-name` and `animation-duration` both changed — but `@keyframes` cannot travel
with it: a nested `"@keyframes name": {…}` key is not CSS-in-JS, it is an inline-style object,
and the key is dropped. The declaration therefore names a rule that cannot exist, and
`getAnimations()` on the node returned nothing: **nothing animates.** The raw verdict on that row
reads `applied`; read it as "declared, inert". `transition` (shorthand and longhands) applied and
is the one that works.

### Container-specific

- **`style.width` will not stick.** It is `delivered-but-overridden`: the declaration *does* reach
  the element's inline style attribute (measured as `box-sizing: border-box; width: 123px; …`),
  and the computed width stays what it was, because the element carries `root { flex: 1 }` inside
  a resizable mount and the wrapper's flex layout decides the used width. So it is visible in
  DevTools and has no effect. Measured escapes: `{"flex": "none", "width": "137px"}` moved the used
  width to 137px; `flexBasis: "auto"` alone did **not** (the element still grows back);
  `minWidth`/`maxWidth` work as bounds and did move it.
- **`display: "inline-flex"` blockifies to `flex`** — same class of outcome: the declaration
  arrives, a flex item cannot be inline. `block`, `flex`, `grid` and `none` all applied.
- **`height` needs none of this.** It is the cross axis and applies directly — with a panel height
  of `120px` and `style.height: "200px"`, 200px is what applied.

### Precedence

`style` is merged last — `Object.assign(panelBase, borders, layout, style, ...rest)` — so it
**wins** over the panel controls that write to the same node. Measured wins: `padding`, `margin`,
`height`, `borderRadius`, `border`/`bordersInput`, `flexDirection`, `justifyContent`,
`alignItems`, `justifyItems`, `gap`, the grid/flex `layout` mode, the `shadow` checkbox
(`{"boxShadow": "none"}` cleared it) and the `background` class.

Two things that are **not** wins:

- **`width` is not a precedence contest.** The merge order does not decide it — `style.width`
  arrives on the element and is then overridden by the wrapper's flex layout. Read the
  Container-specific note above rather than treating the panel as "winning".
- **An unrecognised TOP-LEVEL prop beats `style`**, because the rest bag merges after it
  (a top-level `minHeight` overrode `style.minHeight`). That is a reason not to invent top-level
  keys on a Container, not a technique to use.

### Transforms

`style` is a transform field, so the bag can be computed.

- **`style.__transform` is evaluated at render, and its result applies.** An envelope returning
  `{ "minHeight": "83px", "backgroundColor": "rgb(255,0,0)" }` landed both declarations on the
  element, and so did the kebab-keyed version of the same object.
- **Kebab-case keys inside a transform's returned object behave identically to camelCase** — the
  two envelopes resolved to the same computed values. Production's style transforms overwhelmingly
  return kebab keys, and they are fine. (The bare-number casing trap still applies to whatever the
  expression returns.)
- **A per-property transform is ignored.** `style.color.__transform` moved nothing — transform
  resolution is depth-1 only, so an envelope one level further down is never found. The contrast
  is the point: the top-level form is used **320 times** in production and works (280 Containers
  across 3 tenants, 40 TableColumns across 3), while **two production TableColumns carry
  `style.color.__transform`** — one tenant, expression `data.codeColor` — and have been silently
  dead since the day they were written. If you are colouring a cell per row, put the envelope on
  `style` and return the whole object from it.
- **Re-evaluation timing and caching are untested.** Two probes carried a dependency on form-dirty
  state, one with `__cacheKey: ""` and one with a non-empty key; both evaluated correctly for the
  non-dirty form, but the interaction that would have dirtied it never ran (the probe timed out).
  Nothing here says how or when a `style` transform re-evaluates — do not claim it does or does not.
- **A transform that throws, or returns a non-object, blanks the screen** — hazard 1.

### TableColumn is not the same bag

Only four probes, and only one of them applied:

| Written on a `TableColumn` | Verdict |
|---|---|
| `{"alignItems": "flex-end"}` | applied — landed on the inner cell divs |
| `{"align-items": "flex-end"}` | ignored — kebab does not work here |
| `{"backgroundColor": "..."}` | ignored |
| `{"background-color": "..."}` | ignored |

A column style is read through a schema-constrained smart input and a custom cell renderer, not
the Container path. Write camelCase, and expect only `alignItems` to be proven — it is the
most-used style key in the whole export (1,026 of the 1,066 TableColumns carrying a style bag).
Per-row colouring belongs in a transform on `style` itself, never on `style.color`; see above.

### The working set

Every property below was measured on a `Container` at runtime and works. Grouped as the lanes
measured them.

| Group | Applied |
|---|---|
| Box model & sizing | `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `margin`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft`, `padding`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `boxSizing`, `aspectRatio` (string form), `inset` |
| Display & positioning | `display` (`block`, `flex`, `grid`, `none`), `position` (`relative`, `absolute`, `sticky`, `fixed`, `static`), `top`, `right`, `bottom`, `left`, `zIndex`, `float`, `clear` |
| Flexbox | `flexDirection`, `flexWrap`, `justifyContent`, `alignItems`, `alignSelf`, `alignContent`, `gap`, `rowGap`, `columnGap`, `flexGrow`, `flexShrink`, `flexBasis`, `flex`, `order` |
| Grid | `gridTemplateColumns`, `gridTemplateRows`, `gridTemplateAreas`, `gridArea`, `gridColumn`, `gridRow`, `gridAutoFlow`, `gridAutoColumns`, `gridAutoRows`, `placeItems`, `placeContent` |
| Typography | `fontSize`, `fontFamily`, `fontStyle`, `fontWeight`, `fontVariant`, `lineHeight`, `letterSpacing`, `wordSpacing`, `textAlign`, `textTransform`, `textDecoration`, `textOverflow`, `textIndent`, `whiteSpace`, `wordBreak`, `overflowWrap`, `verticalAlign`, `writingMode`, `WebkitLineClamp` (with `display: "-webkit-box"` + `WebkitBoxOrient`) |
| Colour | `color` (hex, hex+alpha, `rgb()`, `rgba()`, `hsl()`, named, `transparent`, `currentColor`), `opacity`, `caretColor`, `accentColor` |
| Background | `backgroundColor`, `background`, `backgroundImage`, `backgroundSize`, `backgroundPosition`, `backgroundRepeat`, `backgroundClip`, `backgroundBlendMode`, `backdropFilter` |
| Borders | `border`, `borderTop`, `borderRight`, `borderBottom`, `borderLeft`, `borderWidth`, `borderStyle`, `borderColor`, `borderRadius`, per-corner radii (`borderTopLeftRadius`), `outline`, `outlineOffset`, `borderImage` |
| Effects | `boxShadow`, `textShadow`, `filter` (`blur`, `grayscale`, `brightness`, `drop-shadow`), `backdropFilter`, `mixBlendMode`, `transform` (`rotate`, `translate`, `scale`, `skew`), `transformOrigin`, `perspective`, `clipPath`, `mask` |
| Motion | `transition`, `transitionProperty`, `transitionDuration`, `transitionTimingFunction`, `transitionDelay`, `willChange` — **not** `animation`, see above |
| Overflow & scrolling | `overflow`, `overflowX`, `overflowY`, `scrollBehavior`, `overscrollBehavior`, `resize`, `scrollbarWidth` |
| Interaction | `cursor`, `pointerEvents`, `userSelect` (also sets `-webkit-user-select`), `visibility`, `isolation`, `touchAction` |

Two notes on that table. Every property in it, typography included, was measured at runtime — but
one *further* observation about them was not: that the inherited CSS properties (`fontSize`,
`fontWeight`, `lineHeight`, `textAlign`, `textTransform`, `color`, `writingMode`) reach the
children of the styled Container while `backgroundColor` and `opacity` stay on its own node. That
came from a replica of the style path rather than the deployed screen. It is the usual reason to
wrap an element that declares no `style` of its own in a Container — but treat it as ordinary CSS
inheritance, not as a measured platform behaviour. And `pointerEvents` moved the computed value, but the
probe's hit-test oracle found no element at the box centre in either arm, so the behavioural half
of that row is unproven.

### Two recipes, verified

**A shadow.** The exact string the largest group of production Containers ships, resolved to
`rgba(0, 0, 0, 0.15) 0px 1px 2px 0px`:

```json
{ "boxShadow": "0 1px 2px rgba(0,0,0,0.15)" }
```

To remove the shadow the panel checkbox adds, write `{"boxShadow": "none"}` — the checkbox is a
class, `style` is inline, and inline wins.

**A scroll container — two parts, not one.** `overflowY: "auto"` genuinely produces a scroll
container (the probe scrolled the box, rather than reading the keyword back). But the content
inside it is a flex item whose automatic minimum size resolves from its content, so it shrinks to
fit and never overflows. The keyword alone is half the recipe; the content needs a floor:

```json
// on the scrolling Container — give it a constrained height in the panel
{ "overflowY": "auto", "scrollbarWidth": "thin" }

// on the content inside it, or it shrinks to fit and never scrolls
{ "minHeight": "400px" }
```

`Container` declares no overflow property of its own, so nothing competes with what you write.
