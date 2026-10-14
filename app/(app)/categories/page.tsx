"use client";

import { FormEvent, useEffect, useState } from "react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { PageHeading } from "@/components/page-heading";
import { apiFetch } from "@/lib/session-client";
import {
  BTN_DANGER_CLASS,
  BTN_LINK_CLASS,
  BTN_PRIMARY_CLASS,
  INPUT_CLASS,
} from "@/lib/ui-classes";
import { useConfirmDelete } from "@/lib/use-confirm-delete";

type Category = {
  id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
};

const DEFAULT_COLOR = "#39ff14";

export default function CategoriesPage() {
  const confirmDelete = useConfirmDelete<Category>();
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [editId, setEditId] = useState<string | null>(null);
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
        setRows(
          (json as Category[]).sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setEditId(null);
    setName("");
    setKind("expense");
    setColor(DEFAULT_COLOR);
  }

  function startEdit(row: Category) {
    setEditId(row.id);
    setName(row.name);
    setKind(row.kind);
    setColor(row.color || DEFAULT_COLOR);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (editId) {
      const res = await apiFetch("/api/categories", {
        method: "PUT",
        body: JSON.stringify({ id: editId, name, kind, color }),
      });
      const json = (await res.json()) as Category & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not update category");
        return;
      }
      setRows((prev) =>
        prev
          .map((row) => (row.id === editId ? json : row))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      resetForm();
      return;
    }

    const res = await apiFetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name, kind, color }),
    });
    const json = (await res.json()) as Category & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not add category");
      return;
    }
    setRows((prev) =>
      [...prev, json].sort((a, b) => a.name.localeCompare(b.name)),
    );
    resetForm();
  }

  async function deleteCategory(row: Category) {
    setError(null);
    const res = await apiFetch(
      `/api/categories?id=${encodeURIComponent(row.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Delete failed");
      throw new Error(json.error ?? "Delete failed");
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    if (editId === row.id) resetForm();
  }

  return (
    <div>
      <PageHeading
        title="Categories"
        description="Group income and expenses for reporting. Each category has a color."
      />
      <form
        onSubmit={onSubmit}
        className="mb-8 flex max-w-2xl flex-col gap-3 border border-border p-4 sm:flex-row sm:items-end"
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
        <label className="space-y-1 sm:w-28">
          <span className="text-sm text-muted">Color</span>
          <input
            type="color"
            className="h-10 w-full cursor-pointer border border-border bg-background p-1"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Category color"
          />
        </label>
        <div className="flex gap-2">
          <button type="submit" className={BTN_PRIMARY_CLASS}>
            {editId ? "Update" : "Add"}
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
      ) : rows.length === 0 ? (
        <p className="text-muted">No categories yet.</p>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-4 w-4 shrink-0 border border-border"
                  style={{ backgroundColor: row.color || DEFAULT_COLOR }}
                  aria-hidden
                />
                <div className="min-w-0">
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
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={BTN_LINK_CLASS}
                  onClick={() => startEdit(row)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={BTN_DANGER_CLASS}
                  onClick={() =>
                    confirmDelete.requestDelete(
                      row,
                      "Delete category",
                      `${row.name} (${row.kind})`,
                    )
                  }
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
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
        onConfirm={() => void confirmDelete.runConfirm(deleteCategory)}
      />
    </div>
  );
}
