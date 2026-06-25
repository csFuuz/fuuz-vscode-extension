/**
 * Canonical Fuuz UI design system for **flow-built HTML/SVG widget outputs**
 * (saved-transform scripts that return a `data:text/html` URL rendered in an
 * EmbeddedWebpage, or a FusionCharts dataSource). This is the single source of
 * truth the extension ships so that every widget an AI copilot generates through
 * the Fuuz MCP looks like core Fuuz by default.
 *
 * No VS Code dependency, so it can be unit-tested in plain Node and imported by
 * any writer. The rendered markdown is dropped into the workspace as
 * `.fuuz/DESIGN_SYSTEM.md` and pointed to from `.fuuz/AVAILABLE.md`.
 *
 * Tokens mirror the tenant's `designSystem` ApplicationConfiguration
 * (`$appConfig.designSystem`) — scripts read that at runtime for live overrides;
 * the values baked in here are the fallback + design-time guidance.
 */

export const DESIGN_SYSTEM_VERSION = '1.0.0';

/** The paste-ready theme helper, emitted into the doc and reusable verbatim in a
 *  saved-transform. Honors the Fuuz script sandbox constraints: `var` only (no
 *  `const`/`let`), no `??`, no `for..of`, no `Map`/`Set`, no optional chaining. */
const THEME_HELPER = String.raw`/* ── Fuuz widget theme — paste near the top of a savedTransform ──────────────
 * Reads live tokens from $appConfig.designSystem when present, falling back to
 * the canonical defaults. Returns the surface palette, fonts, and a base CSS
 * string. Pass isDark (boolean) resolved from the theme passed by the screen
 * (themeMode: $metadata.settings.ThemeMode). */
function fuuzTheme(isDark) {
  var ds  = (typeof $appConfig !== 'undefined' && $appConfig.designSystem) ? $appConfig.designSystem : {};
  var tok = (ds.themeTokens && ds.themeTokens[isDark ? 'dark' : 'light']) || {};
  var sem = ds.semanticColors || {};
  var st  = ds.statusColors   || {};

  /* Widget surfaces complement the config (which defines text + glass, not a
   * base bg). Dark = neutral charcoal (matches core screens, NOT slate-blue);
   * light = white with a one-step panel. */
  var C = {
    bgBase:  isDark ? '#2A2A2E' : '#FFFFFF',
    bgPanel: isDark ? '#323239' : '#F1F3F5',
    bgCell:  isDark ? '#3A3A42' : '#F8FAFC',
    border:  isDark ? '#44444D' : '#E2E8F0',
    borderM: isDark ? '#54545E' : '#CBD5E1',
    txtP:    tok.txtPri  || (isDark ? '#FFFFFF' : '#111827'),
    txtS:    tok.txtMut  || (isDark ? '#CBD5E1' : '#6B7280'),
    txtT:    isDark ? '#9CA3AF' : '#94A3B8',
    /* Brand accent is violet — never the old blue. Lighten on dark for contrast. */
    accent:  isDark ? '#7C5CFF' : (sem.accent || '#5B30DF'),
    good:    sem.success || '#22C55E',
    info:    sem.info    || '#06B6D4',
    warn:    sem.warning || '#F59E0B',
    danger:  sem.danger  || '#EF4444',
    done:    sem.purple  || '#7C3AED',
    running: st.running  || '#3B82F6',
    planned: st.planned  || '#475569',
    muted:   st.idle     || '#94A3B8'
  };
  var FONT = (ds.fonts && ds.fonts.sans) || "'DM Sans',system-ui,sans-serif";
  var MONO = (ds.fonts && ds.fonts.mono) || "'DM Mono',ui-monospace,monospace";

  /* Base CSS every widget includes: DM Sans, the multicolor accent hairline as a
   * top border, neutral surface, and a violet focus ring. */
  var CSS_BASE =
    "*{box-sizing:border-box;font-family:" + FONT + "}" +
    "body{margin:0;background:" + C.bgBase + ";color:" + C.txtP + ";min-height:100vh}" +
    ".fz-accentline{height:3px;background:linear-gradient(90deg,#06B6D4,#3B82F6,#5B30DF,#EC4899)}" +
    ".fz-sechdr{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;" +
      "color:" + C.txtP + ";padding-bottom:5px;border-bottom:2px solid;" +
      "border-image:linear-gradient(90deg," + C.accent + ",transparent) 1;width:max-content}" +
    ".fz-num{font-family:" + MONO + ";font-variant-numeric:tabular-nums}" +
    ":focus-visible{outline:2px solid " + C.accent + ";outline-offset:1px}";

  return { C: C, FONT: FONT, MONO: MONO, CSS_BASE: CSS_BASE, isDark: isDark };
}`;

