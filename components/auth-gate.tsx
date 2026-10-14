"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearSessionToken,
  getSessionToken,
} from "@/lib/session-client";

type StatusPayload = {
  hasPassword?: boolean;
  unlocked?: boolean;
};

/**
 * Always keeps `{children}` in the tree so Cache Components / Partial Prefetching
 * can validate page segments for instant navigation. Auth is enforced client-side
 * with an overlay + redirect; never replace children with a loading stub.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function check() {
      const token = getSessionToken();
      if (!token) {
        router.replace("/unlock");
        return;
      }

      try {
        const response = await fetch("/api/auth/status", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (cancelled) return;

        // DB still booting after restart — keep waiting; do not bounce to unlock
        // with a live token (unlock would send us right back here).
        if (response.status >= 500) {
          attempts += 1;
          await new Promise((r) =>
            setTimeout(r, Math.min(2000, 200 * attempts)),
          );
          if (!cancelled) await check();
          return;
        }

        let data: StatusPayload = {};
        try {
          data = (await response.json()) as StatusPayload;
        } catch {
          data = {};
        }

        if (cancelled) return;

        if (!response.ok || !data.unlocked) {
          clearSessionToken();
          router.replace("/unlock");
          return;
        }

        setReady(true);
      } catch {
        if (cancelled) return;
        // Network blip while the server restarts — retry, keep the token.
        attempts += 1;
        await new Promise((r) =>
          setTimeout(r, Math.min(2000, 200 * attempts)),
        );
        if (!cancelled) await check();
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      {!ready ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/35 text-muted backdrop-blur-[2px]">
          Unlocking…
        </div>
      ) : null}
      <div
        aria-hidden={!ready}
        className={ready ? undefined : "invisible pointer-events-none"}
      >
        {children}
      </div>
    </>
  );
}
