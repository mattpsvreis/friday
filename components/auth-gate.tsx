"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearSessionToken,
  getSessionToken,
} from "@/lib/session-client";

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
    const token = getSessionToken();
    if (!token) {
      router.replace("/unlock");
      return;
    }

    fetch("/api/auth/status", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          clearSessionToken();
          router.replace("/unlock");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        clearSessionToken();
        router.replace("/unlock");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      {!ready ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background text-muted">
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
