"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { apiFetch } from "@/lib/session-client";
import { BTN_PRIMARY_CLASS, INPUT_CLASS } from "@/lib/ui-classes";

type Snapshot = {
  spendableCents: number;
  savedCents: number;
};

export function BalancesEditor() {
  const [spendable, setSpendable] = useState("");
  const [saved, setSaved] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/balances")
      .then((res) =>
        res.json().then((json: Snapshot & { error?: string }) => ({ res, json })),
      )
      .then(({ res, json }) => {
        if (!res.ok) {
          setError(json.error ?? "Failed to load balances");
          return;
        }
        setSpendable((json.spendableCents / 100).toFixed(2).replace(".", ","));
        setSaved((json.savedCents / 100).toFixed(2).replace(".", ","));
      })
      .catch(() => setError("Failed to load balances"))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    const body = {
      spendableCents: parseBrlInput(spendable),
      savedCents: parseBrlInput(saved),
    };
    const res = await apiFetch("/api/balances", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as Snapshot & { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Save failed");
      return;
    }
    setMessage(
      `Saved — spendable ${formatBrl(json.spendableCents)}, saved ${formatBrl(json.savedCents)}`,
    );
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading balances…</p>;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid max-w-xl gap-3 border border-border p-4 sm:grid-cols-2"
    >
      <h2 className="sm:col-span-2 text-sm uppercase tracking-wide text-muted">
        Balance snapshot
      </h2>
      <label className="space-y-1">
        <span className="text-sm text-muted">Spendable (BRL)</span>
        <input
          className={INPUT_CLASS}
          value={spendable}
          onChange={(e) => setSpendable(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
        />
      </label>
      <label className="space-y-1">
        <span className="text-sm text-muted">Saved (BRL)</span>
        <input
          className={INPUT_CLASS}
          value={saved}
          onChange={(e) => setSaved(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
        />
      </label>
      {error ? (
        <p className="sm:col-span-2 text-sm text-neon-orange">{error}</p>
      ) : null}
      {message ? (
        <p className="sm:col-span-2 text-sm text-neon-green">{message}</p>
      ) : null}
      <div className="sm:col-span-2">
        <button type="submit" className={BTN_PRIMARY_CLASS} disabled={saving}>
          {saving ? "Saving…" : "Save balances"}
        </button>
      </div>
    </form>
  );
}
