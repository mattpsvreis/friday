"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CategoryPill } from "@/components/category-pill";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { PageHeading } from "@/components/page-heading";
import { SortableTh } from "@/components/sortable-th";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { splitTotalAcrossInstallments } from "@/lib/purchases";
import { apiFetch } from "@/lib/session-client";
import {
  BTN_DANGER_CLASS,
  BTN_LINK_CLASS,
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

type PurchaseRow = {
  id: string;
  creditCardId: string;
  categoryId: string | null;
  merchant: string;
  purchaseDate: string;
  totalCents: number;
  installmentCount: number;
  status: string;
  installments: {
    id: string;
    number: number;
    ofTotal: number;
    amountCents: number;
    cycleCloseDate: string;
  }[];
};

const METHODS = [
  "pix",
  "cash",
  "credit_card",
  "other",
  "transfer",
  "card_payment",
] as const;

const EMPTY_PURCHASE = {
  creditCardId: "",
  description: "",
  purchaseDate: "",
  installmentCount: "1",
  totalAmount: "",
  categoryId: "",
};

function centsToBrlInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default function ExpensesPage() {
  const today = useTodayIso();
  const confirmDelete = useConfirmDelete<LedgerEntry>();
  const confirmDeletePurchase = useConfirmDelete<PurchaseRow>();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<PurchaseRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editPurchaseId, setEditPurchaseId] = useState<string | null>(null);

  const [expense, setExpense] = useState({
    amount: "",
    occursOn: "",
    description: "",
    method: "pix" as (typeof METHODS)[number],
    categoryId: "",
    creditCardId: "",
  });

  const [purchase, setPurchase] = useState(EMPTY_PURCHASE);

  const expenseCategories = useMemo(
    () =>
      categories
        .filter((c) => c.kind === "expense")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const purchaseParcelHint = useMemo(() => {
    const totalCents = parseBrlInput(purchase.totalAmount);
    const count = Number(purchase.installmentCount);
    if (totalCents <= 0 || !Number.isInteger(count) || count < 1) return null;
    const amounts = splitTotalAcrossInstallments(totalCents, count);
    return {
      perCents: amounts[0] ?? 0,
      count,
    };
  }, [purchase.totalAmount, purchase.installmentCount]);

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

  const cardById = useMemo(() => {
    const map = new Map<string, Card>();
    for (const c of cards) map.set(c.id, c);
    return map;
  }, [cards]);

  function refreshLedger() {
    return Promise.all([
      apiFetch("/api/ledger?direction=expense"),
      apiFetch("/api/purchases"),
      apiFetch("/api/categories"),
      apiFetch("/api/cards"),
    ])
      .then(async ([ledgerRes, purchaseRes, catRes, cardRes]) => {
        const ledgerJson = (await ledgerRes.json()) as LedgerEntry[] | { error?: string };
        const purchaseJson = (await purchaseRes.json()) as
          | PurchaseRow[]
          | { error?: string };
        const catJson = (await catRes.json()) as Category[];
        const cardJson = (await cardRes.json()) as Card[];
        if (!ledgerRes.ok) {
          setError((ledgerJson as { error?: string }).error ?? "Failed to load ledger");
          return;
        }
        if (!purchaseRes.ok) {
          setError(
            (purchaseJson as { error?: string }).error ?? "Failed to load purchases",
          );
          return;
        }
        setEntries(ledgerJson as LedgerEntry[]);
        setPurchaseRows(purchaseJson as PurchaseRow[]);
        setCategories(catJson);
        setCards(cardJson);
      })
      .catch(() => setError("Failed to load expenses"));
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

  async function deletePurchase(row: PurchaseRow) {
    setError(null);
    const res = await apiFetch(
      `/api/purchases?id=${encodeURIComponent(row.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Delete failed");
      throw new Error(json.error ?? "Delete failed");
    }
    setPurchaseRows((prev) => prev.filter((p) => p.id !== row.id));
    if (editPurchaseId === row.id) resetPurchaseForm();
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

  function resetPurchaseForm() {
    setEditPurchaseId(null);
    setPurchase({
      ...EMPTY_PURCHASE,
      purchaseDate: today ?? "",
    });
  }

  function startEditPurchase(row: PurchaseRow) {
    setEditPurchaseId(row.id);
    setPurchase({
      creditCardId: row.creditCardId,
      description: row.merchant,
      purchaseDate: row.purchaseDate,
      installmentCount: String(row.installmentCount),
      totalAmount: centsToBrlInput(row.totalCents),
      categoryId: row.categoryId ?? "",
    });
    setError(null);
  }

  async function onSavePurchase(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      creditCardId: purchase.creditCardId,
      description: purchase.description,
      purchaseDate: purchase.purchaseDate,
      installmentCount: Number(purchase.installmentCount),
      totalCents: parseBrlInput(purchase.totalAmount),
      categoryId: purchase.categoryId || null,
      ...(editPurchaseId ? { id: editPurchaseId } : {}),
    };
    const res = await apiFetch("/api/purchases", {
      method: editPurchaseId ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(
        json.error ??
          (editPurchaseId
            ? "Could not update purchase"
            : "Could not add purchase"),
      );
      return;
    }
    resetPurchaseForm();
    void refreshLedger();
  }

  return (
    <div>
      <PageHeading
        title="Expenses"
        description="Manual cash expenses and installment purchases on credit cards."
      />

      <div className="mb-10 grid gap-8 lg:grid-cols-2">
        <form onSubmit={onAddExpense} className="space-y-3 border border-border glass-panel p-4">
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

        <form onSubmit={onSavePurchase} className="space-y-3 border border-border glass-panel p-4">
          <h2 className="text-sm uppercase tracking-wide text-neon-orange">
            {editPurchaseId ? "Edit installment purchase" : "Installment purchase"}
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
          <label className="block space-y-1">
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
          <label className="block space-y-1">
            <span className="text-sm text-muted">Total amount (BRL)</span>
            <input
              className={INPUT_CLASS}
              value={purchase.totalAmount}
              onChange={(e) =>
                setPurchase({ ...purchase, totalAmount: e.target.value })
              }
              required
              inputMode="decimal"
            />
            {purchaseParcelHint ? (
              <span className="block text-xs text-muted">
                {purchaseParcelHint.count}× of{" "}
                {formatBrl(purchaseParcelHint.perCents)}
                {purchaseParcelHint.count > 1
                  ? " (last parcel may differ by a few centavos)"
                  : ""}
              </span>
            ) : null}
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
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={BTN_PRIMARY_CLASS}>
              {editPurchaseId ? "Update purchase" : "Add purchase"}
            </button>
            {editPurchaseId ? (
              <button
                type="button"
                className={BTN_LINK_CLASS}
                onClick={resetPurchaseForm}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {error ? <p className="mb-4 text-sm text-neon-orange">{error}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <h2 className="mb-3 text-sm uppercase tracking-wide text-muted">
            Card purchases
          </h2>
          {purchaseRows.length === 0 ? (
            <p className="mb-8 text-muted">No card purchases yet.</p>
          ) : (
            <div className={`${TABLE_WRAP_CLASS} mb-10`}>
              <table className={TABLE_CLASS}>
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Date</th>
                    <th className={TH_CLASS}>Description</th>
                    <th className={TH_CLASS}>Category</th>
                    <th className={TH_CLASS}>Card</th>
                    <th className={TH_CLASS}>Parcels</th>
                    <th className={`${TH_CLASS} text-right`}>Total</th>
                    <th className={`${TH_CLASS} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...purchaseRows]
                    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))
                    .map((row) => {
                      const category = row.categoryId
                        ? categoryById.get(row.categoryId)
                        : undefined;
                      const card = cardById.get(row.creditCardId);
                      const first = row.installments[0];
                      const parcelLabel =
                        row.installmentCount > 1
                          ? `${row.installmentCount}× ${formatBrl(first?.amountCents ?? 0)}`
                          : "1×";
                      return (
                        <tr key={row.id}>
                          <td className={`${TD_CLASS} whitespace-nowrap text-muted`}>
                            {row.purchaseDate}
                          </td>
                          <td className={TD_CLASS}>{row.merchant}</td>
                          <td className={TD_CLASS}>
                            {category ? (
                              <CategoryPill
                                name={category.name}
                                color={category.color}
                              />
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className={`${TD_CLASS} text-muted`}>
                            {card?.label ?? "—"}
                          </td>
                          <td className={`${TD_CLASS} text-muted`}>{parcelLabel}</td>
                          <td
                            className={`${TD_CLASS} text-right tabular-nums text-neon-orange`}
                          >
                            {formatBrl(row.totalCents)}
                          </td>
                          <td className={`${TD_CLASS} text-right`}>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className={BTN_LINK_CLASS}
                                onClick={() => startEditPurchase(row)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={BTN_DANGER_CLASS}
                                onClick={() =>
                                  confirmDeletePurchase.requestDelete(
                                    row,
                                    "Delete card purchase",
                                    `${row.merchant} · ${row.purchaseDate} · ${formatBrl(row.totalCents)}`,
                                  )
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="mb-3 text-sm uppercase tracking-wide text-muted">
            Cash ledger
          </h2>
          {entries.length === 0 ? (
            <p className="text-muted">No cash expenses recorded.</p>
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
                            <CategoryPill
                              name={category.name}
                              color={category.color}
                            />
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className={`${TD_CLASS} uppercase text-muted`}>
                          {row.method}
                        </td>
                        <td className={TD_CLASS}>
                          {row.status !== "confirmed" ? (
                            <span className="text-neon-orange">{row.status}</span>
                          ) : (
                            <span className="text-muted">confirmed</span>
                          )}
                        </td>
                        <td
                          className={`${TD_CLASS} text-right tabular-nums text-neon-orange`}
                        >
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
        </>
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
      <ConfirmDeleteModal
        open={confirmDeletePurchase.open}
        title={confirmDeletePurchase.pending?.title ?? "Delete"}
        description={confirmDeletePurchase.pending?.description}
        step={confirmDeletePurchase.step}
        busy={confirmDeletePurchase.busy}
        onCancel={confirmDeletePurchase.cancel}
        onContinue={confirmDeletePurchase.continueToStep2}
        onConfirm={() => void confirmDeletePurchase.runConfirm(deletePurchase)}
      />
    </div>
  );
}
