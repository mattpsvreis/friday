"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { apiFetch } from "@/lib/session-client";
import { BTN_LINK_CLASS, BTN_PRIMARY_CLASS, INPUT_CLASS } from "@/lib/ui-classes";

type Card = { id: string; label: string };

type ImportResult = {
  batchId?: string;
  warnings?: string;
  error?: string;
};

export default function ImportPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [importType, setImportType] = useState<"extrato" | "fatura">("extrato");
  const [creditCardId, setCreditCardId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [warnings, setWarnings] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    void apiFetch("/api/cards").then(async (res) => {
      if (res.ok) {
        setCards((await res.json()) as Card[]);
      }
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a PDF file.");
      return;
    }
    if (importType === "fatura" && !creditCardId) {
      setError("Select a credit card for fatura imports.");
      return;
    }

    setUploading(true);
    setError(null);
    setWarnings(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", importType);
    if (importType === "fatura") {
      formData.append("creditCardId", creditCardId);
    }

    const res = await apiFetch("/api/import", {
      method: "POST",
      body: formData,
    });
    const json = (await res.json()) as ImportResult;
    setUploading(false);

    if (!res.ok) {
      setError(json.error ?? "Import failed");
      return;
    }

    setSuccess(true);
    setFile(null);
    if (json.warnings?.trim()) {
      setWarnings(json.warnings.trim());
    }
  }

  return (
    <div>
      <PageHeading
        title="Import"
        description="Upload Itaú PDF statements. Items land in Review until confirmed."
      />

      <form onSubmit={onSubmit} className="max-w-lg space-y-4 border border-border p-4">
        <label className="block space-y-1">
          <span className="text-sm text-muted">PDF file</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="block w-full text-sm text-muted file:mr-4 file:border file:border-neon-orange file:bg-transparent file:px-3 file:py-2 file:text-neon-orange"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-muted">Import type</span>
          <select
            className={INPUT_CLASS}
            value={importType}
            onChange={(e) => setImportType(e.target.value as "extrato" | "fatura")}
          >
            <option value="extrato">extrato (checking)</option>
            <option value="fatura">fatura (credit card)</option>
          </select>
        </label>

        {importType === "fatura" ? (
          <label className="block space-y-1">
            <span className="text-sm text-muted">Credit card</span>
            <select
              className={INPUT_CLASS}
              value={creditCardId}
              onChange={(e) => setCreditCardId(e.target.value)}
              required
            >
              <option value="">Select card</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button type="submit" className={BTN_PRIMARY_CLASS} disabled={uploading}>
          {uploading ? "Uploading…" : "Upload and parse"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-neon-orange">{error}</p> : null}

      {success ? (
        <p className="mt-4 text-sm text-neon-green">
          Import finished.{" "}
          <Link href="/review" className={BTN_LINK_CLASS}>
            Open Review →
          </Link>
        </p>
      ) : null}

      {warnings ? (
        <div className="mt-6 border border-border p-4">
          <h2 className="text-sm uppercase tracking-wide text-neon-orange">Warnings</h2>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-muted">{warnings}</pre>
          <p className="mt-3 text-sm">
            <Link href="/review" className="text-neon-green hover:underline">
              Review imported items
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
