"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { shiftYearMonth } from "@/lib/dates";
import { formatBrl } from "@/lib/money";
import { apiFetch } from "@/lib/session-client";
import { BTN_PRIMARY_CLASS, INPUT_CLASS } from "@/lib/ui-classes";

type DashboardData = {
  window: { start: string; end: string; year: number; month: number };
  spendableCents: number;
  savedCents: number;
  incomesCents: number;
  predicted: {
    totalCents: number;
    oneTimeCashCents: number;
    recurringCashCents: number;
    installmentsCents: number;
  };
  faturaPaymentsDueCents: number;
  expectedEndCents: number;
  cards: {
    id: string;
    label: string;
    bank: string;
    last4: string;
    limitCents: number;
    usedCents: number;
    availableCents: number;
  }[];
};

function monthInputValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "orange";
}) {
  return (
    <div className="border border-border px-4 py-3">
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
    </div>
  );
}

function SplitRow({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums text-foreground">{formatBrl(cents)}</span>
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

  if (year == null || month == null) {
    return <p className="text-muted">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-sm text-muted">Viewing month</span>
          <input
            type="month"
            className={INPUT_CLASS}
            value={monthInputValue(year, month)}
            onChange={(e) => {
              const value = e.target.value;
              if (!value) return;
              const [y, m] = value.split("-").map(Number);
              setYear(y);
              setMonth(m);
            }}
          />
        </label>
        <button
          type="button"
          className={BTN_PRIMARY_CLASS}
          onClick={() => shiftMonth(-1)}
        >
          Previous
        </button>
        <button
          type="button"
          className={BTN_PRIMARY_CLASS}
          onClick={() => shiftMonth(1)}
        >
          Next
        </button>
      </div>

      {loading ? <p className="text-muted">Loading dashboard…</p> : null}
      {error ? <p className="text-neon-orange">{error}</p> : null}

      {data && !loading ? (
        <>
          <p className="text-sm text-muted">
            Calendar month{" "}
            <span className="text-foreground">
              {data.window.start} → {data.window.end}
            </span>
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Spendable"
              value={formatBrl(data.spendableCents)}
              accent="green"
            />
            <Stat label="Saved" value={formatBrl(data.savedCents)} />
            <Stat
              label="Expected end (spendable)"
              value={formatBrl(data.expectedEndCents)}
              accent={data.expectedEndCents >= 0 ? "green" : "orange"}
            />
            <Stat
              label="Income (month)"
              value={formatBrl(data.incomesCents)}
              accent="green"
            />
          </div>

          <section className="border border-border">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-neon-orange">
                Predicted spend
              </h2>
              <p className="mt-1 font-[family-name:var(--font-source-serif)] text-xl tabular-nums">
                {formatBrl(data.predicted.totalCents)}
              </p>
            </div>
            <div className="divide-y divide-border px-4">
              <SplitRow
                label="One-time (cash)"
                cents={data.predicted.oneTimeCashCents}
              />
              <SplitRow
                label="Recurring (cash)"
                cents={data.predicted.recurringCashCents}
              />
              <SplitRow
                label="Card bill due (month)"
                cents={data.predicted.installmentsCents}
              />
            </div>
          </section>

          <section className="border border-border px-4 py-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
              Fatura payments due
            </h2>
            <p className="mt-1 font-[family-name:var(--font-source-serif)] text-xl tabular-nums text-neon-orange">
              {formatBrl(data.faturaPaymentsDueCents)}
            </p>
          </section>

          {data.cards.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
                Credit cards
              </h2>
              <div className="divide-y divide-border border border-border">
                {data.cards.map((card) => {
                  const pct =
                    card.limitCents > 0
                      ? Math.min(100, (card.usedCents / card.limitCents) * 100)
                      : 0;
                  return (
                    <div key={card.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <span className="text-foreground">{card.label}</span>
                          {card.bank || card.last4 ? (
                            <span className="ml-2 text-sm text-muted">
                              {[card.bank, card.last4 ? `•••• ${card.last4}` : ""]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-sm tabular-nums text-muted">
                          {formatBrl(card.usedCents)} / {formatBrl(card.limitCents)}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full bg-surface">
                        <div
                          className="h-full bg-neon-green/70 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm text-neon-green tabular-nums">
                        {formatBrl(card.availableCents)} available
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <p className="text-sm text-muted">No credit cards configured.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
