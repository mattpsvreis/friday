# Friday repository reference

## package.json

- `name`: `Friday`
- `version`: follows semver in repo (see package.json)
- `private`: `true`
- No `packageManager` / `engines` fields; `.nvmrc` pins Node **24**.

### Scripts

| Script | Runs |
| --- | --- |
| `dev` | `next dev` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `eslint` |
| `db:generate` | `drizzle-kit generate` |
| `db:migrate` | `drizzle-kit migrate` |
| `db:push` | `drizzle-kit push` |

### Runtime dependencies (core)

| Package | Role |
| --- | --- |
| `next` `16.4.0` | App framework |
| `react` / `react-dom` `19.x` | UI |
| `drizzle-orm` + `postgres` | DB |
| `argon2` | Password hashing |
| `recharts` | Dashboard charts |
| `lucide-react` | Nav / KPI icons |
| `zod` | Validation where used |

### Dev dependencies (core)

`@tailwindcss/turbopack`, `tailwindcss` ^4, `typescript`, `eslint` + `eslint-config-next`, `drizzle-kit`, `dotenv`, `@types/*`.

## next.config.ts

```ts
cacheComponents: true,
partialPrefetching: true,
turbopack: {
  rules: {
    "*.css": {
      loaders: ["@tailwindcss/turbopack"],
      as: "*.css",
    },
  },
},
```

Keep `@tailwindcss/turbopack` installed while that rule exists.

## TypeScript

`tsconfig.json`: `strict`, `moduleResolution: bundler`, `jsx: react-jsx`, paths `@/*` → `./*`.  
`next-env.d.ts` is gitignored / generated — do not hand-edit.

## Root layout

- Fonts: Comfortaa (`--font-comfortaa` / sans), Source Serif 4 (`--font-source-serif` / display titles).
- Metadata title `Friday`, description personal finance.
- `CurrencyBackground` behind content (`z-10` wrapper for pages).

## globals.css

- Neon tokens: `--neon-green` `#39ff14`, `--neon-orange` `#ff6b00`, surfaces, glass mixes.
- `.glass-panel` / `.glass-panel-strong` for frosted panels.
- `.friday-scroll-hide` for native scrollbar suppression inside `ScrollArea`.
- Page `html` scrollbar themed best-effort.

## Shared UI classes (`lib/ui-classes.ts`)

`INPUT_CLASS`, `BTN_*`, `GLASS_PANEL_CLASS`, `TABLE_WRAP_CLASS`, `TABLE_CLASS`, `TH_*`, `TD_CLASS`. Prefer these over one-off duplicates.

## pnpm allowBuilds

`pnpm-workspace.yaml` may allow `unrs-resolver` builds for the ESLint toolchain. Do not widen `allowBuilds` without asking.

## Files agents should not treat as source of truth for product docs

| Path | Role |
| --- | --- |
| `pnpm-lock.yaml` | Lockfile via pnpm only |
| `.nvmrc` | `24` |
| `.gitignore` | Ignores `node_modules`, `.next`, `.env*`, etc. |
| `AGENTS.md` | Regenerated Next agent rules |
| `README.md` | Human onboarding — keep in sync when setup/stack changes |

## What exists

Compose, boot scripts, Drizzle schema, full App Router product UI. See `friday-runtime` and `friday-architecture`.
