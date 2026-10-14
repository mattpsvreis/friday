"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { apiFetch } from "@/lib/session-client";
import { BTN_PRIMARY_CLASS, INPUT_CLASS } from "@/lib/ui-classes";

type Snapshot = {
  spendableCents: number;
  savedCents: number;
};

export default function BalancesPage() {
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

  return (
    <div>
      <PageHeading
        title="Balances"
        description="Update your spendable cash and saved reserves snapshot."
      />
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <form onSubmit={onSubmit} className="max-w-md space-y-4 border border-border p-4">
          <label className="block space-y-1">
            <span className="text-sm text-muted">Spendable (BRL)</span>
            <input
              className={INPUT_CLASS}
              value={spendable}
              onChange={(e) => setSpendable(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Saved (BRL)</span>
            <input
              className={INPUT_CLASS}
              value={saved}
              onChange={(e) => setSaved(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </label>
          {error ? <p className="text-sm text-neon-orange">{error}</p> : null}
          {message ? <p className="text-sm text-neon-green">{message}</p> : null}
          <button type="submit" className={BTN_PRIMARY_CLASS} disabled={saving}>
            {saving ? "Saving…" : "Save balances"}
          </button>
        </form>
      )}
    </div>
  );
}
