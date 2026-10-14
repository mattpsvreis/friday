"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { apiFetch } from "@/lib/session-client";
import {
  BTN_DANGER_CLASS,
  BTN_LINK_CLASS,
  BTN_PRIMARY_CLASS,
  INPUT_CLASS,
} from "@/lib/ui-classes";

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

type Category = { id: string; name: string; kind: string };
type Card = { id: string; label: string };

export default function RecurringPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    direction: "expense" as "income" | "expense",
    amount: "",
    dayOfMonth: "1",
    method: "other",
    categoryId: "",
    creditCardId: "",
  });

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === form.direction),
    [categories, form.direction],
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch("/api/recurring", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        direction: form.direction,
        amountCents: parseBrlInput(form.amount),
        dayOfMonth: Number(form.dayOfMonth),
        method: form.method,
        categoryId: form.categoryId || null,
        creditCardId: form.creditCardId || null,
        enabled: true,
      }),
    });
    const json = (await res.json()) as Rule & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not create rule");
      return;
    }
    setRules((prev) => [...prev, json]);
    setForm((s) => ({ ...s, name: "", amount: "" }));
  }

  async function onDelete(id: string) {
    setError(null);
    const res = await apiFetch(`/api/recurring?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Delete failed");
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div>
      <PageHeading
        title="Recurring"
        description="Monthly rules materialized into the ledger."
      />

      <form
        onSubmit={onCreate}
        className="mb-8 grid max-w-2xl gap-3 border border-border p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm uppercase tracking-wide text-muted">
          New rule
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
        <div className="sm:col-span-2">
          <button type="submit" className={BTN_PRIMARY_CLASS}>
            Create rule
          </button>
        </div>
      </form>

      {error ? <p className="mb-4 text-sm text-neon-orange">{error}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-muted">No recurring rules.</p>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-foreground">{rule.name}</p>
                <p className="text-sm text-muted">
                  {rule.direction} · day {rule.dayOfMonth} · {rule.method} ·{" "}
                  <span
                    className={
                      rule.direction === "income" ? "text-neon-green" : "text-neon-orange"
                    }
                  >
                    {formatBrl(rule.amountCents)}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={[
                    BTN_LINK_CLASS,
                    rule.enabled ? "text-neon-green" : "text-muted line-through",
                  ].join(" ")}
                  onClick={() => void toggleEnabled(rule)}
                >
                  {rule.enabled ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  className={BTN_DANGER_CLASS}
                  onClick={() => void onDelete(rule.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
