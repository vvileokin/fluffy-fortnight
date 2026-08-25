"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Check, Loader2, Swords, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { useUser } from "@/lib/supabase/use-user";
import { getTeam, type Match } from "@/lib/data";
import { cn, formatInt } from "@/lib/utils";
import type { Duel } from "@/components/match/DuelBoard";

/**
 * Impeccable: Crafted Duel Ledger — every challenge you are in, in one place.
 *
 * The board on a match answers "what is on offer here". This answers the other
 * question, which nothing else on the site can: what have I got riding, and how
 * did the last ones go. Without it a player has to remember which fixtures they
 * challenged on and visit each one.
 *
 * Waiting first, then decided. A challenge nobody has taken is the only row
 * that still needs a decision from anybody, so it cannot be below the history.
 */
export function MyDuels({ matches }: { matches: Match[] }) {
  const user = useUser();
  const [duels, setDuels] = React.useState<Duel[] | null>(null);
  const [me, setMe] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/duels?mine=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setDuels(d.duels as Duel[]);
        setMe(d.me ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  const byId = React.useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);

  /** Accept or turn down — one call, because they differ only in the verb. */
  async function act(id: string, method: "PATCH" | "DELETE") {
    setBusy(id);
    await fetch("/api/duels", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    setBusy(null);
    setNonce((n) => n + 1);
  }

  if (!user) return null;

  const live = (duels ?? []).filter((d) => d.status === "open" || d.status === "matched");
  // Settled only. A duel that was voided or never taken gave everyone their
  // stake back — nobody won, nobody lost, nothing happened — so it has no
  // business sitting in a ledger of results. The refund is the whole story and
  // the balance already tells it.
  const done = (duels ?? []).filter((d) => d.status === "settled");
  const won = done.filter((d) => d.winner === me).length;
  const lost = done.length - won;

  return (
    <div className="skin-aura-card space-y-3 rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-white">
          <Swords className="size-4 text-[rgb(var(--skin-ring))]" />
          Мої дуелі
        </p>
        {/* The record, not a points total. Duels deliberately stay out of the
            season streak — two accounts trading losses could pump one — so this
            tally is the whole of their prestige. */}
        {done.length > 0 && (
          <span className="tnum font-mono text-xs font-bold text-white/60">
            {won}–{lost}
          </span>
        )}
      </div>

      {duels === null ? (
        <p className="py-1 text-xs text-white/40">Завантажуємо…</p>
      ) : live.length + done.length === 0 ? (
        <p className="text-xs leading-relaxed text-white/45">
          Ще жодної. Виклик кидається з лідерборду — на конкретну людину — або зі
          сторінки матчу, на будь-кого.
        </p>
      ) : (
        <div className="space-y-1.5">
          {[...live, ...done].map((d) => (
            <DuelRow
              key={d.id}
              duel={d}
              me={me}
              match={byId.get(d.matchId)}
              busy={busy === d.id}
              onAccept={() => act(d.id, "PATCH")}
              onWithdraw={() => act(d.id, "DELETE")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DuelRow({
  duel,
  me,
  match,
  busy,
  onAccept,
  onWithdraw,
}: {
  duel: Duel;
  me: string | null;
  match?: Match;
  busy: boolean;
  onAccept: () => void;
  onWithdraw: () => void;
}) {
  const iAmChallenger = duel.challenger.id === me;
  const mySide: "a" | "b" = iAmChallenger ? duel.side : duel.side === "a" ? "b" : "a";
  const backed = match ? getTeam(mySide === "a" ? match.a : match.b) : null;
  const other = iAmChallenger ? duel.opponent : duel.challenger;
  const settled = duel.status === "settled";
  const won = settled && duel.winner === me;
  const [armed, setArmed] = React.useState(false);

  const body = (
    <div className="flex items-center gap-2.5 rounded-lg bg-black/30 px-2.5 py-2">
      {backed ? (
        <TeamLogo team={backed} size="xs" />
      ) : (
        <span className="size-5 shrink-0 rounded bg-white/5" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white">
          {other ? other.handle : "чекає на суперника"}
        </p>
        <p className="truncate text-[0.6875rem] text-white/40">
          {backed ? `ти на ${backed.tag}` : "матч"}
          {match ? ` · ${getTeam(match.a).tag} — ${getTeam(match.b).tag}` : ""}
        </p>
      </div>

      {other && <Avatar name={other.handle} src={other.avatarUrl} size="sm" />}

      <span
        className={cn(
          "tnum flex shrink-0 items-center gap-1 font-mono text-xs font-bold",
          settled ? (won ? "text-success" : "text-white/30") : "text-[rgb(var(--skin-ring))]",
        )}
      >
        <BrandIcon name="points-porto" className="size-3.5" />
        {settled
          ? won
            ? `+${formatInt(duel.stake * 2)}`
            : `−${formatInt(duel.stake)}`
          : formatInt(duel.stake)}
      </span>

      {/* Only an untaken challenge can be undone. Once somebody has staked
          against it, it is their position too.

          The challenger gets one control; the person being challenged gets
          two, because a challenge aimed at you is a question and "no" is only
          half an answer. Accepting arms first — it is the one press here that
          spends points, and the row it sits in is small and scrollable. */}
      {duel.status === "open" &&
        (iAmChallenger ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              onWithdraw();
            }}
            aria-label="Забрати виклик"
            title="Забрати виклик — поінти повернуться"
            className="grid size-7 shrink-0 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={(e) => {
                e.preventDefault();
                if (armed) onAccept();
                else setArmed(true);
              }}
              aria-label={armed ? "Підтвердити" : "Прийняти виклик"}
              title={armed ? "Ще раз — і ставка піде" : `Прийняти · ${formatInt(duel.stake)}`}
              className={cn(
                "grid h-7 shrink-0 place-items-center rounded-lg px-1.5 transition-colors",
                armed
                  ? "bg-[rgb(var(--skin-ring))] text-black"
                  : "text-white/40 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                onWithdraw();
              }}
              aria-label="Відхилити виклик"
              title="Відхилити — поінти повернуться суперникові"
              className="grid size-7 shrink-0 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
            </button>
          </div>
        ))}
    </div>
  );

  return match ? (
    <Link href={`/matches/${match.id}`} className="block transition-opacity hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}
