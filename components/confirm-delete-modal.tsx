"use client";

import { useEffect } from "react";
import { BTN_DANGER_CLASS, BTN_PRIMARY_CLASS } from "@/lib/ui-classes";

type ConfirmDeleteModalProps = {
  open: boolean;
  title: string;
  description?: string;
  step: 1 | 2;
  busy?: boolean;
  onCancel: () => void;
  onContinue: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteModal({
  open,
  title,
  description,
  step,
  busy = false,
  onCancel,
  onContinue,
  onConfirm,
}: ConfirmDeleteModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75"
        aria-label="Close confirmation"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        className="relative z-10 w-full max-w-md border border-border glass-panel-strong p-6 shadow-[0_0_24px_color-mix(in_srgb,var(--neon-orange)_20%,transparent)]"
      >
        <h2
          id="confirm-delete-title"
          className="font-[family-name:var(--font-source-serif)] text-2xl text-foreground"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm text-muted">{description}</p>
        ) : null}

        {step === 1 ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-foreground">
              Do you want to delete this? This starts a two-step confirmation.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={BTN_PRIMARY_CLASS}
                disabled={busy}
                onClick={onContinue}
              >
                Continue
              </button>
              <button
                type="button"
                className={BTN_DANGER_CLASS}
                disabled={busy}
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-neon-orange">
              Final step: this cannot be undone. Delete permanently?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="border border-neon-orange bg-neon-orange/15 px-4 py-2 text-sm text-neon-orange transition-colors hover:bg-neon-orange/25 disabled:opacity-50"
                disabled={busy}
                onClick={onConfirm}
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
              <button
                type="button"
                className={BTN_DANGER_CLASS}
                disabled={busy}
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
