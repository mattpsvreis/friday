---
name: friday-ui
description: >-
  Friday UI chrome: neon dark glass theme, CurrencyBackground, ScrollArea,
  sortable tables, payment method labels, Recharts legends/tooltips,
  StatusPill, ConfirmDeleteModal. Use when editing components, dashboard
  charts, forms, tables, scrollers, or visual styling.
---

# Friday UI

Visual + interaction conventions. Domain math: `friday-architecture`. Tokens/stack: `friday-repo`.

## Theme

- Dark only. Near-black background; neon green primary; neon orange secondary.
- Fonts: Comfortaa (UI), Source Serif 4 (titles).
- Panels: `glass-panel` / `glass-panel-strong` (and `GLASS_PANEL_CLASS` / border helpers in `lib/ui-classes.ts`).
- Animated `CurrencyBackground` in root layout; keep content above it (`relative z-10`).

## ScrollArea

Native Windows scrollbars ignore webkit CSS. Use **`components/scroll-area.tsx`**:

- Hides native bars (`.friday-scroll-hide`).
- Draws neon-green overlay thumbs (vertical / horizontal / both).
- Put `max-h-*` on the **wrapper** `className` so `max-h-[inherit]` on the viewport works.
- Tables: `<ScrollArea orientation="horizontal" className={TABLE_WRAP_CLASS}>`.

Do not reintroduce raw `overflow-y-auto` / `overflow-x-auto` without `ScrollArea` unless the user asks.

## Forms and tables

- Inputs / buttons: `INPUT_CLASS`, `BTN_PRIMARY_CLASS`, `BTN_LINK_CLASS`, `BTN_DANGER_CLASS`.
- Tables: `TABLE_CLASS`, `TH_CLASS` / `SortableTh`, `TD_CLASS`.
- Sort: `lib/use-table-sort.ts`. Default date columns newest-first where applicable.
- Deletes: `ConfirmDeleteModal` + `useConfirmDelete` (two-step confirm).
- Categories: `CategoryPill`. Recurring enable: `StatusPill` (green/red).

## Payment method display

Always use `lib/payment-methods.ts` for labels and select options. Never show raw snake_case in UI. Order: alphabetical, **Other** last. No `card_payment` in selectors.

## Charts (Recharts)

- Legend for income/expense: `verticalAlign="top"` with explicit `height` — avoid `position: "relative"` on Legend wrappers (breaks on client nav).
- Category stack: per-month amount layers (highest on top); custom tooltip sorts highest-first; legend can be a plain list above the chart.
- Tooltips: dark `#121212` panel, high `zIndex`, BRL via `formatBrl`.

## Icons

Lucide on sidebar and KPI cards only. No icons on data rows.

## Nav

`lib/nav.ts` — `APP_NAV` + `SETTINGS_NAV`. Shell: `components/app-shell.tsx` (fixed left sidebar; mobile drawer).

## Further detail

See [reference.md](reference.md).
