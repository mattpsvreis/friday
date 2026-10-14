"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { apiFetch } from "@/lib/session-client";
import { BTN_PRIMARY_CLASS, INPUT_CLASS } from "@/lib/ui-classes";
import { useTodayIso } from "@/lib/use-today-iso";

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

type Category = { id: string; name: string; kind: string };
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
    merchant: "",
    purchaseDate: "",
    installmentCount: "1",
    amountPerInstallment: "",
    currentNumber: "1",
    currentCycleCloseDate: "",
    categoryId: "",
  });

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense"),
    [categories],
  );

  useEffect(() => {
    if (!today) return;
    setExpense((prev) =>
      prev.occursOn ? prev : { ...prev, occursOn: today },
    );
    setPurchase((prev) =>
      prev.purchaseDate
        ? prev
        : {
            ...prev,
            purchaseDate: today,
            currentCycleCloseDate: today,
          },
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
        setEntries(
          (ledgerJson as LedgerEntry[]).sort((a, b) =>
            b.occursOn.localeCompare(a.occursOn),
          ),
        );
        setCategories(catJson);
        setCards(cardJson);
      })
      .catch(() => setError("Failed to load ledger"));
  }

  useEffect(() => {
    refreshLedger().finally(() => setLoading(false));
  }, []);

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
      merchant: purchase.merchant,
      purchaseDate: purchase.purchaseDate,
      installmentCount: Number(purchase.installmentCount),
      amountPerInstallmentCents: parseBrlInput(purchase.amountPerInstallment),
      currentNumber: Number(purchase.currentNumber),
      currentCycleCloseDate: purchase.currentCycleCloseDate,
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
      merchant: "",
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
            <span className="text-sm text-muted">Merchant</span>
            <input
              className={INPUT_CLASS}
              value={purchase.merchant}
              onChange={(e) => setPurchase({ ...purchase, merchant: e.target.value })}
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
            <span className="text-sm text-muted">Current cycle close date</span>
            <input
              type="date"
              className={INPUT_CLASS}
              value={purchase.currentCycleCloseDate}
              onChange={(e) =>
                setPurchase({ ...purchase, currentCycleCloseDate: e.target.value })
              }
              required
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
        <ul className="divide-y divide-border border border-border text-sm">
          {entries.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <div>
                <span className="text-foreground">
                  {row.description || row.method}
                </span>
                <span className="ml-2 text-muted">{row.occursOn}</span>
                <span className="ml-2 text-xs uppercase text-muted">{row.method}</span>
                {row.status !== "confirmed" ? (
                  <span className="ml-2 text-xs text-neon-orange">{row.status}</span>
                ) : null}
              </div>
              <span className="tabular-nums text-neon-orange">
                {formatBrl(row.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
