"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CategoryPill } from "@/components/category-pill";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { PageHeading } from "@/components/page-heading";
import { SortableTh } from "@/components/sortable-th";
import { formatBrl, parseBrlInput } from "@/lib/money";
import {
  paymentMethodLabel,
  paymentMethodSelectOptions,
  SELECTABLE_INCOME_METHODS,
} from "@/lib/payment-methods";
import { apiFetch } from "@/lib/session-client";
import {
  BTN_DANGER_CLASS,
  BTN_PRIMARY_CLASS,
  INPUT_CLASS,
  TABLE_CLASS,
  TABLE_WRAP_CLASS,
  TD_CLASS,
  TH_CLASS,
} from "@/lib/ui-classes";
import { useConfirmDelete } from "@/lib/use-confirm-delete";
import {
  cmpNumber,
  cmpText,
  useTableSort,
  type SortDir,
} from "@/lib/use-table-sort";
import { useTodayIso } from "@/lib/use-today-iso";

type IncomeSortKey =
  | "name"
  | "category"
  | "day"
  | "method"
  | "amount"
  | "status";

type LedgerEntry = {
  id: string;
  amountCents: number;
  occursOn: string;
  description: string;
  method: string;
  status: string;
  categoryId: string | null;
};

type Category = { id: string; name: string; kind: string; color: string };

export default function IncomePage() {
  const today = useTodayIso();
  const confirmDelete = useConfirmDelete<LedgerEntry>();
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
    () =>
      categories
        .filter((c) => c.kind === "income")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const compareIncome = useCallback(
    (a: LedgerEntry, b: LedgerEntry, key: IncomeSortKey, dir: SortDir) => {
      switch (key) {
        case "name":
          return cmpText(
            a.description || "Income",
            b.description || "Income",
            dir,
          );
        case "category":
          return cmpText(
            categoryById.get(a.categoryId ?? "")?.name ?? "",
            categoryById.get(b.categoryId ?? "")?.name ?? "",
            dir,
          );
        case "day":
          return cmpText(a.occursOn, b.occursOn, dir);
        case "method":
          return cmpText(
            paymentMethodLabel(a.method),
            paymentMethodLabel(b.method),
            dir,
          );
        case "amount":
          return cmpNumber(a.amountCents, b.amountCents, dir);
        case "status":
          return cmpText(a.status, b.status, dir);
        default:
          return 0;
      }
    },
    [categoryById],
  );

  const {
    sorted: sortedEntries,
    sortKey,
    sortDir,
    toggle,
  } = useTableSort<LedgerEntry, IncomeSortKey>(
    entries,
    "name",
    compareIncome,
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
        setEntries(ledgerJson as LedgerEntry[]);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function deleteLedgerEntry(entry: LedgerEntry) {
    setError(null);
    const res = await apiFetch(
      `/api/ledger?id=${encodeURIComponent(entry.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Delete failed");
      throw new Error(json.error ?? "Delete failed");
    }
    setEntries((prev) => prev.filter((row) => row.id !== entry.id));
  }

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

      <form onSubmit={onSubmit} className="mb-8 max-w-md space-y-3 border border-border glass-panel p-4">
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
            {paymentMethodSelectOptions(
              SELECTABLE_INCOME_METHODS,
              form.method,
            ).map((m) => (
              <option key={m} value={m}>
                {paymentMethodLabel(m)}
              </option>
            ))}
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
        <div className={TABLE_WRAP_CLASS}>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <SortableTh
                  label="Day"
                  column="day"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggle}
                />
                <SortableTh
                  label="Name"
                  column="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggle}
                />
                <SortableTh
                  label="Category"
                  column="category"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggle}
                />
                <SortableTh
                  label="Method"
                  column="method"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggle}
                />
                <SortableTh
                  label="Status"
                  column="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggle}
                />
                <SortableTh
                  label="Amount"
                  column="amount"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggle}
                  align="right"
                />
                <th className={`${TH_CLASS} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((row) => {
                const category = row.categoryId
                  ? categoryById.get(row.categoryId)
                  : undefined;
                return (
                <tr key={row.id}>
                  <td className={`${TD_CLASS} whitespace-nowrap text-muted`}>
                    {row.occursOn}
                  </td>
                  <td className={TD_CLASS}>{row.description || "Income"}</td>
                  <td className={TD_CLASS}>
                    {category ? (
                      <CategoryPill name={category.name} color={category.color} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className={`${TD_CLASS} text-muted`}>
                    {paymentMethodLabel(row.method)}
                  </td>
                  <td className={TD_CLASS}>
                    {row.status !== "confirmed" ? (
                      <span className="text-neon-orange">{row.status}</span>
                    ) : (
                      <span className="text-muted">confirmed</span>
                    )}
                  </td>
                  <td className={`${TD_CLASS} text-right tabular-nums text-neon-green`}>
                    {formatBrl(row.amountCents)}
                  </td>
                  <td className={`${TD_CLASS} text-right`}>
                    <button
                      type="button"
                      className={BTN_DANGER_CLASS}
                      onClick={() =>
                        confirmDelete.requestDelete(
                          row,
                          "Delete income",
                          `${row.description || "Income"} · ${row.occursOn} · ${formatBrl(row.amountCents)}`,
                        )
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDeleteModal
        open={confirmDelete.open}
        title={confirmDelete.pending?.title ?? "Delete"}
        description={confirmDelete.pending?.description}
        step={confirmDelete.step}
        busy={confirmDelete.busy}
        onCancel={confirmDelete.cancel}
        onContinue={confirmDelete.continueToStep2}
        onConfirm={() => void confirmDelete.runConfirm(deleteLedgerEntry)}
      />
    </div>
  );
}
