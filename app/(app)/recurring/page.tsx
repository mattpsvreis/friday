"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CategoryPill } from "@/components/category-pill";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { PageHeading } from "@/components/page-heading";
import { ScrollArea } from "@/components/scroll-area";
import { SortableTh } from "@/components/sortable-th";
import { StatusPill } from "@/components/status-pill";
import { formatBrl, parseBrlInput } from "@/lib/money";
import {
  paymentMethodLabel,
  paymentMethodSelectOptions,
  SELECTABLE_PAYMENT_METHODS,
} from "@/lib/payment-methods";
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

const UNCATEGORIZED_COLOR = "#5a5a5a";

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
    () =>
      categories
        .filter((c) => c.kind === form.direction)
        .sort((a, b) => a.name.localeCompare(b.name)),
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
          return cmpText(
            paymentMethodLabel(a.method),
            paymentMethodLabel(b.method),
            dir,
          );
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

  const expenseByCategory = useMemo(() => {
    const totals = new Map<
      string,
      { name: string; color: string; cents: number }
    >();
    for (const rule of rules) {
      if (!rule.enabled || rule.direction !== "expense") continue;
      const cat = rule.categoryId
        ? categoryById.get(rule.categoryId)
        : undefined;
      const key = cat?.id ?? "__none__";
      const existing = totals.get(key);
      if (existing) {
        existing.cents += rule.amountCents;
      } else {
        totals.set(key, {
          name: cat?.name ?? "Uncategorized",
          color: cat?.color ?? UNCATEGORIZED_COLOR,
          cents: rule.amountCents,
        });
      }
    }
    return [...totals.values()]
      .filter((s) => s.cents > 0)
      .sort((a, b) => b.cents - a.cents)
      .map((s) => ({
        name: s.name,
        color: s.color,
        cents: s.cents,
        value: s.cents / 100,
      }));
  }, [rules, categoryById]);

  const expenseTotalCents = useMemo(
    () => expenseByCategory.reduce((sum, s) => sum + s.cents, 0),
    [expenseByCategory],
  );

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

      <div className="mb-8 grid gap-4 xl:grid-cols-2">
      <form
        onSubmit={onSubmit}
        className="grid gap-3 border border-border glass-panel p-4 sm:grid-cols-2"
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
            {paymentMethodSelectOptions(
              SELECTABLE_PAYMENT_METHODS,
              form.method,
            ).map((m) => (
              <option key={m} value={m}>
                {paymentMethodLabel(m)}
              </option>
            ))}
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

      <section className="flex min-h-0 flex-col border border-border glass-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Expense by category
          </h2>
          <p className="mt-1 text-xs text-muted">ON expense templates only</p>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row lg:items-center">
          {expenseByCategory.length === 0 ? (
            <p className="text-sm text-muted">No ON expense rules yet.</p>
          ) : (
            <>
              <div className="relative mx-auto h-52 w-full max-w-[14rem] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByCategory}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="80%"
                      paddingAngle={2}
                    >
                      {expenseByCategory.map((entry) => (
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
                      {formatBrl(expenseTotalCents)}
                    </p>
                  </div>
                </div>
              </div>
              <ScrollArea className="max-h-52 flex-1 text-sm">
                <ul className="space-y-2 pr-3">
                  {expenseByCategory.map((entry) => {
                    const pct =
                      expenseTotalCents > 0
                        ? Math.round((entry.cents / expenseTotalCents) * 100)
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
              </ScrollArea>
            </>
          )}
        </div>
      </section>
      </div>

      {error ? <p className="mb-4 text-sm text-neon-orange">{error}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-muted">No recurring rules.</p>
      ) : (
        <ScrollArea orientation="horizontal" className={TABLE_WRAP_CLASS}>
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
                  <td className={`${TD_CLASS} text-muted`}>
                    {paymentMethodLabel(rule.method)}
                  </td>
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
                    <StatusPill
                      enabled={rule.enabled}
                      onToggle={() => void toggleEnabled(rule)}
                    />
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
        </ScrollArea>
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
