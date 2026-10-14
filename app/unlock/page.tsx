"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  clearSessionToken,
  getSessionToken,
  setSessionToken,
} from "@/lib/session-client";

export default function UnlockPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "setup" | "unlock">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const token = getSessionToken();
      if (token) {
        try {
          const response = await fetch("/api/auth/status", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          const data = (await response.json()) as {
            hasPassword?: boolean;
            unlocked?: boolean;
          };
          if (cancelled) return;
          // Only skip the unlock form when the server confirms this session.
          if (response.ok && data.unlocked) {
            router.replace("/");
            return;
          }
          clearSessionToken();
        } catch {
          // Server restarting — fall through to the unlock form.
          if (cancelled) return;
        }
      }

      try {
        const response = await fetch("/api/auth/status", { cache: "no-store" });
        const data = (await response.json()) as { hasPassword?: boolean };
        if (cancelled) return;
        setMode(data.hasPassword ? "unlock" : "setup");
      } catch {
        if (!cancelled) setMode("setup");
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "setup") {
        if (password.length < 4) {
          setError("Use at least 4 characters.");
          return;
        }
        if (password !== confirm) {
          setError("Passwords do not match.");
          return;
        }
        const response = await fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Setup failed");
        setSessionToken(data.token);
      } else {
        const response = await fetch("/api/auth/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unlock failed");
        setSessionToken(data.token);
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-6 border border-border glass-panel-strong p-8"
      >
        <div className="space-y-3 text-center">
          <Image
            src="/brand/friday-wide.png"
            alt="Friday"
            width={480}
            height={120}
            className="mx-auto h-auto w-[70%] max-w-[14rem]"
            priority
          />
          <p className="text-muted">
            {mode === "setup"
              ? "Set a local unlock password."
              : "Enter your unlock password."}
          </p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm text-muted">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border bg-background/80 px-3 py-2 text-foreground outline-none focus:border-neon-green"
            autoComplete={mode === "setup" ? "new-password" : "current-password"}
            required
          />
        </label>

        {mode === "setup" ? (
          <label className="block space-y-2">
            <span className="text-sm text-muted">Confirm</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-border bg-background/80 px-3 py-2 text-foreground outline-none focus:border-neon-green"
              autoComplete="new-password"
              required
            />
          </label>
        ) : null}

        {error ? <p className="text-sm text-neon-orange">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full border border-neon-orange bg-neon-orange/10 px-4 py-3 text-neon-orange transition hover:bg-neon-orange/20 disabled:opacity-50"
        >
          {busy ? "Working…" : mode === "setup" ? "Create lock" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
