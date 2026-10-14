# Friday

**Friday** is a single-user personal finance manager for Brazil (BRL). Track cash and credit-card spending, recurring income and bills, card fatura cycles, and a month-by-month dashboard — all behind a local password lock.

This is a private app meant to run on your machine (or your own host). There is no multi-user signup, no cloud sync, and no bank login.

---

## What you can do


| Area             | What it does                                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**    | Pick a month; see income, expense, saved, spendable, expected end-of-month cash; charts (−3…+3 months); expense mix (recurring / one-timers / installments); recent transactions |
| **Transactions** | Combined feed of ledger + purchases; edit spendable/saved snapshots                                                                                                              |
| **Recurring**    | ON/OFF templates for income and expenses (cash or card) — never auto-write ledger rows                                                                                           |
| **Expenses**     | One-shot cash/card ledger expenses and installment card purchases                                                                                                                |
| **Income**       | One-shot income entries                                                                                                                                                          |
| **Cards**        | Credit cards, limits, cycle close / payment due days, usage                                                                                                                      |
| **Categories**   | Named labels with colors for income and expense                                                                                                                                  |
| **Settings**     | Change unlock password                                                                                                                                                           |


Money is stored as **centavos** (integer). Dates are calendar `YYYY-MM-DD`. Credit-card charges follow each card’s **fatura cycle** (cut on cycle close day, budgeted in the previous month relative to that close).

---



## Tech stack


| Layer           | Choice                                                          |
| --------------- | --------------------------------------------------------------- |
| App             | [Next.js](https://nextjs.org/) **16.4** (App Router) + React 19 |
| Language        | TypeScript (strict)                                             |
| Styling         | Tailwind CSS **4** (CSS-first, Turbopack loader)                |
| Database        | PostgreSQL **18** (Docker Compose)                              |
| ORM             | [Drizzle](https://orm.drizzle.team/)                            |
| Charts          | [Recharts](https://recharts.org/)                               |
| Auth            | Argon2 password hash; session token in `sessionStorage`         |
| Package manager | **pnpm** only                                                   |
| Node            | **24** (see `.nvmrc`)                                           |


UI: dark neon theme (green / orange), frosted glass panels, animated currency background, Comfortaa + Source Serif 4.

---



## Prerequisites

1. **Node.js 24** — e.g. `nvm use` if you use nvm (reads `.nvmrc`).
2. **pnpm** — [install pnpm](https://pnpm.io/installation).
3. **Docker Desktop** (or another Docker engine) — required for local Postgres.

Do **not** use npm, yarn, or bun for this repo.

---



## First-time setup



### 1. Clone and install

```bash
git clone git@github.com:mattpsvreis/friday.git
cd friday
pnpm install
```



### 2. Create `.env`

Copy the shape below into a `.env` file at the repo root (this file is gitignored):

```env
POSTGRES_USER=friday
POSTGRES_PASSWORD=choose-a-strong-password
POSTGRES_DB=friday
DATABASE_URL=postgresql://friday:choose-a-strong-password@127.0.0.1:5432/friday
```

`DATABASE_URL` must use the same user, password, and database name as the three `POSTGRES_*` variables.

### 3. Start Postgres and push the schema

```bash
docker compose up -d --wait
pnpm db:push
```



### 4. Run the app

**Windows (recommended one-click):**

```bat
scripts\dev.bat
```

**macOS / Linux:**

```bash
chmod +x scripts/dev.sh   # once
./scripts/dev.sh
```

Or, if Postgres is already up:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Unlock

On first visit you set a password. Later visits unlock with that password. Closing the browser clears the session (`sessionStorage`) — you unlock again next time. There is no “remember me” across browser restarts by design.

---



## Day-to-day commands


| Intent                    | Command                               |
| ------------------------- | ------------------------------------- |
| Boot database + app       | `scripts/dev.bat` or `scripts/dev.sh` |
| App only                  | `pnpm dev`                            |
| Stop database (keep data) | `docker compose stop`                 |
| Wipe database volume      | `docker compose down -v`              |
| Lint                      | `pnpm lint`                           |
| Production build          | `pnpm build` then `pnpm start`        |
| Push schema changes       | `pnpm db:push`                        |


Ctrl+C stops Next.js; Postgres keeps running until you `docker compose stop`.

---



## How to use the app

1. **Unlock** at `/unlock`, then land on the **Dashboard**.
2. Set **Cards** and **Categories** early so expenses and purchases can be labeled.
3. Enter **Income** and **Expenses** (cash methods hit the calendar month; credit-card ledger and purchases follow fatura rules).
4. Add **Recurring** rules for salary and fixed bills; toggle them ON/OFF without creating duplicate ledger rows.
5. On **Transactions**, adjust **spendable** / **saved** when your real balances change — Friday never invents those numbers.
6. Use the Dashboard month picker to review past or upcoming months; charts show a ±3 month window around the selection.



### Expense mix (Dashboard)

- **Recurring** — enabled templates (cash + card).
- **One-timers** — cash ledger expenses **and** one-shot card ledger lines (not parcels).
- **Installments** — credit-card purchase parcels only.



### Payment methods

Selectors show: **Cash**, **Credit Card**, **PIX**, **Transfer**, **Other** (alphabetical; Other last). Income has no Credit Card option.

---



## Project layout

```
app/
  (app)/          # Auth-gated pages (dashboard, expenses, …)
  api/            # Route handlers
  unlock/         # Password setup / unlock
  globals.css     # Theme tokens + Tailwind
components/       # Shell, dashboard, ScrollArea, shared UI
db/               # Drizzle schema + client
lib/              # Domain math, auth, money, payment labels, hooks
scripts/          # dev.bat / dev.sh
compose.yaml      # Postgres 18
public/brand/     # Logo assets
```

Agent-oriented notes for Cursor live under `.cursor/skills/` (`friday-repo`, `friday-architecture`, `friday-runtime`, `friday-ui`).