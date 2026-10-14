"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CategoryPill } from "@/components/category-pill";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { PageHeading } from "@/components/page-heading";
import { SortableTh } from "@/components/sortable-th";
import { formatBrl, parseBrlInput } from "@/lib/money";
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

type ExpenseSortKey =
  | "name"
  | "category"
  | "day"
  | "method"
  | "amount"
  | "status";

type LedgerEntry = {
  id: string;
  direction: "expense";
  method: string;
  amountCents: number;
  occursOn: string;
  description: string;
  status: string;
  categoryId: string | null;
  creditCardId: string | null;
};

type Category = { id: string; name: string; kind: string; color: string };
type Card = { id: string; label: string };

const METHODS = [
  "pix",
  "cash",
  "credit_card",
  "other",
  "transfer",
  "card_payment",
] as const;

export default function ExpensesPage() {
  const today = useTodayIso();
  const confirmDelete = useConfirmDelete<LedgerEntry>();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [expense, setExpense] = useState({
    amount: "",
    occursOn: "",
    description: "",
    method: "pix" as (typeof METHODS)[number],
    categoryId: "",
    creditCardId: "",
  });

  const [purchase, setPurchase] = useState({
    creditCardId: "",
    description: "",
    purchaseDate: "",
    installmentCount: "1",
    amountPerInstallment: "",
    currentNumber: "1",
    categoryId: "",
  });

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense"),
    [categories],
  );

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const compareExpenses = useCallback(
    (a: LedgerEntry, b: LedgerEntry, key: ExpenseSortKey, dir: SortDir) => {
      switch (key) {
        case "name":
          return cmpText(a.description || a.method, b.description || b.method, dir);
        case "category":
          return cmpText(
            categoryById.get(a.categoryId ?? "")?.name ?? "",
            categoryById.get(b.categoryId ?? "")?.name ?? "",
            dir,
          );
        case "day":
          return cmpText(a.occursOn, b.occursOn, dir);
        case "method":
          return cmpText(a.method, b.method, dir);
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
  } = useTableSort<LedgerEntry, ExpenseSortKey>(
    entries,
    "name",
    compareExpenses,
  );

  useEffect(() => {
    if (!today) return;
    setExpense((prev) =>
      prev.occursOn ? prev : { ...prev, occursOn: today },
    );
    setPurchase((prev) =>
      prev.purchaseDate ? prev : { ...prev, purchaseDate: today },
    );
  }, [today]);

  function refreshLedger() {
    return Promise.all([
      apiFetch("/api/ledger?direction=expense"),
      apiFetch("/api/categories"),
      apiFetch("/api/cards"),
    ])
      .then(async ([ledgerRes, catRes, cardRes]) => {
        const ledgerJson = (await ledgerRes.json()) as LedgerEntry[] | { error?: string };
        const catJson = (await catRes.json()) as Category[];
        const cardJson = (await cardRes.json()) as Card[];
        if (!ledgerRes.ok) {
          setError((ledgerJson as { error?: string }).error ?? "Failed to load ledger");
          return;
        }
        setEntries(ledgerJson as LedgerEntry[]);
        setCategories(catJson);
        setCards(cardJson);
      })
      .catch(() => setError("Failed to load ledger"));
  }

  useEffect(() => {
    refreshLedger().finally(() => setLoading(false));
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

  async function onAddExpense(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      direction: "expense" as const,
      method: expense.method,
      amountCents: parseBrlInput(expense.amount),
      occursOn: expense.occursOn,
      description: expense.description,
      categoryId: expense.categoryId || null,
      creditCardId:
        expense.method === "credit_card" && expense.creditCardId
          ? expense.creditCardId
          : null,
    };
    const res = await apiFetch("/api/ledger", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as LedgerEntry & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not add expense");
      return;
    }
    setEntries((prev) => [json, ...prev]);
    setExpense((s) => ({ ...s, amount: "", description: "" }));
  }

  async function onAddPurchase(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      creditCardId: purchase.creditCardId,
      description: purchase.description,
      purchaseDate: purchase.purchaseDate,
      installmentCount: Number(purchase.installmentCount),
      amountPerInstallmentCents: parseBrlInput(purchase.amountPerInstallment),
      currentNumber: Number(purchase.currentNumber),
      categoryId: purchase.categoryId || null,
      status: "confirmed" as const,
    };
    const res = await apiFetch("/api/purchases", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not add purchase");
      return;
    }
    setPurchase((s) => ({
      ...s,
      description: "",
      amountPerInstallment: "",
    }));
    void refreshLedger();
  }

  return (
    <div>
      <PageHeading
        title="Expenses"
        description="Manual cash expenses and installment purchases on credit cards."
      />

      <div className="mb-10 grid gap-8 lg:grid-cols-2">
        <form onSubmit={onAddExpense} className="space-y-3 border border-border p-4">
          <h2 className="text-sm uppercase tracking-wide text-neon-orange">
            Add expense
          </h2>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Amount (BRL)</span>
            <input
              className={INPUT_CLASS}
              value={expense.amount}
              onChange={(e) => setExpense({ ...expense, amount: e.target.value })}
              required
              inputMode="decimal"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Date</span>
            <input
              type="date"
              className={INPUT_CLASS}
              value={expense.occursOn}
              onChange={(e) => setExpense({ ...expense, occursOn: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Method</span>
            <select
              className={INPUT_CLASS}
              value={expense.method}
              onChange={(e) =>
                setExpense({
                  ...expense,
                  method: e.target.value as (typeof METHODS)[number],
                })
              }
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          {expense.method === "credit_card" ? (
            <label className="block space-y-1">
              <span className="text-sm text-muted">Card</span>
              <select
                className={INPUT_CLASS}
                value={expense.creditCardId}
                onChange={(e) =>
                  setExpense({ ...expense, creditCardId: e.target.value })
                }
              >
                <option value="">Select card</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block space-y-1">
            <span className="text-sm text-muted">Category</span>
            <select
              className={INPUT_CLASS}
              value={expense.categoryId}
              onChange={(e) => setExpense({ ...expense, categoryId: e.target.value })}
            >
              <option value="">None</option>
              {expenseCategories.map((c) => (
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
              value={expense.description}
              onChange={(e) => setExpense({ ...expense, description: e.target.value })}
            />
          </label>
          <button type="submit" className={BTN_PRIMARY_CLASS}>
            Add expense
          </button>
        </form>

        <form onSubmit={onAddPurchase} className="space-y-3 border border-border p-4">
          <h2 className="text-sm uppercase tracking-wide text-neon-orange">
            Installment purchase
          </h2>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Card</span>
            <select
              className={INPUT_CLASS}
              value={purchase.creditCardId}
              onChange={(e) =>
                setPurchase({ ...purchase, creditCardId: e.target.value })
              }
              required
            >
              <option value="">Select card</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Description</span>
            <input
              className={INPUT_CLASS}
              value={purchase.description}
              onChange={(e) =>
                setPurchase({ ...purchase, description: e.target.value })
              }
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Purchase date</span>
            <input
              type="date"
              className={INPUT_CLASS}
              value={purchase.purchaseDate}
              onChange={(e) =>
                setPurchase({ ...purchase, purchaseDate: e.target.value })
              }
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm text-muted">Installments</span>
              <input
                type="number"
                min={1}
                className={INPUT_CLASS}
                value={purchase.installmentCount}
                onChange={(e) =>
                  setPurchase({ ...purchase, installmentCount: e.target.value })
                }
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-muted">Current #</span>
              <input
                type="number"
                min={1}
                className={INPUT_CLASS}
                value={purchase.currentNumber}
                onChange={(e) =>
                  setPurchase({ ...purchase, currentNumber: e.target.value })
                }
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Amount per installment (BRL)</span>
            <input
              className={INPUT_CLASS}
              value={purchase.amountPerInstallment}
              onChange={(e) =>
                setPurchase({ ...purchase, amountPerInstallment: e.target.value })
              }
              required
              inputMode="decimal"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Category</span>
            <select
              className={INPUT_CLASS}
              value={purchase.categoryId}
              onChange={(e) =>
                setPurchase({ ...purchase, categoryId: e.target.value })
              }
            >
              <option value="">None</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={BTN_PRIMARY_CLASS}>
            Add purchase
          </button>
        </form>
      </div>

      {error ? <p className="mb-4 text-sm text-neon-orange">{error}</p> : null}

      <h2 className="mb-3 text-sm uppercase tracking-wide text-muted">Ledger</h2>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-muted">No expenses recorded.</p>
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
                  <td className={TD_CLASS}>{row.description || "—"}</td>
                  <td className={TD_CLASS}>
                    {category ? (
                      <CategoryPill name={category.name} color={category.color} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className={`${TD_CLASS} uppercase text-muted`}>{row.method}</td>
                  <td className={TD_CLASS}>
                    {row.status !== "confirmed" ? (
                      <span className="text-neon-orange">{row.status}</span>
                    ) : (
                      <span className="text-muted">confirmed</span>
                    )}
                  </td>
                  <td className={`${TD_CLASS} text-right tabular-nums text-neon-orange`}>
                    {formatBrl(row.amountCents)}
                  </td>
                  <td className={`${TD_CLASS} text-right`}>
                    <button
                      type="button"
                      className={BTN_DANGER_CLASS}
                      onClick={() =>
                        confirmDelete.requestDelete(
                          row,
                          "Delete expense",
                          `${row.description || row.method} · ${row.occursOn} · ${formatBrl(row.amountCents)}`,
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