/** Build the canonical design-system markdown. Pure string — no I/O. */
export function renderDesignSystemDoc(): string {
  return `# Fuuz UI design system (v${DESIGN_SYSTEM_VERSION})

> Shipped by the Fuuz VS Code extension. **Apply this to every HTML/SVG widget
> output you generate** (saved-transform scripts that return a \`data:text/html\`
> URL or a FusionCharts dataSource) **by default — unless the user explicitly
> asks for something unique.** The goal is that any widget built through the
> Fuuz MCP is indistinguishable from a core Fuuz screen.

## The rule

When you write or edit a flow/script that produces a visual output:

1. **Default to these tokens.** Do not invent a palette or font. Read live tokens
   from \`$appConfig.designSystem\` at runtime (see helper below) and fall back to
   the canonical values here when the config is absent.
2. **Deviate only on request.** If the user asks for a specific/custom look, follow
   them — their words win. Otherwise, match core Fuuz.
3. **Carry both themes.** Resolve light/dark from the value the screen passes
   (\`themeMode: $metadata.settings.ThemeMode\`) and theme accordingly.

## Tokens

**Fonts** — \`DM Sans\` (sans), \`DM Mono\` (numeric/code). Never Roboto/Arial.

**Surfaces** (widget base — complements the config, which defines text + glass but no base bg):

| token | dark | light |
| --- | --- | --- |
| base background | \`#2A2A2E\` (neutral gray — **not** slate-blue, not near-black) | \`#FFFFFF\` |
| panel | \`#323239\` | \`#F1F3F5\` |
| cell | \`#3A3A42\` | \`#F8FAFC\` |
| border | \`#44444D\` | \`#E2E8F0\` |
| text primary | \`#FFFFFF\` | \`#111827\` |
| text muted | \`#CBD5E1\` | \`#6B7280\` |

**Accent** — violet \`#5B30DF\` (light) / \`#7C5CFF\` (dark). **Never** the old blue \`#3B82F6\` as the brand accent.

**Status / semantic palette** (from \`designSystem.statusColors\` / \`semanticColors\`):

| meaning | hex |
| --- | --- |
| success / complete | \`#22C55E\` / \`#10B981\` |
| running | \`#3B82F6\` |
| info | \`#06B6D4\` |
| warning / paused | \`#F59E0B\` / \`#D97706\` |
| danger / aborted | \`#EF4444\` / \`#DC2626\` |
| done / purple | \`#7C3AED\` |
| planned | \`#475569\` |
| idle / muted | \`#94A3B8\` |

For pills/badges on **dark**, use the lighter text variant from
\`designSystem.pillDarkText[baseHex]\` (e.g. \`#3B82F6\` → \`#93C5FD\`).

## Chrome conventions (match the core screens)

- A **multicolor accent hairline** (teal→blue→violet→pink) at the top of the content (\`.fz-accentline\`).
- **Section headers**: uppercase, 11px, 600 weight, with a violet → transparent underline (\`.fz-sechdr\`).
- **Inputs**: Material underline style — small muted floating label above, value below, chevron/clear on the right.
- **Badges/counts**: rounded pills.
- Numeric values use \`DM Mono\` with tabular figures.
- Orange is **app-bar chrome only** — do not use it inside content widgets.

## Paste-ready theme helper

Drop this near the top of a savedTransform and build the rest of the widget from
its return value. It honors the script sandbox (\`var\` only; no \`const\`/\`let\`,
\`??\`, \`for..of\`, \`Map\`/\`Set\`).

\`\`\`javascript
${THEME_HELPER}
\`\`\`

Usage:

\`\`\`javascript
var isDark = ($.theme || $.themeMode || 'dark').toLowerCase() !== 'light';
var T = fuuzTheme(isDark);
var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + T.CSS_BASE +
  '/* widget-specific rules using T.C.* */</style></head>' +
  '<body><div class="fz-accentline"></div>' +
  '<div class="fz-sechdr">Capacity</div>' +
  /* ... */ '</body></html>';
return { payload: { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) } };
\`\`\`

## FusionCharts (heatmap / sankey / etc.)

Set colors explicitly from the helper so FC can't override them:

- \`baseFont\` / \`*Font\` = \`T.FONT\`; \`baseFontColor\` = \`T.C.txtP\`
- \`bgColor\` / \`canvasBgColor\` = \`T.C.bgBase\` (with \`bgAlpha:'0'\` for transparent)
- Tooltip: \`toolTipBgColor\` = panel, \`toolTipBorderColor\` = border, \`toolTipColor\` = text
- Links/series = \`T.C.accent\`; utilization ramp = good → warn → orange → danger
- \`theme: 'fusion'\` is fine, but never rely on it for color — set every value

## Source of truth

Live tokens: the \`designSystem\` ApplicationConfiguration (\`$appConfig.designSystem\`)
in the active tenant. Edit that config (via the Fuuz MCP) to retune tokens — every
widget that uses the helper picks them up. This file is the design-time guide and
fallback, versioned with the extension.
`;
}
