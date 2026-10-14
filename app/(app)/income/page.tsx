"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { apiFetch } from "@/lib/session-client";
import { BTN_PRIMARY_CLASS, INPUT_CLASS } from "@/lib/ui-classes";
import { useTodayIso } from "@/lib/use-today-iso";

type LedgerEntry = {
  id: string;
  amountCents: number;
  occursOn: string;
  description: string;
  method: string;
  status: string;
};

type Category = { id: string; name: string; kind: string };

export default function IncomePage() {
  const today = useTodayIso();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    amount: "",
    occursOn: "",
    description: "",
    method: "pix",
    categoryId: "",
  });

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.kind === "income"),
    [categories],
  );

  useEffect(() => {
    if (!today) return;
    setForm((prev) => (prev.occursOn ? prev : { ...prev, occursOn: today }));
  }, [today]);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/ledger?direction=income"),
      apiFetch("/api/categories"),
    ])
      .then(async ([ledgerRes, catRes]) => {
        const ledgerJson = (await ledgerRes.json()) as LedgerEntry[] | { error?: string };
        setCategories((await catRes.json()) as Category[]);
        if (!ledgerRes.ok) {
          setError((ledgerJson as { error?: string }).error ?? "Failed to load");
          return;
        }
        setEntries(
          (ledgerJson as LedgerEntry[]).sort((a, b) =>
            b.occursOn.localeCompare(a.occursOn),
          ),
        );
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch("/api/ledger", {
      method: "POST",
      body: JSON.stringify({
        direction: "income",
        method: form.method,
        amountCents: parseBrlInput(form.amount),
        occursOn: form.occursOn,
        description: form.description,
        categoryId: form.categoryId || null,
      }),
    });
    const json = (await res.json()) as LedgerEntry & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not add income");
      return;
    }
    setEntries((prev) => [json, ...prev]);
    setForm((s) => ({ ...s, amount: "", description: "" }));
  }

  return (
    <div>
      <PageHeading title="Income" description="Salary, refunds, and other inflows." />

      <form onSubmit={onSubmit} className="mb-8 max-w-md space-y-3 border border-border p-4">
        <label className="block space-y-1">
          <span className="text-sm text-muted">Amount (BRL)</span>
          <input
            className={INPUT_CLASS}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            inputMode="decimal"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Date</span>
          <input
            type="date"
            className={INPUT_CLASS}
            value={form.occursOn}
            onChange={(e) => setForm({ ...form, occursOn: e.target.value })}
            required
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Method</span>
          <select
            className={INPUT_CLASS}
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
          >
            <option value="pix">pix</option>
            <option value="transfer">transfer</option>
            <option value="cash">cash</option>
            <option value="other">other</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Category</span>
          <select
            className={INPUT_CLASS}
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <option value="">None</option>
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Description</span>
          <input
            className={INPUT_CLASS}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <button type="submit" className={BTN_PRIMARY_CLASS}>
          Add income
        </button>
      </form>

      {error ? <p className="mb-4 text-sm text-neon-orange">{error}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-muted">No income entries yet.</p>
      ) : (
        <ul className="divide-y divide-border border border-border text-sm">
          {entries.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
            >
              <div>
                <span className="text-foreground">
                  {row.description || "Income"}
                </span>
                <span className="ml-2 text-muted">{row.occursOn}</span>
              </div>
              <span className="tabular-nums text-neon-green">
                {formatBrl(row.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
