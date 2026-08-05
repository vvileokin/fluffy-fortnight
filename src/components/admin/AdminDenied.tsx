"use client";

import Link from "next/link";
import { Lock, LogIn, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Shown instead of the panel to anyone without a grant. The panel itself is
 * never rendered for them — this is all they get, whichever way they arrived.
 */
export function AdminDenied({ signedIn }: { signedIn: boolean }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 aura-accent" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-2xl border border-border bg-surface-2 text-accent">
            <Lock className="size-6" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
            Адмін-панель CS2 UA
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {signedIn
              ? "Цей акаунт не має доступу до панелі."
              : "Доступ прив’язаний до акаунта. Увійди, щоб продовжити."}
          </p>
        </div>

        <div className="space-y-3 rounded-xl surface-1 p-5">
          {signedIn ? (
            <>
              <p className="text-center text-xs text-ink-subtle">
                Доступ видає адміністратор — саме цьому акаунту.
              </p>
              <button
                onClick={() => void createClient().auth.signOut().then(() => location.reload())}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border-strong text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                <LogOut className="size-4" />
                Вийти з акаунта
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
            >
              <LogIn className="size-4" />
              Увійти в акаунт
            </Link>
          )}
          <Link
            href="/"
            className="block text-center text-xs font-medium text-ink-subtle transition-colors hover:text-ink"
          >
            На сайт
          </Link>
        </div>
      </div>
    </main>
  );
}
