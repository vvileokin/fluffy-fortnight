"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Bell, Target, Swords, Gift, TrendingUp, Check, LogIn } from "lucide-react";
import { Brand } from "./Brand";
import { Avatar } from "@/components/ui/Avatar";
import { BrandIcon } from "@/components/ui/BrandIcon";
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
  const streak = profile?.streak ?? 0;
  const eventPoints = profile?.ewc_points ?? 0;

  return (
    /* Impeccable: Crafted Top Bar — opaque, in the canvas's own colour, with no
       seam under it. It used to be 78% surface over a blur, so scrolled content
       ghosted through and the bar read as sliding rather than sitting still.
       z-40 stays: the bar is a stacking context, so the notifications panel can
       only clear the sidebar and bottom bar (both z-30) if the bar itself does. */
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 bg-bg px-4 sm:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <Brand compact />
      </div>
      <div className="hidden lg:block" />

      {/* Signed out → sign-in button; loading → nothing (avoids flash) */}
      {user === null && (
        <Link
          href="/login"
          className="flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <LogIn className="size-4" strokeWidth={2.5} />
          {t("signIn")}
        </Link>
      )}

      {user && (
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* The BLAST event is over, so its bounty chip is off the bar. The
            points themselves are untouched — they still count on the profile
            and in the event leaderboard. */}
        {/* Impeccable: Crafted Stat Rail — one balance, one badge.

            Both marks are the same brand yellow, so two identically-plated
            capsules side by side were unreadable: same hue, same weight, same
            shape, and no way to tell at a glance which number was which. The
            plate does the separating instead. The balance is the currency, so
            it keeps the yellow-tinted plate the design system reserves for
            points; the streak sits smaller on a neutral recessed one and reads
            as a badge next to it. Hue stays constant, hierarchy comes from
            plate, scale and weight. */}
        <Link
          href="/profile"
          aria-label={`${formatInt(points)} ${t("points")}`}
          className="flex h-10 items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] pl-2 pr-3.5 shadow-[0_0_0_1px_color-mix(in_oklch,var(--accent)_28%,transparent)] transition-colors hover:bg-[color-mix(in_oklch,var(--accent)_18%,transparent)]"
        >
          <BrandIcon name="points" className="size-5" priority />
          <span className="tnum font-mono text-sm font-extrabold leading-none text-accent">
            {formatInt(points)}
          </span>
        </Link>

        {/* Event currency. It links to the event's own board rather than the
            profile, because the only question a player has when they look at
            this number is "where does that put me at EWC". Hidden at zero so
            the bar doesn't carry a dead stat outside the event. */}
        {eventPoints > 0 && (
          <Link
            href="/tournaments/ewc-2026"
            aria-label={`${formatInt(eventPoints)} EWC`}
            className="flex h-9 items-center gap-1 rounded-full bg-[color-mix(in_oklch,rgb(255_88_16)_14%,transparent)] pl-1.5 pr-2.5 shadow-[0_0_0_1px_color-mix(in_oklch,rgb(255_88_16)_30%,transparent)] transition-colors hover:bg-[color-mix(in_oklch,rgb(255_88_16)_22%,transparent)]"
          >
            <BrandIcon name="points-ewc" className="size-[1.125rem]" priority />
            <span className="tnum font-mono text-[0.8125rem] font-bold leading-none text-[rgb(255_154_64)]">
              {formatInt(eventPoints)}
            </span>
          </Link>
        )}

        <Link
          href="/profile"
          aria-label={`${t("streak")}: ${streak}`}
          className="flex h-9 items-center gap-1 rounded-full bg-fill-2 pl-1.5 pr-2.5 shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_8%,transparent)] transition-colors hover:bg-fill-3"
        >
          <BrandIcon name="streak" className="size-[1.125rem]" priority />
          <span className="tnum font-mono text-[0.8125rem] font-bold leading-none text-accent/85">
            {streak}
          </span>
        </Link>

        {/* The handle rides beside the avatar on desktop only. On a phone the
            bar is already carrying three stats plus the bell, and a name is the
            one thing there that the avatar alone communicates well enough. */}
        <Link
          href="/profile"
          aria-label={handle}
          className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-85"
        >
          <Avatar name={handle} src={profile?.avatar_url} size="md" />
          <span className="hidden max-w-[10rem] truncate text-sm font-bold text-ink lg:block">
            {handle}
          </span>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={t("notifications")}
            aria-expanded={open}
            className={cn(
              "relative grid size-10 place-items-center rounded-full transition-colors",
              open
                ? "bg-surface-2 text-accent"
                : "bg-fill-1 text-ink-muted hover:bg-surface-2 hover:text-ink",
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
                className="absolute right-0 top-[calc(100%+0.5rem)] z-40 flex max-h-[min(70vh,32rem)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_9%,transparent),0_24px_60px_-16px_rgba(0,0,0,0.95)]"
              >
                <div className="flex shrink-0 items-center justify-between shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] px-4 py-2.5">
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
                <ul className="no-scrollbar min-h-0 flex-1 divide-y divide-[color-mix(in_oklch,var(--ink)_6%,transparent)] overflow-y-auto overscroll-contain">
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
                          "flex gap-2.5 px-3.5 py-2.5",
                          !n.read && "bg-[color-mix(in_oklch,var(--accent)_5%,transparent)]",
                        )}
                      >
                        <Icon
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            !n.read ? "text-accent" : "text-ink-subtle",
                          )}
                          strokeWidth={2.25}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.8125rem] leading-snug text-ink">{n.title}</p>
                          <p className="text-[0.6875rem] leading-snug text-ink-subtle">
                            {timeAgo(n.created_at)}
                          </p>
                        </div>
                        {!n.read && (
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
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
