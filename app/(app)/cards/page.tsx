"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { PageHeading } from "@/components/page-heading";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { apiFetch } from "@/lib/session-client";
import {
  BTN_DANGER_CLASS,
  BTN_LINK_CLASS,
  BTN_PRIMARY_CLASS,
  INPUT_CLASS,
} from "@/lib/ui-classes";
import { useConfirmDelete } from "@/lib/use-confirm-delete";

type Card = {
  id: string;
  label: string;
  bank: string;
  last4: string;
  limitCents: number;
  usedCents: number;
  availableCents: number;
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

function usagePct(card: Card) {
  if (card.limitCents <= 0) return card.usedCents > 0 ? 100 : 0;
  return Math.min(100, Math.round((card.usedCents / card.limitCents) * 100));
}

function usageBarClass(pct: number) {
  if (pct >= 90) return "bg-neon-orange";
  if (pct >= 70) return "bg-neon-orange/70";
  return "bg-neon-green";
}

function LimitUsageBar({ card }: { card: Card }) {
  const pct = usagePct(card);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm text-foreground">{card.label}</p>
        <p className="shrink-0 text-xs tabular-nums text-muted">{pct}%</p>
      </div>
      <div className="h-2 overflow-hidden border border-border bg-background/50">
        <div
          className={["h-full transition-[width]", usageBarClass(pct)].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs tabular-nums text-muted">
        <span className="text-neon-orange">{formatBrl(card.usedCents)}</span>
        {" / "}
        {formatBrl(card.limitCents)}
        <span className="text-muted">
          {" · "}
          {formatBrl(card.availableCents)} free
        </span>
      </p>
    </div>
  );
}

export default function CardsPage() {
  const confirmDelete = useConfirmDelete<Card>();
  const [cards, setCards] = useState<Card[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCards = useCallback(async () => {
    const res = await apiFetch("/api/cards");
    const json = (await res.json()) as Card[] | { error?: string };
    if (!res.ok) {
      setError((json as { error?: string }).error ?? "Failed to load cards");
      return;
    }
    setCards(json as Card[]);
  }, []);

  useEffect(() => {
    loadCards()
      .catch(() => setError("Failed to load cards"))
      .finally(() => setLoading(false));
  }, [loadCards]);

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
    cancelEdit();
    await loadCards();
  }

  async function deleteCard(card: Card) {
    setError(null);
    const res = await apiFetch(`/api/cards?id=${encodeURIComponent(card.id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Delete failed");
      throw new Error(json.error ?? "Delete failed");
    }
    if (editId === card.id) cancelEdit();
    await loadCards();
  }

  return (
    <div>
      <PageHeading
        title="Credit cards"
        description="Limits and billing cycle dates for fatura projections."
      />

      <div className="mb-8 grid gap-4 xl:grid-cols-2">
        <form
          onSubmit={onSubmit}
          className="grid gap-3 border border-border glass-panel p-4 sm:grid-cols-2"
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
              onChange={(e) =>
                setForm({ ...form, cycleCloseDay: e.target.value })
              }
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
              onChange={(e) =>
                setForm({ ...form, paymentDueDay: e.target.value })
              }
              required
            />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="submit" className={BTN_PRIMARY_CLASS}>
              {editId ? "Update card" : "Add card"}
            </button>
            {editId ? (
              <button
                type="button"
                className={BTN_LINK_CLASS}
                onClick={cancelEdit}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <section className="flex min-h-0 flex-col border border-border glass-panel">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
              Limit usage
            </h2>
            <p className="mt-1 text-xs text-muted">
              Open fatura · installments + card recurrings
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-4 p-4">
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : cards.length === 0 ? (
              <p className="text-sm text-muted">Add a card to see limit usage.</p>
            ) : (
              cards.map((card) => (
                <LimitUsageBar key={card.id} card={card} />
              ))
            )}
          </div>
        </section>
      </div>

      {error ? <p className="mb-4 text-sm text-neon-orange">{error}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="text-muted">No cards yet.</p>
      ) : (
        <ul className="divide-y divide-border border border-border glass-panel">
          {cards.map((card) => {
            const pct = usagePct(card);
            return (
              <li key={card.id} className="space-y-3 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground">{card.label}</p>
                    <p className="text-sm text-muted">
                      {[card.bank, card.last4 ? `•••• ${card.last4}` : ""]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      · close {card.cycleCloseDay} · due {card.paymentDueDay}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={BTN_LINK_CLASS}
                      onClick={() => startEdit(card)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={BTN_DANGER_CLASS}
                      onClick={() =>
                        confirmDelete.requestDelete(
                          card,
                          "Delete card",
                          `${card.label}${card.last4 ? ` · •••• ${card.last4}` : ""}`,
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-1.5 overflow-hidden border border-border bg-background/50">
                    <div
                      className={[
                        "h-full transition-[width]",
                        usageBarClass(pct),
                      ].join(" ")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs tabular-nums text-muted">
                    <span className="text-neon-orange">
                      {formatBrl(card.usedCents)}
                    </span>
                    {" used / "}
                    {formatBrl(card.limitCents)} limit
                    <span className="text-muted"> · {pct}%</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDeleteModal
        open={confirmDelete.open}
        title={confirmDelete.pending?.title ?? "Delete"}
        description={confirmDelete.pending?.description}
        step={confirmDelete.step}
        busy={confirmDelete.busy}
        onCancel={confirmDelete.cancel}
        onContinue={confirmDelete.continueToStep2}
        onConfirm={() => void confirmDelete.runConfirm(deleteCard)}
      />
    </div>
  );
}
