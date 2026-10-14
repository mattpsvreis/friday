# Friday architecture reference

## Entities (`db/schema.ts`)

| Table | Role |
| --- | --- |
| `app_settings` | Password hash; legacy `month_end_day` / `default_bill_payment_day` unused by Dashboard |
| `sessions` | Hashed unlock tokens |
| `balance_snapshots` | `spendable_cents` / `saved_cents` |
| `categories` | Name, kind (`income` \| `expense`), color |
| `credit_cards` | Label, bank, last4, limit, `cycle_close_day`, `payment_due_day` |
| `purchases` + `installments` | Card purchases and parcelas (confirmed) |
| `ledger_entries` | Incomes/expenses (confirmed); optional `credit_card_id` |
| `recurring_rules` | Templates; optional card for card-method expenses |

Enums: `entry_status` (`unconfirmed` \| `confirmed`), `entry_direction`, `payment_method`.

## Dashboard (`lib/dashboard.ts` + `GET /api/dashboard`)

- Window: day 1 → last day of selected month (UTC).
- Query: `?year=&month=` (defaults to current UTC month).
- Series: viewed month −3 … +3 for income/expense and category stacks.
- **Income** — confirmed ledger income in month + enabled recurring income.
- **Expense** — one-time cash + recurring cash + fatura (parcels + card recurrings + card ledger; close−1).
- **Saved / Spendable** — snapshots.
- **Expected End** — spendable + incomes − oneTimeCash − recurringCash − faturaPaymentsDue (card ledger stays inside fatura, not double-counted in oneTimeCash for this formula).
- **predicted** (expense mix):
  - `oneTimeCashCents` = cash ledger expenses + `ledgerCardCents`
  - `recurringCashCents` = cash recurrings + card recurrings
  - `installmentsCents` = purchase parcels only
- Category donut / stacked bars: ledger + recurrings + parcels by `categoryId` (else Uncategorized).
- Stacked bars: per-month layers ordered by amount (highest segment on top); tooltip same order.
- Recent transactions: cash ledger + card purchases (not recurring templates); cap ~11.

## Auth flow

1. First visit: `/unlock` setup password → `POST /api/auth/setup`.
2. Later: unlock → `POST /api/auth/unlock` → token in `sessionStorage`.
3. `AuthGate` in `app/(app)/layout.tsx` keeps children mounted (Cache Components); redirects to `/unlock` if no/invalid token. Do not bounce on 5xx while a token exists.
4. `apiFetch` in `lib/session-client.ts` sends `Authorization: Bearer …`.

## Nav routes

`/`, `/transactions`, `/recurring`, `/expenses`, `/income`, `/cards`, `/categories`, `/settings`

`/balances` redirects to `/transactions`.

## Page responsibilities

| Route | Role |
| --- | --- |
| `/` | Dashboard KPIs, charts, expense mix, recent tx, recurrings preview |
| `/transactions` | Combined feed + balance editor + deletes |
| `/recurring` | CRUD templates, enable toggles, category donut side panel |
| `/expenses` | Cash/card ledger expenses + card purchases (installments) |
| `/income` | Income ledger |
| `/cards` | Card CRUD + limit usage |
| `/categories` | Category CRUD |
| `/settings` | Change password |

## API map

| Path | Purpose |
| --- | --- |
| `/api/auth/*` | status, setup, unlock, change-password |
| `/api/dashboard` | Month metrics + series |
| `/api/ledger` | Income/expense rows |
| `/api/purchases` | Card purchases + installments |
| `/api/recurring` | Templates |
| `/api/cards` | Credit cards |
| `/api/categories` | Categories |
| `/api/balances` | Snapshot update |
| `/api/settings` | App settings |

## Payment methods

- Selectable expense/recurring: Cash, Credit Card, PIX, Transfer, Other (`lib/payment-methods.ts`).
- Selectable income: Cash, PIX, Transfer, Other.
- `card_payment` remains in DB for legacy; display “Card Payment”; never add to new selectors.
- Credit-card ledger rows in tables may show the **card label** instead of “Credit Card”.

## Schema / DB commands

- Push schema: `pnpm db:push`
- Generate/migrate: `pnpm db:generate`, `pnpm db:migrate`
- Config: `drizzle.config.ts` → `DATABASE_URL`
