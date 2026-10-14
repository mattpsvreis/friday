"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { apiFetch } from "@/lib/session-client";
import { BTN_PRIMARY_CLASS, INPUT_CLASS } from "@/lib/ui-classes";

type Settings = {
  hasPassword: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/settings")
      .then((res) =>
        res.json().then((json: Settings & { error?: string }) => ({ res, json })),
      )
      .then(({ res, json }) => {
        if (!res.ok) {
          setError(json.error ?? "Failed to load settings");
          return;
        }
        setSettings(json);
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const res = await apiFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Password change failed");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setMessage("Password updated.");
  }

  return (
    <div>
      <PageHeading
        title="Settings"
        description="App lock password. Pick the viewed month on the Dashboard."
      />

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <form
          onSubmit={onChangePassword}
          className="max-w-md space-y-3 border border-border p-4"
        >
          <h2 className="text-sm uppercase tracking-wide text-muted">
            Password
            {settings?.hasPassword ? null : (
              <span className="ml-2 text-xs normal-case text-neon-orange">
                (set on first unlock flow)
              </span>
            )}
          </h2>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Current password</span>
            <input
              type="password"
              className={INPUT_CLASS}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">New password</span>
            <input
              type="password"
              className={INPUT_CLASS}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className={BTN_PRIMARY_CLASS}>
            Change password
          </button>
        </form>
      )}

      {error ? <p className="mt-4 text-sm text-neon-orange">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-neon-green">{message}</p> : null}
    </div>
  );
}
