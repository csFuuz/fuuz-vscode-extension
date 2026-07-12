---
name: fuuz-screen-styling
description: Style Fuuz/MFGx platform screens following internal design guidelines. Use when the user needs to build dashboards, admin panels, or home pages with correct colors, spacing, card patterns, typography, naming conventions, and brand elements. Covers the three-zone page layout, metric KPI cards, help/link cards, getting-started checklists, brand gradient separator, and semantic color system.
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

### Naming Rules
- PascalCase with screen prefix: `AdminCardDataModels`, `EnterpriseMetricsRow1`
- End with role: `Container`, `Header`, `Icon`, `Label`, `Form`, `Action`, `Value`, `Section`
- Every element needs `description` prop explaining its purpose
- Screen element needs `custom.isaLevel`, `custom.isaDescription`, `custom.template`, `custom.version`
