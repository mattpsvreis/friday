"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChartLine,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CategoryPill } from "@/components/category-pill";
import { StatusPill } from "@/components/status-pill";
import { shiftYearMonth } from "@/lib/dates";
import { formatBrl } from "@/lib/money";
import { apiFetch } from "@/lib/session-client";
import { BTN_LINK_CLASS, INPUT_CLASS } from "@/lib/ui-classes";

type CategorySlice = {
  categoryId: string | null;
  name: string;
  color: string;
  cents: number;
};

type MonthSeriesPoint = {
  year: number;
  month: number;
  label: string;
  incomeCents: number;
  expenseCents: number;
  byCategory: CategorySlice[];
};

type RecentTx = {
  id: string;
  kind: "ledger" | "purchase";
  date: string;
  name: string;
  direction: "income" | "expense";
  method: string;
  amountCents: number;
  perMonthCents: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  cardLabel: string | null;
};

type RecurringItem = {
  id: string;
  name: string;
  direction: "income" | "expense";
  amountCents: number;
  dayOfMonth: number;
  enabled: boolean;
  method: string;
  categoryName: string | null;
  categoryColor: string | null;
};

type ExpenseBreakdown = {
  totalCents: number;
  oneTimeCashCents: number;
  recurringCashCents: number;
  installmentsCents: number;
};

type DashboardData = {
  window: { start: string; end: string; year: number; month: number };
  spendableCents: number;
  savedCents: number;
  incomesCents: number;
  expenseCents: number;
  expectedEndCents: number;
  predicted: ExpenseBreakdown;
  byCategory: CategorySlice[];
  series: MonthSeriesPoint[];
  recentTransactions: RecentTx[];
  recurrings: RecurringItem[];
};

function monthInputValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthTitle(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Chart Y values are in reais (not centavos). */
function brlAxis(reais: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(reais);
}

const CHART_TOOLTIP = {
  wrapperStyle: { zIndex: 40, outline: "none" } as const,
  contentStyle: {
    background: "#121212",
    border: "1px solid color-mix(in srgb, #39ff14 28%, transparent)",
    position: "relative" as const,
    zIndex: 40,
  },
  formatter: (value: number | string | ReadonlyArray<number | string> | undefined) =>
    formatBrl(Math.round(Number(value) * 100)),
};

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "green" | "orange";
  hint?: string;
}) {
  const iconColor =
    accent === "green"
      ? "text-neon-green"
      : accent === "orange"
        ? "text-neon-orange"
        : "text-muted";

  return (
    <div className="flex items-center gap-4 border border-border glass-panel px-4 py-3">
      <Icon
        className={["size-10 shrink-0", iconColor].join(" ")}
        strokeWidth={1.5}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <p
          className={[
            "mt-1 font-[family-name:var(--font-source-serif)] text-2xl tabular-nums",
            accent === "green"
              ? "text-neon-green"
              : accent === "orange"
                ? "text-neon-orange"
                : "text-foreground",
          ].join(" ")}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

function Panel({
  title,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col border border-border glass-panel">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          {title}
        </h2>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className={BTN_LINK_CLASS}>
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

function ExpenseMixPanel({
  recurringCents,
  oneTimeCents,
  installmentsCents,
  totalCents,
}: {
  recurringCents: number;
  oneTimeCents: number;
  installmentsCents: number;
  totalCents: number;
}) {
  const mix = [
    {
      key: "recurring",
      label: "Recurring",
      hint: "ON cash + card (card uses due−1)",
      cents: recurringCents,
      color: "#39ff14",
    },
    {
      key: "oneTime",
      label: "One-timers",
      hint: "Cash ledger expenses",
      cents: oneTimeCents,
      color: "#ff6b00",
    },
    {
      key: "installments",
      label: "Installments",
      hint: "Parcels budgeted here (paid next month)",
      cents: installmentsCents,
      color: "#7dd3fc",
    },
  ];
  const total =
    totalCents || mix.reduce((sum, row) => sum + row.cents, 0);

  return (
    <div className="flex h-72 flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex h-3 overflow-hidden border border-border bg-background/50">
          {mix.map((row) => {
            const width =
              total > 0 ? Math.max(0, (row.cents / total) * 100) : 0;
            if (width <= 0) return null;
            return (
              <div
                key={row.key}
                className="h-full"
                style={{
                  width: `${width}%`,
                  backgroundColor: row.color,
                }}
                title={`${row.label}: ${formatBrl(row.cents)}`}
              />
            );
          })}
        </div>
        <ul className="space-y-3 text-sm">
          {mix.map((row) => {
            const pct =
              total > 0 ? Math.round((row.cents / total) * 100) : 0;
            return (
              <li
                key={row.key}
                className="flex items-start justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-foreground">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.label}
                  </span>
                  <span className="mt-0.5 block pl-4 text-xs text-muted">
                    {row.hint}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="text-neon-orange">
                    {formatBrl(row.cents)}
                  </span>
                  <span className="block text-xs text-muted">{pct}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex items-baseline justify-between border-t border-border pt-3 text-sm">
        <span className="uppercase tracking-wide text-muted">Total</span>
        <span className="tabular-nums text-neon-orange">
          {formatBrl(total)}
        </span>
      </div>
    </div>
  );
}

export function DashboardView() {
  const pathname = usePathname();
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setYear(now.getUTCFullYear());
    setMonth(now.getUTCMonth() + 1);
  }, []);

  useEffect(() => {
    if (year == null || month == null) return;
    let cancelled = false;

    async function load(showLoading: boolean) {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(
          `/api/dashboard?year=${year}&month=${month}`,
        );
        const json = (await res.json()) as DashboardData & { error?: string };
        if (!res.ok) {
          throw new Error(json.error ?? "Failed to load dashboard");
        }
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load dashboard");
        }
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    }

    void load(true);

    function onVisible() {
      if (document.visibilityState === "visible") void load(false);
    }
    function onFocus() {
      void load(false);
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [year, month, pathname]);

  function shiftMonth(delta: number) {
    if (year == null || month == null) return;
    const next = shiftYearMonth(year, month - 1, delta);
    setYear(next.year);
    setMonth(next.monthIndex + 1);
  }

  async function toggleRecurring(rule: RecurringItem) {
    setTogglingId(rule.id);
    setError(null);
    try {
      const res = await apiFetch("/api/recurring", {
        method: "PUT",
        body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
      });
      const json = (await res.json()) as RecurringItem & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Update failed");
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              recurrings: prev.recurrings.map((r) =>
                r.id === rule.id ? { ...r, enabled: json.enabled } : r,
              ),
            }
          : prev,
      );
      // Reload so charts/KPIs pick up enabled changes
      if (year != null && month != null) {
        const dash = await apiFetch(
          `/api/dashboard?year=${year}&month=${month}`,
        );
        const body = (await dash.json()) as DashboardData;
        if (dash.ok) setData(body);
      }
    } finally {
      setTogglingId(null);
    }
  }

  const viewedLabel = useMemo(() => {
    if (!data) return null;
    return (
      data.series.find(
        (point) =>
          point.year === data.window.year && point.month === data.window.month,
      )?.label ?? null
    );
  }, [data]);

  const incomeExpenseChart = useMemo(
    () =>
      (data?.series ?? []).map((point) => ({
        label: point.label,
        income: point.incomeCents / 100,
        expense: point.expenseCents / 100,
        isViewedMonth:
          point.year === data?.window.year &&
          point.month === data?.window.month,
      })),
    [data],
  );

  const categoryKeys = useMemo(() => {
    const keys = new Map<string, { name: string; color: string }>();
    for (const point of data?.series ?? []) {
      for (const slice of point.byCategory) {
        const id = slice.categoryId ?? "__none__";
        if (!keys.has(id)) {
          keys.set(id, { name: slice.name, color: slice.color });
        }
      }
    }
    return [...keys.entries()].map(([id, meta]) => ({ id, ...meta }));
  }, [data]);

  const stackedChart = useMemo(() => {
    return (data?.series ?? []).map((point) => {
      const row: Record<string, string | number | boolean> = {
        label: point.label,
        isViewedMonth:
          point.year === data?.window.year &&
          point.month === data?.window.month,
      };
      for (const key of categoryKeys) {
        const slice = point.byCategory.find(
          (s) => (s.categoryId ?? "__none__") === key.id,
        );
        row[key.id] = (slice?.cents ?? 0) / 100;
      }
      return row;
    });
  }, [data, categoryKeys]);

  function MonthTick({
    x,
    y,
    payload,
  }: {
    x?: number;
    y?: number;
    payload?: { value?: string };
  }) {
    const active = Boolean(
      viewedLabel && payload?.value && payload.value === viewedLabel,
    );
    return (
      <text
        x={x}
        y={y}
        dy={12}
        textAnchor="middle"
        fontSize={active ? 12 : 11}
        fontWeight={active ? 700 : 400}
        fill={active ? "#39ff14" : "#8a8a8a"}
      >
        {payload?.value}
      </text>
    );
  }

  const donutData = useMemo(
    () =>
      (data?.byCategory ?? [])
        .filter((s) => s.cents > 0)
        .map((s) => ({
          name: s.name,
          value: s.cents / 100,
          color: s.color,
          cents: s.cents,
        })),
    [data],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-source-serif)] text-3xl tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            {year != null && month != null
              ? `Overview of your finances in ${monthTitle(year, month)}.`
              : "Overview of your finances."}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="month"
            className={`${INPUT_CLASS} w-auto`}
            value={
              year != null && month != null
                ? monthInputValue(year, month)
                : ""
            }
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              if (!y || !m) return;
              setYear(y);
              setMonth(m);
            }}
          />
          <button
            type="button"
            className="inline-flex h-10 w-9 items-center justify-center border border-border text-neon-green transition-colors hover:border-neon-green disabled:opacity-50"
            onClick={() => shiftMonth(-1)}
            disabled={year == null}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-9 items-center justify-center border border-border text-neon-green transition-colors hover:border-neon-green disabled:opacity-50"
            onClick={() => shiftMonth(1)}
            disabled={year == null}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-neon-orange">{error}</p> : null}
      {loading && !data ? <p className="text-muted">Loading…</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              label="Income"
              value={formatBrl(data.incomesCents)}
              icon={TrendingUp}
              accent="green"
              hint="this month"
            />
            <KpiCard
              label="Expense"
              value={formatBrl(data.expenseCents)}
              icon={TrendingDown}
              accent="orange"
              hint="this month"
            />
            <KpiCard
              label="Saved"
              value={formatBrl(data.savedCents)}
              icon={PiggyBank}
              hint="snapshot"
            />
            <KpiCard
              label="Spendable"
              value={formatBrl(data.spendableCents)}
              icon={Wallet}
              accent="green"
              hint="snapshot"
            />
            <KpiCard
              label="Expected End"
              value={formatBrl(data.expectedEndCents)}
              icon={ChartLine}
              accent={data.expectedEndCents >= 0 ? "green" : "orange"}
              hint="projected"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Income vs Expenses">
              <div className="relative z-0 h-64 overflow-visible">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeExpenseChart}>
                    <CartesianGrid stroke="color-mix(in srgb, #39ff14 12%, transparent)" />
                    <XAxis
                      dataKey="label"
                      stroke="#8a8a8a"
                      tick={<MonthTick />}
                      interval={0}
                    />
                    <YAxis
                      stroke="#8a8a8a"
                      fontSize={11}
                      width={72}
                      tickFormatter={(v: number) => brlAxis(v)}
                    />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Legend wrapperStyle={{ position: "relative", zIndex: 0 }} />
                    <Bar dataKey="income" name="Income" fill="#39ff14" />
                    <Bar dataKey="expense" name="Expense" fill="#ff6b00" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Spending by Category">
              {donutData.length === 0 ? (
                <p className="text-sm text-muted">No categorized spend this month.</p>
              ) : (
                <div className="flex h-64 flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative h-48 w-full sm:h-full sm:w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="55%"
                          outerRadius="80%"
                          paddingAngle={2}
                        >
                          {donutData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip {...CHART_TOOLTIP} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-xs uppercase text-muted">Total</p>
                        <p className="text-sm tabular-nums text-neon-orange">
                          {formatBrl(data.expenseCents)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <ul className="max-h-48 flex-1 space-y-2 overflow-y-auto text-sm">
                    {donutData.map((entry) => {
                      const pct =
                        data.expenseCents > 0
                          ? Math.round(
                              (entry.cents / data.expenseCents) * 100,
                            )
                          : 0;
                      return (
                        <li
                          key={entry.name}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="flex items-center gap-2 text-muted">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            {entry.name}
                          </span>
                          <span className="tabular-nums">
                            <span className="text-neon-orange">
                              {formatBrl(entry.cents)}
                            </span>
                            <span className="text-muted"> · {pct}%</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Expenses by Category (−3 … +3 months)">
              <div className="relative z-0 h-72 overflow-visible">
                {categoryKeys.length === 0 ? (
                  <p className="text-sm text-muted">
                    No category spend in this window.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stackedChart}>
                      <CartesianGrid stroke="color-mix(in srgb, #39ff14 12%, transparent)" />
                      <XAxis
                        dataKey="label"
                        stroke="#8a8a8a"
                        tick={<MonthTick />}
                        interval={0}
                      />
                      <YAxis
                        stroke="#8a8a8a"
                        fontSize={11}
                        width={72}
                        tickFormatter={(v: number) => brlAxis(v)}
                      />
                      <Tooltip {...CHART_TOOLTIP} />
                      <Legend
                        wrapperStyle={{ position: "relative", zIndex: 0 }}
                      />
                      {categoryKeys.map((key) => (
                        <Bar
                          key={key.id}
                          dataKey={key.id}
                          name={key.name}
                          stackId="expense"
                          fill={key.color}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            <Panel title="Expense mix (this month)">
              <ExpenseMixPanel
                recurringCents={data.predicted?.recurringCashCents ?? 0}
                oneTimeCents={data.predicted?.oneTimeCashCents ?? 0}
                installmentsCents={data.predicted?.installmentsCents ?? 0}
                totalCents={
                  data.predicted?.totalCents ?? data.expenseCents
                }
              />
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Recent Transactions"
              actionHref="/transactions"
              actionLabel="View all"
            >
              {data.recentTransactions.length === 0 ? (
                <p className="text-sm text-muted">No transactions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-muted">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Description</th>
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 text-right font-medium">Amount</th>
                        <th className="pb-2 text-right font-medium">Per Month</th>
                        <th className="pb-2 text-right font-medium">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentTransactions.map((tx) => (
                        <tr key={`${tx.kind}:${tx.id}`} className="border-t border-border">
                          <td className="py-2 whitespace-nowrap text-muted">
                            {tx.date}
                          </td>
                          <td className="py-2">{tx.name}</td>
                          <td className="py-2">
                            {tx.categoryName ? (
                              <CategoryPill
                                name={tx.categoryName}
                                color={tx.categoryColor}
                              />
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td
                            className={[
                              "py-2 text-right tabular-nums",
                              tx.direction === "income"
                                ? "text-neon-green"
                                : "text-neon-orange",
                            ].join(" ")}
                          >
                            {formatBrl(tx.amountCents)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-muted">
                            {tx.perMonthCents != null
                              ? formatBrl(tx.perMonthCents)
                              : "N/A"}
                          </td>
                          <td className="py-2 text-right uppercase text-muted">
                            {tx.cardLabel ?? tx.method}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel
              title="Recurrings"
              actionHref="/recurring"
              actionLabel="View all"
            >
              {data.recurrings.length === 0 ? (
                <p className="text-sm text-muted">No recurring rules.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.recurrings.slice(0, 8).map((rule) => (
                    <li
                      key={rule.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">
                          {rule.name}
                        </p>
                        <p className="text-xs text-muted">
                          Day {rule.dayOfMonth}
                          {rule.categoryName ? ` · ${rule.categoryName}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={[
                            "tabular-nums text-sm",
                            rule.direction === "income"
                              ? "text-neon-green"
                              : "text-neon-orange",
                          ].join(" ")}
                        >
                          {formatBrl(rule.amountCents)}
                        </span>
                        <StatusPill
                          enabled={rule.enabled}
                          busy={togglingId === rule.id}
                          onToggle={() => void toggleRecurring(rule)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
