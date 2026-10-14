# Friday architecture reference

## Entities

- `app_settings` — password hash, month-end day, default bill day
- `sessions` — hashed unlock tokens
- `balance_snapshots` — spendable/saved cents
- `categories` — user labels (`income` \| `expense`)
- `credit_cards` — label, bank, last4, limit, cycle/payment days
- `purchases` + `installments` — card purchases and parcelas
- `ledger_entries` — cash incomes/expenses (and card_payment)
- `recurring_rules` — templates summed on the dashboard (no ledger materialization)
- `import_batches` — PDF import metadata/warnings

## Extrato import

- Debits only → unconfirmed `ledger_entries`
- Skip `SALDO DO DIA`, `REND PAGO`
- `FATURA PAGA` → method `card_payment`
- `PIX …` → method `pix`
- Never create income

## Fatura import

- Requires `creditCardId`
- Detect close/due/limit when possible; update card days/limit
- Lines with `NN/MM` → multi-installment purchase via `buildInstallments`
- All purchases start `unconfirmed`

## Dashboard month window

- Full calendar month: day 1 through last day of the selected month (UTC)
- Client picks month on Dashboard (`type="month"` + prev/next)
- `GET /api/dashboard?year=2026&month=10` (defaults to current UTC month)

## Dashboard splits

- `predicted.oneTimeCashCents` — confirmed ledger cash expenses in the month (excl. card methods)
- `predicted.recurringCashCents` — sum of enabled recurring expense rules (excl. card methods)
- `incomesCents` — confirmed ledger income in the month + enabled recurring income rules
- `predicted.installmentsCents` — confirmed installments whose payment due falls in window
- `faturaPaymentsDueCents` — same installment dues (cash leaving for card bills)
- Card `usedCents` — remaining confirmed installments from open cycle forward
- Auto-generated ledger rows from the old materialization model are purged on dashboard load

## Nav routes

`/`, `/review`, `/expenses`, `/income`, `/recurring`, `/categories`, `/cards`, `/balances`, `/import`, `/settings`

## Boot

Use `scripts/dev.bat` / `scripts/dev.sh`. Schema push: `pnpm db:push`.
