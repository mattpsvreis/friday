"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { apiFetch } from "@/lib/session-client";
import {
  BTN_DANGER_CLASS,
  BTN_LINK_CLASS,
  BTN_PRIMARY_CLASS,
  INPUT_CLASS,
} from "@/lib/ui-classes";

type Card = {
  id: string;
  label: string;
  bank: string;
  last4: string;
  limitCents: number;
  cycleCloseDay: number;
  paymentDueDay: number;
};

const emptyForm = {
  label: "",
  bank: "",
  last4: "",
  limit: "",
  cycleCloseDay: "4",
  paymentDueDay: "11",
};

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/cards")
      .then((res) =>
        res.json().then((json: Card[] | { error?: string }) => ({ res, json })),
      )
      .then(({ res, json }) => {
        if (!res.ok) {
          setError((json as { error?: string }).error ?? "Failed to load cards");
          return;
        }
        setCards(json as Card[]);
      })
      .catch(() => setError("Failed to load cards"))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(card: Card) {
    setEditId(card.id);
    setForm({
      label: card.label,
      bank: card.bank,
      last4: card.last4,
      limit: (card.limitCents / 100).toFixed(2).replace(".", ","),
      cycleCloseDay: String(card.cycleCloseDay),
      paymentDueDay: String(card.paymentDueDay),
    });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      label: form.label,
      bank: form.bank,
      last4: form.last4,
      limitCents: parseBrlInput(form.limit),
      cycleCloseDay: Number(form.cycleCloseDay),
      paymentDueDay: Number(form.paymentDueDay),
      ...(editId ? { id: editId } : {}),
    };
    const res = await apiFetch("/api/cards", {
      method: editId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as Card & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Save failed");
      return;
    }
    if (editId) {
      setCards((prev) => prev.map((c) => (c.id === editId ? json : c)));
    } else {
      setCards((prev) => [...prev, json]);
    }
    cancelEdit();
  }

  async function onDelete(id: string) {
    setError(null);
    const res = await apiFetch(`/api/cards?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Delete failed");
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (editId === id) cancelEdit();
  }

  return (
    <div>
      <PageHeading
        title="Credit cards"
        description="Limits and billing cycle dates for fatura projections."
      />

      <form
        onSubmit={onSubmit}
        className="mb-8 grid max-w-2xl gap-3 border border-border p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm uppercase tracking-wide text-muted">
          {editId ? "Edit card" : "New card"}
        </h2>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm text-muted">Label</span>
          <input
            className={INPUT_CLASS}
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Bank</span>
          <input
            className={INPUT_CLASS}
            value={form.bank}
            onChange={(e) => setForm({ ...form, bank: e.target.value })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Last 4</span>
          <input
            className={INPUT_CLASS}
            value={form.last4}
            onChange={(e) => setForm({ ...form, last4: e.target.value })}
            maxLength={4}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Limit (BRL)</span>
          <input
            className={INPUT_CLASS}
            value={form.limit}
            onChange={(e) => setForm({ ...form, limit: e.target.value })}
            inputMode="decimal"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Cycle close day</span>
          <input
            className={INPUT_CLASS}
            type="number"
            min={1}
            max={31}
            value={form.cycleCloseDay}
            onChange={(e) => setForm({ ...form, cycleCloseDay: e.target.value })}
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-muted">Payment due day</span>
          <input
            className={INPUT_CLASS}
            type="number"
            min={1}
            max={31}
            value={form.paymentDueDay}
            onChange={(e) => setForm({ ...form, paymentDueDay: e.target.value })}
            required
          />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" className={BTN_PRIMARY_CLASS}>
            {editId ? "Update card" : "Add card"}
          </button>
          {editId ? (
            <button type="button" className={BTN_LINK_CLASS} onClick={cancelEdit}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      {error ? <p className="mb-4 text-sm text-neon-orange">{error}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="text-muted">No cards yet.</p>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {cards.map((card) => (
            <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-foreground">{card.label}</p>
                <p className="text-sm text-muted">
                  {[card.bank, card.last4 ? `•••• ${card.last4}` : ""]
                    .filter(Boolean)
                    .join(" · ")}{" "}
                  · limit {formatBrl(card.limitCents)} · close {card.cycleCloseDay} · due{" "}
                  {card.paymentDueDay}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className={BTN_LINK_CLASS} onClick={() => startEdit(card)}>
                  Edit
                </button>
                <button
                  type="button"
                  className={BTN_DANGER_CLASS}
                  onClick={() => void onDelete(card.id)}
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
