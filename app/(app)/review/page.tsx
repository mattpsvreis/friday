"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { apiFetch } from "@/lib/session-client";
import { BTN_LINK_CLASS, BTN_PRIMARY_CLASS, INPUT_CLASS } from "@/lib/ui-classes";

type Installment = {
  id: string;
  number: number;
  ofTotal: number;
  amountCents: number;
  cycleCloseDate: string;
};

type Purchase = {
  id: string;
  merchant: string;
  purchaseDate: string;
  totalCents: number;
  installmentCount: number;
  installments: Installment[];
};

type LedgerEntry = {
  id: string;
  direction: string;
  method: string;
  amountCents: number;
  occursOn: string;
  description: string;
};

type ReviewData = {
  purchases: Purchase[];
  ledgerEntries: LedgerEntry[];
};

export default function ReviewPage() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<
    Record<string, { description: string; amount: string; occursOn: string }>
  >({});

  const applyReviewData = useCallback((json: ReviewData) => {
    setData(json);
    const nextEdits: Record<
      string,
      { description: string; amount: string; occursOn: string }
    > = {};
    for (const row of json.ledgerEntries) {
      nextEdits[row.id] = {
        description: row.description,
        amount: (row.amountCents / 100).toFixed(2).replace(".", ","),
        occursOn: row.occursOn,
      };
    }
    setEdits(nextEdits);
  }, []);

  const fetchReview = useCallback(() => {
    return apiFetch("/api/review")
      .then((res) =>
        res.json().then((json: ReviewData & { error?: string }) => ({ res, json })),
      )
      .then(({ res, json }) => {
        if (!res.ok) {
          setError(json.error ?? "Failed to load review queue");
          return;
        }
        applyReviewData(json);
      })
      .catch(() => setError("Failed to load review queue"));
  }, [applyReviewData]);

  useEffect(() => {
    fetchReview().finally(() => setLoading(false));
  }, [fetchReview]);

  async function reviewAction(
    type: "purchase" | "ledger",
    id: string,
    action: "confirm" | "reject",
  ) {
    setError(null);
    if (type === "ledger" && action === "confirm") {
      const draft = edits[id];
      if (draft) {
        const patchRes = await apiFetch("/api/ledger", {
          method: "PUT",
          body: JSON.stringify({
            id,
            description: draft.description,
            amountCents: parseBrlInput(draft.amount),
            occursOn: draft.occursOn,
          }),
        });
        if (!patchRes.ok) {
          const patchJson = (await patchRes.json()) as { error?: string };
          setError(patchJson.error ?? "Could not update entry before confirm");
          return;
        }
      }
    }

    const res = await apiFetch("/api/review", {
      method: "POST",
      body: JSON.stringify({ type, id, action }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Review action failed");
      return;
    }
    void fetchReview();
  }

  const empty =
    !loading &&
    data &&
    data.purchases.length === 0 &&
    data.ledgerEntries.length === 0;

  return (
    <div>
      <PageHeading
        title="Review"
        description="Confirm or reject imported and pending items before they hit projections."
      />

      {error ? <p className="mb-4 text-sm text-neon-orange">{error}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : empty ? (
        <p className="text-muted">Nothing waiting for review.</p>
      ) : null}

      {data && data.purchases.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-neon-orange">
            Purchases
          </h2>
          <ul className="divide-y divide-border border border-border">
            {data.purchases.map((p) => (
              <li key={p.id} className="space-y-2 px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-lg text-foreground">{p.merchant}</span>
                  <span className="tabular-nums text-neon-orange">
                    {formatBrl(p.totalCents)}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  Purchased {p.purchaseDate} · {p.installmentCount} installment
                  {p.installmentCount === 1 ? "" : "s"}
                </p>
                {p.installments.length > 0 ? (
                  <ul className="text-xs text-muted">
                    {p.installments.slice(0, 4).map((inst) => (
                      <li key={inst.id}>
                        #{inst.number}/{inst.ofTotal} {formatBrl(inst.amountCents)} closes{" "}
                        {inst.cycleCloseDate}
                      </li>
                    ))}
                    {p.installments.length > 4 ? (
                      <li>…and {p.installments.length - 4} more</li>
                    ) : null}
                  </ul>
                ) : null}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className={BTN_PRIMARY_CLASS}
                    onClick={() => void reviewAction("purchase", p.id, "confirm")}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className={BTN_LINK_CLASS}
                    onClick={() => void reviewAction("purchase", p.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data && data.ledgerEntries.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm uppercase tracking-wide text-neon-orange">
            Ledger entries
          </h2>
          <ul className="divide-y divide-border border border-border">
            {data.ledgerEntries.map((row) => {
              const draft = edits[row.id] ?? {
                description: row.description,
                amount: (row.amountCents / 100).toFixed(2).replace(".", ","),
                occursOn: row.occursOn,
              };
              return (
                <li key={row.id} className="space-y-3 px-4 py-4">
                  <p className="text-xs uppercase text-muted">
                    {row.direction} · {row.method}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-sm text-muted">Description</span>
                      <input
                        className={INPUT_CLASS}
                        value={draft.description}
                        onChange={(e) =>
                          setEdits({
                            ...edits,
                            [row.id]: { ...draft, description: e.target.value },
                          })
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm text-muted">Amount (BRL)</span>
                      <input
                        className={INPUT_CLASS}
                        value={draft.amount}
                        onChange={(e) =>
                          setEdits({
                            ...edits,
                            [row.id]: { ...draft, amount: e.target.value },
                          })
                        }
                        inputMode="decimal"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm text-muted">Date</span>
                      <input
                        type="date"
                        className={INPUT_CLASS}
                        value={draft.occursOn}
                        onChange={(e) =>
                          setEdits({
                            ...edits,
                            [row.id]: { ...draft, occursOn: e.target.value },
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className={BTN_PRIMARY_CLASS}
                      onClick={() => void reviewAction("ledger", row.id, "confirm")}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className={BTN_LINK_CLASS}
                      onClick={() => void reviewAction("ledger", row.id, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 text-sm text-muted">
        After imports, check{" "}
        <Link href="/review" className="text-neon-green hover:underline">
          Review
        </Link>{" "}
        before trusting dashboard numbers.
      </p>
    </div>
  );
}
