---
name: friday-architecture
description: >-
  Friday personal finance domain and UI: balance snapshots, card-cycle
  installments, confirmed-only projections, recurrings, sessionStorage
  password lock, neon dark theme, and fixed left sidebar. Use when changing
  finance models, dashboard math, auth, routes, or visual/navigation patterns.
---

# Friday architecture

Single-user BRL personal finance app on Next.js + Postgres.

## Locked domain rules

- **Balances:** Pure snapshots (`spendable` / `saved`). Never auto-mutated. Edited from Transactions.
- **Projections:** Confirmed rows only.
- **Credit cards:** Belong to fatura cycles (`cycle_close_day`, `payment_due_day`). One `purchases` row; `installments` allocated automatically.
- **Expected cash:** `spendable + incomes_in_window − cash_expenses_in_window − fatura_payments_due_in_window`.
- **Dashboard window:** Full calendar month (1st → last day). User picks the viewed month on the Dashboard. Charts cover viewed month −3 … +3.
- **Cash vs card:** PIX/cash/other hit cash on `occurs_on`. Card purchases hit limit/cycle; cash drops on payment due day for that cycle’s installments.
- **Recurring:** Templates only (ON/OFF). Never create ledger rows. Cash recurrings sum into income / recurring cash spend. Credit-card recurrings hit card limit (open fatura) and card bill due for the viewed month.
- **Categories:** User-defined labels with a `#RRGGBB` color.
- **Auth:** One password (argon2). Session token in `sessionStorage` (`friday_session`). Closing the browser forces unlock again.
- **No import/review queue:** Manual entry and confirmed-only writes. PDF import / unconfirmed review were removed.

## Visual system

- Dark only: near-black bg, neon green primary, neon orange secondary.
- Fonts: Comfortaa (UI), Source Serif 4 (titles) via `next/font/google`.
- No light theme / no `prefers-color-scheme` light branch.
- Fixed **left sidebar** nav (icons via Lucide); mobile uses the same drawer as overlay. Unlock is full-screen outside the shell.
- Icons on chrome only (sidebar, KPI cards). No icons on data rows.
- ON/OFF status uses filled green/red pills.

## Key paths

| Area | Path |
| --- | --- |
| Schema | `db/schema.ts` |
| DB client | `db/index.ts` |
| Dashboard math | `lib/dashboard.ts` |
| Installment builder | `lib/purchases.ts` |
| Recurring | `lib/recurring.ts` |
| Auth | `lib/auth.ts` |
| Shell | `components/app-shell.tsx` |
| App routes | `app/(app)/…` |
| Unlock | `app/unlock/page.tsx` |

## Money and dates

- Store money as integer **centavos**.
- Store calendar dates as `YYYY-MM-DD`.
- Dashboard month is selected in the UI; API uses `year` + `month` (1–12).

## Further detail

See [reference.md](reference.md).
