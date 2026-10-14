"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BalancesEditor } from "@/components/balances-editor";
import { CategoryPill } from "@/components/category-pill";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { PageHeading } from "@/components/page-heading";
import { SortableTh } from "@/components/sortable-th";
import { formatBrl } from "@/lib/money";
import { apiFetch } from "@/lib/session-client";
import {
  BTN_DANGER_CLASS,
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

type Category = { id: string; name: string; kind: string; color: string };
type Card = { id: string; label: string };

type LedgerEntry = {
  id: string;
  direction: "income" | "expense";
  method: string;
  amountCents: number;
  occursOn: string;
  description: string;
  status: string;
  categoryId: string | null;
  creditCardId: string | null;
};

type PurchaseRow = {
  id: string;
  creditCardId: string;
  categoryId: string | null;
  merchant: string;
  purchaseDate: string;
  totalCents: number;
  installmentCount: number;
  status: string;
};

type TxKind = "ledger" | "purchase";

type TxRow = {
  key: string;
  kind: TxKind;
  id: string;
  date: string;
  name: string;
  categoryId: string | null;
  method: string;
  amountCents: number;
  direction: "income" | "expense";
  source: LedgerEntry | PurchaseRow;
};

type TxSortKey = "day" | "name" | "category" | "method" | "amount";

export default function TransactionsPage() {
  const confirmDelete = useConfirmDelete<TxRow>();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const cardById = useMemo(() => {
    const map = new Map<string, Card>();
    for (const c of cards) map.set(c.id, c);
    return map;
  }, [cards]);

  const rows = useMemo<TxRow[]>(() => {
    const fromLedger: TxRow[] = ledger.map((entry) => ({
      key: `ledger:${entry.id}`,
      kind: "ledger",
      id: entry.id,
      date: entry.occursOn,
      name: entry.description || entry.method,
      categoryId: entry.categoryId,
      method: entry.method,
      amountCents: entry.amountCents,
      direction: entry.direction,
      source: entry,
    }));
    const fromPurchases: TxRow[] = purchases.map((p) => ({
      key: `purchase:${p.id}`,
      kind: "purchase",
      id: p.id,
      date: p.purchaseDate,
      name: p.merchant,
      categoryId: p.categoryId,
      method: "credit_card",
      amountCents: p.totalCents,
      direction: "expense",
      source: p,
    }));
    return [...fromLedger, ...fromPurchases];
  }, [ledger, purchases]);

  const compareTx = useCallback(
    (a: TxRow, b: TxRow, key: TxSortKey, dir: SortDir) => {
      switch (key) {
        case "day":
          return cmpText(a.date, b.date, dir);
        case "name":
          return cmpText(a.name, b.name, dir);
        case "category":
          return cmpText(
            categoryById.get(a.categoryId ?? "")?.name ?? "",
            categoryById.get(b.categoryId ?? "")?.name ?? "",
            dir,
          );
        case "method":
          return cmpText(a.method, b.method, dir);
        case "amount":
          return cmpNumber(a.amountCents, b.amountCents, dir);
        default:
          return 0;
      }
    },
    [categoryById],
  );

  const {
    sorted,
    sortKey,
    sortDir,
    toggle,
  } = useTableSort<TxRow, TxSortKey>(rows, "day", compareTx, "desc");

  useEffect(() => {
    Promise.all([
      apiFetch("/api/ledger"),
      apiFetch("/api/purchases"),
      apiFetch("/api/categories"),
      apiFetch("/api/cards"),
    ])
      .then(async ([ledgerRes, purchaseRes, catRes, cardRes]) => {
        const ledgerJson = (await ledgerRes.json()) as
          | LedgerEntry[]
          | { error?: string };
        const purchaseJson = (await purchaseRes.json()) as
          | PurchaseRow[]
          | { error?: string };
        setCategories((await catRes.json()) as Category[]);
        setCards((await cardRes.json()) as Card[]);
        if (!ledgerRes.ok) {
          setError((ledgerJson as { error?: string }).error ?? "Failed to load");
          return;
        }
        if (!purchaseRes.ok) {
          setError(
            (purchaseJson as { error?: string }).error ?? "Failed to load",
          );
          return;
        }
        setLedger(ledgerJson as LedgerEntry[]);
        setPurchases(purchaseJson as PurchaseRow[]);
      })
      .catch(() => setError("Failed to load transactions"))
      .finally(() => setLoading(false));
  }, []);

  async function deleteRow(row: TxRow) {
    setError(null);
    if (row.kind === "ledger") {
      const res = await apiFetch(
        `/api/ledger?id=${encodeURIComponent(row.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Delete failed");
        throw new Error(json.error ?? "Delete failed");
      }
      setLedger((prev) => prev.filter((e) => e.id !== row.id));
      return;
    }
    const res = await apiFetch(
      `/api/purchases?id=${encodeURIComponent(row.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Delete failed");
      throw new Error(json.error ?? "Delete failed");
    }
    setPurchases((prev) => prev.filter((p) => p.id !== row.id));
  }

  return (
    <div>
      <PageHeading
        title="Transactions"
        description="Cash ledger and card purchases, plus your spendable/saved snapshot."
      />

      <div className="mb-8">
        <BalancesEditor />
      </div>

      {error ? <p className="mb-4 text-sm text-neon-orange">{error}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-muted">No transactions yet.</p>
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
                <th className={TH_CLASS}>Type</th>
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
              {sorted.map((row) => {
                const category = row.categoryId
                  ? categoryById.get(row.categoryId)
                  : undefined;
                const methodLabel =
                  row.kind === "purchase"
                    ? cardById.get(
                        (row.source as PurchaseRow).creditCardId,
                      )?.label ?? "credit_card"
                    : row.method;
                return (
                  <tr key={row.key}>
                    <td className={`${TD_CLASS} whitespace-nowrap text-muted`}>
                      {row.date}
                    </td>
                    <td className={TD_CLASS}>{row.name}</td>
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
                      {methodLabel}
                    </td>
                    <td className={`${TD_CLASS} capitalize text-muted`}>
                      {row.kind === "purchase" ? "Card" : row.direction}
                    </td>
                    <td
                      className={[
                        TD_CLASS,
                        "text-right tabular-nums",
                        row.direction === "income"
                          ? "text-neon-green"
                          : "text-neon-orange",
                      ].join(" ")}
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
                            row.kind === "purchase"
                              ? "Delete card purchase"
                              : "Delete transaction",
                            `${row.name} · ${row.date} · ${formatBrl(row.amountCents)}`,
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
        onConfirm={() => void confirmDelete.runConfirm(deleteRow)}
      />
    </div>
  );
}
