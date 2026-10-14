"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { APP_NAV, SETTINGS_NAV, type AppNavItem } from "@/lib/nav";

function navActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandMark({
  onNavigate,
  className,
  compact,
}: {
  onNavigate?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className={["block", className].filter(Boolean).join(" ")}
      aria-label="Friday home"
    >
      <Image
        src="/brand/friday-wide.png"
        alt="Friday"
        width={480}
        height={120}
        className={
          compact ? "h-7 w-auto max-w-[8.5rem]" : "mx-auto h-auto w-[72%]"
        }
        priority
      />
    </Link>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: AppNavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = navActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={[
        "flex items-center gap-3 rounded-sm px-3 py-2 text-sm tracking-wide transition-colors",
        active
          ? "bg-neon-green/10 text-neon-green [text-shadow:0_0_10px_color-mix(in_srgb,var(--neon-green)_55%,transparent)]"
          : "text-muted hover:bg-surface hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}

function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <div className="flex h-full flex-col">
      <BrandMark onNavigate={onNavigate} className="px-3 py-3" />

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {APP_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-auto px-2 mb-8 pt-2">
        <NavLink
          item={SETTINGS_NAV}
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <p className="mt-3 px-3 text-[10px] leading-relaxed text-muted/40">
          Copyright:{" "}
          <a
            href="https://github.com/mattpsvreis"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 transition-colors hover:text-neon-green hover:underline"
          >
            @mattpsvreis
          </a>
          {" | "}
          {year ?? "\u00a0"}
        </p>
      </div>
    </div>
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
    <div className="min-h-full text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 border-r border-border glass-panel-strong lg:flex lg:flex-col">
        <SidebarNav pathname={pathname} />
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-border glass-panel-strong px-4 lg:hidden">
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-border text-neon-orange"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
        <BrandMark compact className="min-w-0" />
      </header>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
            aria-label="Close menu overlay"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-56 max-w-[85vw] flex-col border-r border-border glass-panel-strong lg:hidden">
            <SidebarNav pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </>
      ) : null}

      <main className="min-h-full px-4 pb-16 pt-20 sm:px-6 lg:pl-60 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
