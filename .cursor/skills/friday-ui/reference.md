# Friday UI reference

## Component map

| Component | Path | Role |
| --- | --- | --- |
| `AppShell` | `components/app-shell.tsx` | Sidebar + mobile header/drawer |
| `AuthGate` | `components/auth-gate.tsx` | Session check; keep children mounted |
| `CurrencyBackground` | `components/currency-background.tsx` | Canvas 2D currency shapes |
| `DashboardView` | `components/dashboard-view.tsx` | Home dashboard |
| `ScrollArea` | `components/scroll-area.tsx` | Custom scrollbar |
| `SortableTh` | `components/sortable-th.tsx` | Sortable column header |
| `PageHeading` | `components/page-heading.tsx` | Page title block |
| `CategoryPill` | `components/category-pill.tsx` | Colored category chip |
| `StatusPill` | `components/status-pill.tsx` | ON/OFF toggle pill |
| `ConfirmDeleteModal` | `components/confirm-delete-modal.tsx` | Two-step delete |
| `BalancesEditor` | `components/balances-editor.tsx` | Spendable/saved editor |

## Currency background config

`lib/currency-bg-config.ts` — speed, shapeCount, opacity, parallax, glow; unlock vs app multipliers. Pause on `document.hidden` / reduced motion.

## Money formatting

`lib/money.ts` — `formatBrl`, `parseBrlInput` (centavos ↔ BRL string with comma decimals).

## Color contrast

`lib/color-contrast.ts` — text on category colors when needed.

## CSS tokens (`app/globals.css`)

| Token | Typical use |
| --- | --- |
| `--neon-green` | Primary accents, positive, scroll thumb |
| `--neon-orange` | Secondary accents, expenses |
| `--surface` / glass mixes | Panels |
| `--border` | Green-tinted borders |
| `--muted` | Secondary text |

## Anti-patterns

- Flat opaque cards that block the currency background when glass is available.
- Putting Legend at bottom with `position: relative` inside fixed-height chart containers.
- Raw enum strings (`credit_card`) in selects or table cells.
- Native overflow scrollers next to `ScrollArea` usages.
- Icons cluttering table rows.
