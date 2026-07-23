"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  Calculator,
  Gift,
  LayoutTemplate,
  Users,
  ScrollText,
  Lock,
  LogOut,
  ShieldAlert,
  ExternalLink,
  Swords,
} from "lucide-react";
import { Brand } from "@/components/layout/Brand";
import { BlastMark } from "@/components/ui/BlastMark";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

const nav: { href: string; label: string; icon: IconType; adminOnly?: boolean }[] = [
  { href: "/admin", label: "Огляд", icon: LayoutDashboard },
  { href: "/admin/matches", label: "Матчі", icon: Swords },
  { href: "/admin/questions", label: "Питання", icon: Target },
  { href: "/admin/bounty", label: "BLAST Bounty", icon: BlastMark },
  { href: "/admin/resolve", label: "Розрахунок", icon: Calculator },
  { href: "/admin/giveaways", label: "Розіграші", icon: Gift },
  { href: "/admin/content", label: "Контент", icon: LayoutTemplate },
  { href: "/admin/users", label: "Користувачі та ролі", icon: Users, adminOnly: true },
  { href: "/admin/audit", label: "Журнал аудиту", icon: ScrollText },
];

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = React.useState<boolean | null>(null);
  const pathname = usePathname();

  React.useEffect(() => {
    // Unlock the panel only when the admin cookie is actually valid server-side,
    // so UI state and API auth never drift apart.
    fetch("/api/admin/login")
      .then((r) => r.json())
      .then((d) => setAuthed(!!d.authed))
      .catch(() => setAuthed(false));
  }, []);

  const unlock = React.useCallback(() => {
    setAuthed(true);
  }, []);

  const logout = React.useCallback(() => {
    void fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  }, []);

  if (authed === null) return null; // avoid flash before we know
  if (!authed) return <Gate onUnlock={unlock} />;

  return (
    <div className="min-h-dvh">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <Brand compact />
          <span className="rounded-md bg-danger/15 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-danger">
            Admin
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {nav.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
                  active
                    ? "bg-surface-2 text-ink"
                    : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
                )}
                <item.icon
                  className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-ink-subtle")}
                  strokeWidth={2.25}
                />
                <span className="flex-1">{item.label}</span>
                {item.adminOnly && (
                  <ShieldAlert className="size-3.5 text-ink-faint" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 px-3 pb-4">
          <Link
            href="/"
            className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ExternalLink className="size-4" />
            На сайт
          </Link>
          <button
            onClick={logout}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-danger"
          >
            <LogOut className="size-4" />
            Вийти
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="lg:pl-[248px]">
        {/* Mobile admin bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <Brand compact />
            <span className="rounded-md bg-danger/15 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-danger">
              Admin
            </span>
          </div>
          <button onClick={logout} aria-label="Вийти" className="text-ink-muted">
            <LogOut className="size-5" />
          </button>
        </header>

        {/* Mobile section tabs */}
        <div className="no-scrollbar sticky top-14 z-10 flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 lg:hidden">
          {nav.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  active ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = React.useState("");
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) onUnlock();
    else setError(true);
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 aura-accent" />
      <form onSubmit={submit} className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-2xl border border-border bg-surface-2 text-accent">
            <Lock className="size-6" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
            Адмін-панель CS2 UA
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Введи пароль для доступу до керування.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError(false);
            }}
            placeholder="Пароль"
            className={cn(
              "h-11 w-full rounded-lg border bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:outline-none",
              error ? "border-danger" : "border-border focus:border-accent",
            )}
          />
          {error && (
            <p className="text-xs font-medium text-danger">Невірний пароль.</p>
          )}
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Увійти
          </button>
        </div>
      </form>
    </main>
  );
}
