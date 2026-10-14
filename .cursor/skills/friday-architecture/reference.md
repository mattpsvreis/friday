# Friday architecture reference

## Entities

- `app_settings` — password hash (legacy month-end fields unused by Dashboard)
- `sessions` — hashed unlock tokens
- `balance_snapshots` — spendable/saved cents (edited on Transactions)
- `categories` — user labels (`income` \| `expense`) + color
- `credit_cards` — label, bank, last4, limit, cycle/payment days
- `purchases` + `installments` — card purchases and parcelas (confirmed)
- `ledger_entries` — cash incomes/expenses (confirmed)
- `recurring_rules` — templates summed on the dashboard (no ledger materialization)

## Dashboard month window

- Full calendar month: day 1 through last day of the selected month (UTC)
- Client picks month on Dashboard (`type="month"` + prev/next)
- `GET /api/dashboard?year=2026&month=10` (defaults to current UTC month)
- Series payload covers viewed month −3 … +3 for charts

## Dashboard splits / KPIs

- **Income** — confirmed ledger income in the month + enabled recurring income
- **Expense** — one-time cash + recurring cash + fatura dues attributed to due-month − 1 (installment parcels + card recurrings)
- **Saved / Spendable** — balance snapshots
- **Expected End** — spendable + incomes − one-time cash − recurring cash − fatura dues (same −1 attribution)
- Category donut / stacked bars attribute ledger, recurrings, and installment parcels by `categoryId` (else Uncategorized)
- Recent transactions: cash ledger + card purchases only (not recurring templates)
- Auto-generated ledger rows from the old materialization model are purged on dashboard load

## Nav routes

`/`, `/transactions`, `/recurring`, `/expenses`, `/income`, `/cards`, `/categories`, `/settings`

(`/balances` redirects to `/transactions`. Review/Import removed.)

## Boot

Use `scripts/dev.bat` / `scripts/dev.sh`. Schema push: `pnpm db:push`.
