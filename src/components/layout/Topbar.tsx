"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Bell, Target, Swords, Gift, TrendingUp, Check, LogIn } from "lucide-react";
import { Brand } from "./Brand";
import { BlastMark } from "@/components/ui/BlastMark";
import { Avatar } from "@/components/ui/Avatar";
import { Tooltip } from "@/components/ui/Tooltip";
import { displayName } from "@/lib/supabase/use-user";
import { useProfile } from "@/lib/supabase/use-profile";
import { createClient } from "@/lib/supabase/client";
import { formatInt } from "@/lib/utils";
import { type NotifKind } from "@/lib/data";
import { cn } from "@/lib/utils";

const kindIcon: Record<NotifKind, typeof Bell> = {
  reward: Target,
  match: Swords,
  giveaway: Gift,
  rank: TrendingUp,
};

type Notif = { id: string; kind: NotifKind; title: string; created_at: string; read: boolean };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "щойно";
  if (m < 60) return `${m} хв тому`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} год тому`;
  const d = Math.floor(h / 24);
  return `${d} дн тому`;
}

export function Topbar() {
  const t = useTranslations("nav");
  const { user, profile } = useProfile();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Notif[]>([]);
  const unread = items.filter((n) => !n.read).length;
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close the notifications menu on any outside click or Escape. A plain
  // overlay div couldn't do this reliably — it lived inside the header's
  // stacking context, so clicks on higher-stacked elements never reached it.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let cancelled = false;
    createClient()
      .from("notifications")
      .select("id, kind, title, created_at, read")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!cancelled && data) setItems(data as Notif[]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user) {
      // NB: the Supabase builder only fires the request when awaited/then'd —
      // `void builder` never sent it, so reads never persisted.
      createClient()
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false)
        .then(() => {});
    }
  }

  const handle = profile?.handle || (user ? displayName(user) : "");
  const points = profile?.points ?? 0;
  const bounty = profile?.bounty_points ?? 0;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-[color-mix(in_oklch,var(--surface)_78%,transparent)] px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <Brand compact />
      </div>
      <div className="hidden lg:block" />

      {/* Signed out → sign-in button; loading → nothing (avoids flash) */}
      {user === null && (
        <Link
          href="/login"
          className="flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <LogIn className="size-4" strokeWidth={2.5} />
          {t("signIn")}
        </Link>
      )}

      {user && (
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Bounty points earned in the event */}
        <Tooltip
          label="Bounty-поінти за прогнози BLAST"
          className="flex cursor-help items-center gap-1 rounded-full border border-border bg-surface px-2 py-1.5 text-xs"
        >
          <BlastMark className="size-3.5 text-accent" />
          <span className="tnum font-mono font-semibold text-ink">
            {formatInt(bounty)}
          </span>
        </Tooltip>

        <Link
          href="/profile"
          aria-label={`${handle}: ${points} ${t("points")}`}
          className="flex items-center gap-2.5 rounded-full border border-border bg-surface py-1 pl-3 pr-1.5 transition-colors hover:border-border-strong"
        >
          <span className="flex items-center gap-1.5 text-xs">
            <span className="tnum font-mono font-semibold text-accent">
              {formatInt(points)}
            </span>
            <span className="hidden text-ink-subtle sm:inline">
              {t("pointsShort")}
            </span>
          </span>
          <Avatar name={handle} src={profile?.avatar_url} size="sm" />
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={t("notifications")}
            aria-expanded={open}
            className={cn(
              "relative grid size-9 place-items-center rounded-full border transition-colors",
              open
                ? "border-border-strong bg-surface-2 text-ink"
                : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink",
            )}
          >
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-[1.125rem] place-items-center rounded-full border-2 border-bg bg-live px-1 text-[0.625rem] font-bold leading-tight text-white">
                {unread}
              </span>
            )}
          </button>

          {open && (
              <div
                role="dialog"
                aria-label={t("notifications")}
                className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)]"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-sm font-bold text-ink">{t("notifications")}</span>
                  {unread > 0 && (
                    <button
                      onClick={markAll}
                      className="flex items-center gap-1 text-xs font-semibold text-ink-muted transition-colors hover:text-accent"
                    >
                      <Check className="size-3.5" />
                      {t("markAllRead")}
                    </button>
                  )}
                </div>
                <ul className="max-h-56 divide-y divide-border overflow-y-auto">
                  {items.length === 0 && (
                    <li className="px-4 py-10 text-center text-sm text-ink-subtle">
                      Сповіщень поки немає
                    </li>
                  )}
                  {items.map((n) => {
                    const Icon = kindIcon[n.kind] ?? Bell;
                    return (
                      <li
                        key={n.id}
                        className={cn(
                          "flex gap-3 px-4 py-3",
                          !n.read && "bg-surface-2/50",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                            !n.read
                              ? "bg-[color-mix(in_oklch,var(--accent)_16%,transparent)] text-accent"
                              : "bg-surface-2 text-ink-subtle",
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-ink">{n.title}</p>
                          <p className="mt-0.5 text-xs text-ink-subtle">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.read && (
                          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
          )}
        </div>
      </div>
      )}
    </header>
  );
}
