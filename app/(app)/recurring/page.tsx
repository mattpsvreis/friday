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

type RecurringSortKey =
  | "name"
  | "category"
  | "day"
  | "method"
  | "amount"
  | "status";

type Rule = {
  id: string;
  name: string;
  direction: "income" | "expense";
  amountCents: number;
  dayOfMonth: number;
  enabled: boolean;
  method: string;
  categoryId: string | null;
  creditCardId: string | null;
};

type Category = { id: string; name: string; kind: string; color: string };
type Card = { id: string; label: string };

const EMPTY_FORM = {
  name: "",
  direction: "expense" as "income" | "expense",
  amount: "",
  dayOfMonth: "1",
  method: "other",
  categoryId: "",
  creditCardId: "",
};

function centsToBrlInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default function RecurringPage() {
  const confirmDelete = useConfirmDelete<Rule>();
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === form.direction),
    [categories, form.direction],
  );

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const compareRules = useCallback(
    (a: Rule, b: Rule, key: RecurringSortKey, dir: SortDir) => {
      switch (key) {
        case "name":
          return cmpText(a.name, b.name, dir);
        case "category":
          return cmpText(
            categoryById.get(a.categoryId ?? "")?.name ?? "",
            categoryById.get(b.categoryId ?? "")?.name ?? "",
            dir,
          );
        case "day":
          return cmpNumber(a.dayOfMonth, b.dayOfMonth, dir);
        case "method":
          return cmpText(a.method, b.method, dir);
        case "amount":
          return cmpNumber(a.amountCents, b.amountCents, dir);
        case "status":
          return cmpNumber(Number(a.enabled), Number(b.enabled), dir);
        default:
          return 0;
      }
    },
    [categoryById],
  );

  const {
    sorted: sortedRules,
    sortKey,
    sortDir,
    toggle,
  } = useTableSort<Rule, RecurringSortKey>(rules, "name", compareRules);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/recurring"),
      apiFetch("/api/categories"),
      apiFetch("/api/cards"),
    ])
      .then(async ([rulesRes, catRes, cardRes]) => {
        const rulesJson = (await rulesRes.json()) as Rule[] | { error?: string };
        setCategories((await catRes.json()) as Category[]);
        setCards((await cardRes.json()) as Card[]);
        if (!rulesRes.ok) {
          setError((rulesJson as { error?: string }).error ?? "Failed to load");
          return;
        }
        setRules(rulesJson as Rule[]);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(rule: Rule) {
    setEditId(rule.id);
    setForm({
      name: rule.name,
      direction: rule.direction,
      amount: centsToBrlInput(rule.amountCents),
      dayOfMonth: String(rule.dayOfMonth),
      method: rule.method,
      categoryId: rule.categoryId ?? "",
      creditCardId: rule.creditCardId ?? "",
    });
    setError(null);
  }

  async function toggleEnabled(rule: Rule) {
    setError(null);
    const res = await apiFetch("/api/recurring", {
      method: "PUT",
      body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
    });
    const json = (await res.json()) as Rule & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Update failed");
      return;
    }
    setRules((prev) => prev.map((r) => (r.id === rule.id ? json : r)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      name: form.name,
      direction: form.direction,
      amountCents: parseBrlInput(form.amount),
      dayOfMonth: Number(form.dayOfMonth),
      method: form.method,
      categoryId: form.categoryId || null,
      creditCardId:
        form.method === "credit_card" && form.creditCardId
          ? form.creditCardId
          : null,
    };

    if (editId) {
      const res = await apiFetch("/api/recurring", {
        method: "PUT",
        body: JSON.stringify({ id: editId, ...payload }),
      });
      const json = (await res.json()) as Rule & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not update rule");
        return;
      }
      setRules((prev) => prev.map((r) => (r.id === editId ? json : r)));
      resetForm();
      return;
    }

    const res = await apiFetch("/api/recurring", {
      method: "POST",
      body: JSON.stringify({ ...payload, enabled: true }),
    });
    const json = (await res.json()) as Rule & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not create rule");
      return;
    }
    setRules((prev) => [...prev, json]);
    resetForm();
  }

  async function deleteRule(rule: Rule) {
    setError(null);
    const res = await apiFetch(
      `/api/recurring?id=${encodeURIComponent(rule.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Delete failed");
      throw new Error(json.error ?? "Delete failed");
    }
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    if (editId === rule.id) resetForm();
  }

  return (
    <div>
      <PageHeading
        title="Recurring"
        description="Templates summed on the Dashboard. They do not create ledger rows."
      />

      <form
        onSubmit={onSubmit}
        className="mb-8 grid max-w-2xl gap-3 border border-border p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm uppercase tracking-wide text-muted">
          {editId ? "Edit rule" : "New rule"}
        </h2>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm text-muted">Name</span>
          <input
            className={INPUT_CLASS}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Direction</span>
          <select
            className={INPUT_CLASS}
            value={form.direction}
            onChange={(e) =>
              setForm({
                ...form,
                direction: e.target.value as "income" | "expense",
                categoryId: "",
              })
            }
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Day of month</span>
          <input
            type="number"
            min={1}
            max={31}
            className={INPUT_CLASS}
            value={form.dayOfMonth}
            onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Amount (BRL)</span>
          <input
            className={INPUT_CLASS}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            inputMode="decimal"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Method</span>
          <select
            className={INPUT_CLASS}
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
          >
            <option value="pix">pix</option>
            <option value="cash">cash</option>
            <option value="credit_card">credit_card</option>
            <option value="transfer">transfer</option>
            <option value="card_payment">card_payment</option>
            <option value="other">other</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Category</span>
          <select
            className={INPUT_CLASS}
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <option value="">None</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {form.method === "credit_card" ? (
          <label className="space-y-1">
            <span className="text-sm text-muted">Card</span>
            <select
              className={INPUT_CLASS}
              value={form.creditCardId}
              onChange={(e) => setForm({ ...form, creditCardId: e.target.value })}
            >
              <option value="">None</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <button type="submit" className={BTN_PRIMARY_CLASS}>
            {editId ? "Update rule" : "Create rule"}
          </button>
          {editId ? (
            <button type="button" className={BTN_LINK_CLASS} onClick={resetForm}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {error ? <p className="mb-4 text-sm text-neon-orange">{error}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-muted">No recurring rules.</p>
      ) : (
        <div className={TABLE_WRAP_CLASS}>
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
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
                <th className={TH_CLASS}>Direction</th>
                <SortableTh
                  label="Day"
                  column="day"
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
                  label="Amount"
                  column="amount"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggle}
                  align="right"
                />
                <SortableTh
                  label="Status"
                  column="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggle}
                />
                <th className={`${TH_CLASS} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRules.map((rule) => {
                const category = rule.categoryId
                  ? categoryById.get(rule.categoryId)
                  : undefined;
                return (
                <tr key={rule.id}>
                  <td className={TD_CLASS}>{rule.name}</td>
                  <td className={TD_CLASS}>
                    {category ? (
                      <CategoryPill name={category.name} color={category.color} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className={`${TD_CLASS} capitalize text-muted`}>
                    {rule.direction}
                  </td>
                  <td className={`${TD_CLASS} tabular-nums text-muted`}>
                    {rule.dayOfMonth}
                  </td>
                  <td className={`${TD_CLASS} uppercase text-muted`}>{rule.method}</td>
                  <td
                    className={[
                      TD_CLASS,
                      "text-right tabular-nums",
                      rule.direction === "income"
                        ? "text-neon-green"
                        : "text-neon-orange",
                    ].join(" ")}
                  >
                    {formatBrl(rule.amountCents)}
                  </td>
                  <td className={TD_CLASS}>
                    <button
                      type="button"
                      className={[
                        "text-sm transition-colors hover:underline disabled:opacity-50",
                        rule.enabled
                          ? "text-neon-green"
                          : "text-red-400 line-through hover:text-red-300",
                      ].join(" ")}
                      onClick={() => void toggleEnabled(rule)}
                    >
                      {rule.enabled ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td className={`${TD_CLASS} text-right`}>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        className={BTN_LINK_CLASS}
                        onClick={() => startEdit(rule)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={BTN_DANGER_CLASS}
                        onClick={() =>
                          confirmDelete.requestDelete(
                            rule,
                            "Delete recurring rule",
                            `${rule.name} · ${formatBrl(rule.amountCents)}`,
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

      <ConfirmDeleteModal
        open={confirmDelete.open}
        title={confirmDelete.pending?.title ?? "Delete"}
        description={confirmDelete.pending?.description}
        step={confirmDelete.step}
        busy={confirmDelete.busy}
        onCancel={confirmDelete.cancel}
        onContinue={confirmDelete.continueToStep2}
        onConfirm={() => void confirmDelete.runConfirm(deleteRule)}
      />
    </div>
  );
}
