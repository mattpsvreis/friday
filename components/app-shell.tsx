"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { APP_NAV } from "@/lib/nav";

function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={className}>
      {APP_NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={[
              "whitespace-nowrap text-sm tracking-wide transition-colors",
              active
                ? "text-neon-green [text-shadow:0_0_10px_color-mix(in_srgb,var(--neon-green)_55%,transparent)]"
                : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);

  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-full flex flex-col bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link
            href="/"
            className="font-[family-name:var(--font-source-serif)] text-xl tracking-tight text-neon-green [text-shadow:0_0_12px_color-mix(in_srgb,var(--neon-green)_40%,transparent)]"
          >
            Friday
          </Link>

          <NavLinks className="hidden flex-1 items-center gap-4 overflow-x-auto lg:flex" />

          <button
            type="button"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center border border-border text-neon-orange lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">Menu</span>
            <span className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
            </span>
          </button>
        </div>
      </header>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/70 lg:hidden"
            aria-label="Close menu overlay"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col border-l border-border bg-surface p-6 pt-20 lg:hidden">
            <NavLinks
              onNavigate={() => setOpen(false)}
              className="flex flex-col gap-4"
            />
          </aside>
        </>
      ) : null}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-20 sm:px-6">
        {children}
      </main>
    </div>
  );
}
