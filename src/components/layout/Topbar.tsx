"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Bell, Target, Swords, Gift, TrendingUp, Check, LogIn, Loader2, X } from "lucide-react";
import { Brand } from "./Brand";
import { Avatar } from "@/components/ui/Avatar";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { displayName } from "@/lib/supabase/use-user";
import { useProfile, refreshProfile } from "@/lib/supabase/use-profile";
import { createClient } from "@/lib/supabase/client";
import { formatInt } from "@/lib/utils";
import { type NotifKind } from "@/lib/data";
import { cn } from "@/lib/utils";

const kindIcon: Record<NotifKind, typeof Bell> = {
  reward: Target,
  match: Swords,
  giveaway: Gift,
  rank: TrendingUp,
  duel: Swords,
};

type Notif = {
  id: string;
  kind: NotifKind;
  title: string;
  created_at: string;
  read: boolean;
  /** Present on duel rows: `{ duel, match }`. Absent before migration 0062. */
  data?: { duel?: string; match?: string } | null;
};

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
  const [pending, setPending] = React.useState<Set<string>>(new Set());
  const [acting, setActing] = React.useState<string | null>(null);
  const [actError, setActError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
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
    const db = createClient();
    const read = (columns: string) =>
      db
        .from("notifications")
        .select(columns)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

    // `data` arrives with migration 0062, and PostgREST fails the whole select
    // on one unknown column — which would empty the bell rather than just drop
    // the duel buttons. Step down instead.
    read("id, kind, title, created_at, read, data").then(({ data, error }) => {
      if (cancelled) return;
      if (!error) {
        setItems((data ?? []) as unknown as Notif[]);
        return;
      }
      read("id, kind, title, created_at, read").then(({ data: base }) => {
        if (!cancelled) setItems((base ?? []) as unknown as Notif[]);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  /**
   * Which of the duels mentioned in the bell are still waiting on an answer.
   *
   * Read fresh each time the panel opens rather than trusted from the
   * notification, because the notification is a record of a moment and the duel
   * is the thing that changes: accepted from the match page, cancelled by the
   * challenger, or closed when the match started. Offering "Прийняти" on a duel
   * that is already settled is worse than offering nothing.
   */
  React.useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    fetch("/api/duels?mine=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const answerable = new Set<string>(
          (d.duels as { id: string; status: string; opponent: { id: string } | null }[])
            .filter((x) => x.status === "open" && x.opponent?.id === d.me)
            .map((x) => x.id),
        );
        setPending(answerable);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, user, nonce]);

  /** Answer a challenge from inside the bell. */
  async function answer(duelId: string, method: "PATCH" | "DELETE") {
    setActing(duelId);
    const res = await fetch("/api/duels", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: duelId }),
    }).catch(() => null);
    const out = await res?.json().catch(() => ({}));
    setActing(null);
    if (!out?.ok) {
      setActError(duelId);
      window.setTimeout(() => setActError(null), 3000);
      return;
    }
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(duelId);
      return next;
    });
    // Both verbs move points, and this bar is the thing showing them.
    refreshProfile();
    setNonce((n) => n + 1);
  }

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
  // The running event's balance, not the last one's. `ewc_points` is what is
  // left of the World Cup — a giveaway wallet now — and reading it here would
  // greet a player at a new event holding points they won at the old one.
  const eventPoints = profile?.event_points ?? 0;

  return (
    /* Impeccable: Crafted Top Bar — opaque, in the canvas's own colour, with no
       seam under it. It used to be 78% surface over a blur, so scrolled content
       ghosted through and the bar read as sliding rather than sitting still.
       z-40 stays: the bar is a stacking context, so the notifications panel can
       only clear the sidebar and bottom bar (both z-30) if the bar itself does. */
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 bg-bg px-3 sm:h-16 sm:px-6">
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
      /* Phones carry three stat capsules, an avatar and a bell across ~360px,
         so each one is a size down there and returns to full at `sm`. */
      <div className="flex items-center gap-1.5 sm:gap-2.5">
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
        {/* The season balance. It stopped being a button when the event
            balance left the bar: the exchange it opened bought a currency that
            is no longer on screen, and an unlabelled control that spends your
            points on something invisible is worse than no control. */}
        <Link
          href="/profile"
          aria-label={`${formatInt(points)} ${t("points")}`}
          className="flex h-8 items-center gap-1 rounded-full bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] pl-1.5 pr-2.5 shadow-[0_0_0_1px_color-mix(in_oklch,var(--accent)_28%,transparent)] transition-colors hover:bg-[color-mix(in_oklch,var(--accent)_18%,transparent)] sm:h-10 sm:gap-1.5 sm:pl-2 sm:pr-3.5"
        >
          <BrandIcon name="points" className="size-4 sm:size-5" priority />
          <span className="tnum font-mono text-xs font-extrabold leading-none text-accent sm:text-sm">
            {formatInt(points)}
          </span>
        </Link>

        {/* The event balance, back for Porto and wearing Porto's gem.

            It came off the bar when EWC ended, and for the right reason: a
            permanent capsule reading 0 for most of the site is the chrome
            telling people they have nothing. What makes it worth carrying now
            is that the event starts everyone level, so the number is a stake
            rather than a scoreboard — and it links into the tournament it is
            spent at. */}
        <Link
          href="/tournaments/blast-porto-2026"
          aria-label={`${formatInt(eventPoints)} — BLAST Open Porto`}
          data-skin="porto"
          className="flex h-8 items-center gap-1 rounded-full bg-[rgb(var(--skin-glow)/0.16)] pl-1 pr-2 shadow-[0_0_0_1px_rgb(var(--skin-ring)/0.32)] transition-colors hover:bg-[rgb(var(--skin-glow)/0.24)] sm:h-9 sm:pl-1.5 sm:pr-2.5"
        >
          <BrandIcon name="points-porto" className="size-4 sm:size-[1.125rem]" priority />
          <span className="tnum font-mono text-xs font-bold leading-none text-[rgb(var(--skin-ring))] sm:text-[0.8125rem]">
            {formatInt(eventPoints)}
          </span>
        </Link>

        <Link
          href="/profile"
          aria-label={`${t("streak")}: ${streak}`}
          className="flex h-8 items-center gap-1 rounded-full bg-fill-2 pl-1 pr-2 shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_8%,transparent)] transition-colors hover:bg-fill-3 sm:h-9 sm:pl-1.5 sm:pr-2.5"
        >
          <BrandIcon name="streak" className="size-4 sm:size-[1.125rem]" priority />
          <span className="tnum font-mono text-xs font-bold leading-none text-accent/85 sm:text-[0.8125rem]">
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
                    const duelId = n.kind === "duel" ? n.data?.duel : undefined;
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

                          {/* Answerable in place. A challenge is the only thing
                              in this panel that somebody else is waiting on, and
                              sending the player to the match page to type two
                              words is a trip for nothing. The buttons appear
                              only while the duel is genuinely still open, which
                              is read from the duel and not from this row. */}
                          {duelId && pending.has(duelId) && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <button
                                onClick={() => answer(duelId, "PATCH")}
                                disabled={acting !== null}
                                className="flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[0.6875rem] font-bold text-black transition-[filter] hover:brightness-110 disabled:opacity-50"
                              >
                                {acting === duelId ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Check className="size-3" strokeWidth={2.75} />
                                )}
                                Прийняти
                              </button>
                              <button
                                onClick={() => answer(duelId, "DELETE")}
                                disabled={acting !== null}
                                className="flex h-7 items-center gap-1 rounded-lg bg-[color-mix(in_oklch,var(--ink)_8%,transparent)] px-2.5 text-[0.6875rem] font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                              >
                                <X className="size-3" strokeWidth={2.75} />
                                Відхилити
                              </button>
                            </div>
                          )}
                          {actError === duelId && (
                            <p role="alert" className="mt-1.5 text-[0.6875rem] font-semibold text-danger">
                              Не вдалося — виклик уже закрито
                            </p>
                          )}
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
