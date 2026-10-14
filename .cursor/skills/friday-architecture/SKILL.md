---
name: friday-architecture
description: >-
  Friday personal finance domain: BRL centavos, fatura close−1 attribution,
  balance snapshots, installments vs card ledger, recurrings as templates,
  confirmed-only math, session auth, expense mix, payment methods. Use when
  changing schema, dashboard math, ledger/purchases/recurring APIs, auth,
  categories, cards, or finance rules.
---

# Friday architecture

Single-user BRL personal finance app on Next.js + Postgres (Drizzle).

## Locked domain rules

- **Balances:** Pure snapshots (`spendable` / `saved`). Never auto-mutated. Edited on Transactions.
- **Projections:** Confirmed rows only.
- **Credit cards:** Fatura cycles (`cycle_close_day`, `payment_due_day`). One `purchases` row; `installments` allocated automatically.
- **Expected cash:** `spendable + incomes − one_time_cash − recurring_cash − fatura_payments_due` (fatura uses close−1 attribution).
- **Dashboard window:** Full calendar month (UTC). User picks month on Dashboard. Charts: viewed month −3 … +3.
- **Cash vs card:** PIX/cash/transfer/other hit cash on `occurs_on`. Card purchases (parcels) and credit-card ledger rows hit the fatura cycle. Cut on each card’s **cycle close day**; budget that cycle in **close-month − 1** (close Nov 4 → October). Charge Oct 2 → close Oct 4 → September; Oct 5–Nov 4 → close Nov 4 → October.
- **Expense mix (Dashboard):**
  - **Recurring** — ON cash + card templates (card uses close−1).
  - **One-timers** — cash ledger expenses + one-shot credit-card ledger (not parcels).
  - **Installments** — purchase parcels only.
- **Recurring:** Templates only (ON/OFF). Never materialize ledger rows. Cash recurrings → income / recurring spend. Card recurrings → open fatura limit + bill due.
- **Categories:** User labels + `#RRGGBB`. Kind `income` | `expense`.
- **Payment methods (DB enum):** `pix`, `cash`, `credit_card`, `transfer`, `other`, legacy `card_payment`. UI labels/selectors: `lib/payment-methods.ts`. Do not offer `card_payment` in new selectors.
- **Auth:** One password (argon2). Bearer token in `sessionStorage` (`friday_session`). Closing the browser forces unlock again.
- **Manual entry only:** Confirmed writes. No bank/PDF import.

## Money and dates

- Money: integer **centavos**.
- Calendar dates: `YYYY-MM-DD`.
- API month: `year` + `month` (1–12).

## Key paths

| Area | Path |
| --- | --- |
| Schema | `db/schema.ts` |
| DB client | `db/index.ts` |
| Dashboard math | `lib/dashboard.ts` |
| Card limits | `lib/card-limits.ts` |
| Installments | `lib/purchases.ts` |
| Recurring | `lib/recurring.ts` |
| Payment labels | `lib/payment-methods.ts` |
| Auth | `lib/auth.ts`, `lib/session-client.ts` |
| Shell / gate | `components/app-shell.tsx`, `components/auth-gate.tsx` |
| Dashboard UI | `components/dashboard-view.tsx` |
| App routes | `app/(app)/…` |
| Unlock | `app/unlock/page.tsx` |
| APIs | `app/api/…` |

## Visual / UI chrome

Neon dark theme, glass panels, ScrollArea, charts: see `friday-ui`. Repo toolchain: `friday-repo`. Boot: `friday-runtime`.

## Further detail

See [reference.md](reference.md).
