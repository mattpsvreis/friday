"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { apiFetch } from "@/lib/session-client";
import {
  BTN_DANGER_CLASS,
  BTN_PRIMARY_CLASS,
  INPUT_CLASS,
} from "@/lib/ui-classes";

type Category = {
  id: string;
  name: string;
  kind: "income" | "expense";
};

export default function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/categories")
      .then((res) =>
        res.json().then((json: Category[] | { error?: string }) => ({ res, json })),
      )
      .then(({ res, json }) => {
        if (!res.ok) {
          setError((json as { error?: string }).error ?? "Failed to load");
          return;
        }
        setRows(json as Category[]);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name, kind }),
    });
    const json = (await res.json()) as Category & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not add category");
      return;
    }
    setName("");
    setRows((prev) => [...prev, json].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function onDelete(id: string) {
    setError(null);
    const res = await apiFetch(`/api/categories?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Delete failed");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div>
      <PageHeading
        title="Categories"
        description="Group income and expenses for reporting."
      />
      <form
        onSubmit={onAdd}
        className="mb-8 flex max-w-xl flex-col gap-3 border border-border p-4 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1 space-y-1">
          <span className="text-sm text-muted">Name</span>
          <input
            className={INPUT_CLASS}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="space-y-1 sm:w-36">
          <span className="text-sm text-muted">Kind</span>
          <select
            className={INPUT_CLASS}
            value={kind}
            onChange={(e) => setKind(e.target.value as "income" | "expense")}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <button type="submit" className={BTN_PRIMARY_CLASS}>
          Add
        </button>
      </form>

      {error ? <p className="mb-4 text-sm text-neon-orange">{error}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted">No categories yet.</p>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <span className="text-foreground">{row.name}</span>
                <span
                  className={[
                    "ml-2 text-xs uppercase tracking-wide",
                    row.kind === "income" ? "text-neon-green" : "text-muted",
                  ].join(" ")}
                >
                  {row.kind}
                </span>
              </div>
              <button
                type="button"
                className={BTN_DANGER_CLASS}
                onClick={() => void onDelete(row.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
