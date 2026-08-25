"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Check, ChevronLeft, Loader2, LogIn, Plus, Swords, X } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Avatar } from "@/components/ui/Avatar";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { useUser } from "@/lib/supabase/use-user";
import { refreshProfile } from "@/lib/supabase/use-profile";
import { getTeam, type Match } from "@/lib/data";
import { cn, formatInt } from "@/lib/utils";

const TIERS = [50, 100, 250, 500];

export type Duel = {
  id: string;
  matchId: string;
  side: "a" | "b";
  stake: number;
  status: string;
  winner: string | null;
  challenger: { id: string; handle: string; avatarUrl: string | null };
  opponent: { id: string; handle: string; avatarUrl: string | null } | null;
};

/**
 * Impeccable: Crafted Duel Board — challenges on the fixture they are about.
 *
 * A duel is always about one match, so this lives on the match rather than in a
 * board of its own. On a global list every row would have to repeat "Aurora —
 * G2" before saying anything; here the fixture is already the page, and a
 * challenge shrinks to what it actually is: a side and a number.
 *
 * There are no odds. The price is the other person's disagreement — a match
 * nobody argues about produces no duels, and that is the market working rather
 * than failing.
 */
export function DuelBoard({ match }: { match: Match }) {
  const user = useUser();
  const [duels, setDuels] = React.useState<Duel[] | null>(null);
  const [me, setMe] = React.useState<string | null>(null);
  const [side, setSide] = React.useState<"a" | "b" | null>(null);
  const [stake, setStake] = React.useState<number>(TIERS[0]);
  const [custom, setCustom] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  // A challenge reserves the stake the instant it is posted, so the last press
  // says what it is about to do rather than doing it.
  const [confirming, setConfirming] = React.useState(false);

  const open = match.status === "upcoming";

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/duels?match=${encodeURIComponent(match.id)}`, { cache: "no-store" })
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
  }, [match.id, user, nonce]);

  const a = getTeam(match.a);
  const b = getTeam(match.b);
  /**
   * Your live position on this fixture, or the result of one.
   *
   * The status test is the whole point. A cancelled challenge is still your row
   * and still comes back from the API, so matching on "am I in it" alone left
   * the card standing after a withdrawal — same stake, same ring colour, only
   * the button gone — which reads as the cancel having failed. Worse, the card
   * displaces the create form, so the fixture became unusable to the one person
   * who had every right to challenge on it again.
   */
  const mine = (duels ?? []).find(
    (d) =>
      (d.challenger.id === me || d.opponent?.id === me) &&
      !["expired", "cancelled", "declined", "void"].includes(d.status),
  );
  // Open to anybody, from somebody else. A challenge with a name on it is not
  // board business even when the name is mine — it is answered above, and
  // listing it in both places offered the same duel twice.
  const board = (duels ?? []).filter(
    (d) => d.status === "open" && d.opponent === null && d.challenger.id !== me,
  );

  const REFUSAL: Record<string, string> = {
    insufficient: "Не вистачає поінтів",
    already_in: "У тебе вже є дуель на цей матч",
    too_many_open: "Забагато відкритих викликів — максимум три",
    started: "Матч уже почався",
    taken: "Виклик уже взяли",
    self: "Це твій власний виклик",
    not_open: "Виклик уже закрито",
    not_yours: "Це не твій виклик",
    not_found: "Виклику вже немає",
  };

  async function send(method: "POST" | "PATCH" | "DELETE", body: object, key: string) {
    setBusy(key);
    setError(null);
    const res = await fetch("/api/duels", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(null);
    if (!out.ok) {
      setError(REFUSAL[out.error as string] ?? "Не вдалося");
      window.setTimeout(() => setError(null), 3000);
      return;
    }
    setSide(null);
    setConfirming(false);
    setNonce((n) => n + 1);
    // Creating, accepting and cancelling all move points. The top bar reads the
    // profile row once and caches it, so without this the deduction lands in the
    // database and the screen keeps showing the old figure until a navigation —
    // which reads exactly like the points were never taken.
    refreshProfile();
  }

  return (
    <section className="space-y-3">
      {/* Built to the same rule as the page's other section headings — 13px,
          uppercase, a 16px glyph in the subtle ink — rather than approximated.
          A heading that is nearly the same as its neighbours is worse than one
          that is plainly different. */}
      <h2 className="flex items-center gap-2.5 pl-1 text-[0.8125rem] font-bold uppercase tracking-wide text-ink-muted">
        <Swords className="size-4 shrink-0 text-ink-subtle" />
        Дуелі
      </h2>

      <div className="skin-aura-card space-y-3 rounded-xl p-3 sm:p-4">
        {mine ? (
          <MyDuel duel={mine} me={me} a={match.a} b={match.b} open={open} onAct={send} busy={busy} />
        ) : !user ? (
          <Link
            href="/login"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[rgb(var(--skin-ring))] text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            <LogIn className="size-4" strokeWidth={2.5} />
            Увійти, щоб кинути виклик
          </Link>
        ) : !open ? (
          <p className="py-1 text-xs text-white/45">Матч почався — нові виклики закрито.</p>
        ) : (
          <>
            {/* Side first, then stake. Picking a number before deciding who you
                are backing is choosing how much to risk on nothing. */}
            <div className="grid grid-cols-2 gap-2">
              {(["a", "b"] as const).map((s) => {
                const t = s === "a" ? a : b;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setSide(s);
                      setConfirming(false);
                    }}
                    aria-pressed={side === s}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                      side === s
                        ? "bg-[rgb(var(--skin-ring)/0.22)] text-white shadow-[inset_0_0_0_1px_rgb(var(--skin-ring)/0.6)]"
                        : "bg-black/30 text-white/70 hover:bg-black/45",
                    )}
                  >
                    <TeamLogo team={t} size="xs" />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Four quick amounts and a way past them, built like the bet
                slip's — same chips, same swap to a field, same way back. The
                four were once the only legal figures, on the theory that a
                challenge has to find a pair; but nothing here pairs anybody
                automatically, so a row saying 137 is as pressable as one
                saying 100. */}
            {custom ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setCustom(false);
                    setStake(TIERS[0]);
                    setConfirming(false);
                  }}
                  aria-label="Назад до сум"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white/60 transition-colors hover:bg-white/[0.12]"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={stake || ""}
                  placeholder="Своя сума"
                  aria-label="Своя сума"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 7);
                    setStake(digits ? Number(digits) : 0);
                    setConfirming(false);
                  }}
                  className={cn(
                    "tnum h-9 min-w-0 flex-1 rounded-lg bg-white/[0.06] text-center font-mono text-sm font-bold leading-none text-white transition-colors",
                    "placeholder:font-sans placeholder:text-sm placeholder:font-semibold placeholder:leading-none placeholder:text-white/40",
                    "outline-none focus:bg-white/[0.12] focus-visible:outline-none! focus-visible:rounded-lg!",
                  )}
                />
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1.5">
                {TIERS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setStake(c);
                      setConfirming(false);
                    }}
                    className={cn(
                      "tnum h-9 rounded-lg font-mono text-xs font-bold transition-colors",
                      stake === c
                        ? "bg-[rgb(var(--skin-ring))] text-black"
                        : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12]",
                    )}
                  >
                    {c}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setCustom(true);
                    setStake(0);
                    setConfirming(false);
                  }}
                  aria-label="Своя сума"
                  className="grid h-9 place-items-center rounded-lg bg-white/[0.06] text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white"
                >
                  <Plus className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            )}

            <button
              onClick={() =>
                confirming
                  ? send("POST", { match: match.id, side, stake }, "create")
                  : setConfirming(true)
              }
              disabled={!side || stake < 1 || busy !== null}
              className={cn(
                "flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-opacity",
                "bg-[rgb(var(--skin-ring))] text-black hover:brightness-110",
                "disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/35",
              )}
            >
              {busy === "create" && <Loader2 className="size-4 animate-spin" />}
              {!side
                ? "Обери бік"
                : stake < 1
                  ? "Впиши суму"
                  : confirming
                    ? "Так, виставляю"
                    : `Кинути виклик · ${formatInt(stake)}`}
            </button>

            {/* A caption under the control it qualifies, not a panel above it.
                The warning is one short sentence and the plate it used to sit
                in was as loud as the button, which made the quieter of the two
                look like the thing being confirmed. */}
            {confirming && side && (
              <p className="px-1 text-center text-[0.6875rem] leading-snug text-white/45">
                {formatInt(stake)} поінтів зарезервуються одразу, доки виклик хтось не візьме.
              </p>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="text-center text-xs font-semibold text-danger">
            {error}
          </p>
        )}

        {/* Open challenges from other people, which is the board proper. */}
        {board.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-white/40">
              Відкриті виклики
            </p>
            {board.map((d) => {
              const backed = d.side === "a" ? a : b;
              const against = d.side === "a" ? b : a;
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-2"
                >
                  <Avatar name={d.challenger.handle} src={d.challenger.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
                    {d.challenger.handle}
                    <span className="ml-1.5 font-normal text-white/45">на {backed.tag}</span>
                  </span>
                  <span className="tnum flex shrink-0 items-center gap-1 font-mono text-xs font-bold text-[rgb(var(--skin-ring))]">
                    <BrandIcon name="points-porto" className="size-3.5" />
                    {formatInt(d.stake)}
                  </span>
                  {/* The button says which side taking it puts you on. "Взяти"
                      alone asks a player to work out the opposite of somebody
                      else's pick, every time. */}
                  <button
                    onClick={() => send("PATCH", { id: d.id }, d.id)}
                    disabled={busy !== null || !user || !open || !!mine}
                    className="h-8 shrink-0 rounded-lg bg-white/[0.08] px-2.5 text-[0.6875rem] font-bold text-white transition-colors hover:bg-white/[0.16] disabled:opacity-35"
                  >
                    {busy === d.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      `За ${against.tag}`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
}

/** Your own duel on this fixture — one per match, so there is only ever one. */
function MyDuel({
  duel,
  me,
  a,
  b,
  open,
  onAct,
  busy,
}: {
  duel: Duel;
  me: string | null;
  a: string;
  b: string;
  open: boolean;
  onAct: (m: "POST" | "PATCH" | "DELETE", body: object, key: string) => void;
  busy: string | null;
}) {
  const iAmChallenger = duel.challenger.id === me;
  const mySide: "a" | "b" = iAmChallenger ? duel.side : duel.side === "a" ? "b" : "a";
  const backed = getTeam(mySide === "a" ? a : b);
  const other = iAmChallenger ? duel.opponent : duel.challenger;
  const settled = duel.status === "settled";
  const won = settled && duel.winner === me;
  const [confirming, setConfirming] = React.useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5 rounded-lg bg-black/30 px-3 py-2.5">
        <TeamLogo team={backed} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white">
            Ти на {backed.name}
          </p>
          <p className="truncate text-[0.6875rem] text-white/45">
            {!other
              ? "чекає на суперника"
              : duel.status === "open" && !iAmChallenger
                ? `${other.handle} викликав тебе`
                : `проти ${other.handle}`}
          </p>
        </div>
        <span
          className={cn(
            "tnum flex shrink-0 items-center gap-1 font-mono text-sm font-bold",
            settled ? (won ? "text-success" : "text-white/35") : "text-[rgb(var(--skin-ring))]",
          )}
        >
          <BrandIcon name="points-porto" className="size-4" />
          {settled ? (won ? `+${formatInt(duel.stake * 2)}` : "—") : formatInt(duel.stake)}
        </span>
      </div>

      {/* An open duel can still be undone, and which way depends on which end
          of it you are. Once it is matched neither is offered: the stake is
          somebody else's position too, and no single player may hand back what
          the other has committed. */}
      {duel.status === "open" && open && (iAmChallenger ? (
        <button
          onClick={() => onAct("DELETE", { id: duel.id }, "withdraw")}
          disabled={busy !== null}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] text-xs font-semibold text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
        >
          {busy === "withdraw" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <X className="size-3.5" strokeWidth={2.5} />
          )}
          Забрати виклик · поінти повернуться
        </button>
      ) : (
        <div className="space-y-2">
          {/* Accepting is the only one of the two that costs anything, so it is
              the only one that asks twice. Declining moves nobody's points but
              the challenger's, and moves them home. */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              onClick={() =>
                confirming ? onAct("PATCH", { id: duel.id }, "accept") : setConfirming(true)
              }
              disabled={busy !== null}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[rgb(var(--skin-ring))] text-xs font-bold text-black transition-[filter] hover:brightness-110 disabled:opacity-50"
            >
              {busy === "accept" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" strokeWidth={2.5} />
              )}
              {confirming ? "Так, приймаю" : `Прийняти · ${formatInt(duel.stake)}`}
            </button>
            <button
              onClick={() => onAct("DELETE", { id: duel.id }, "withdraw")}
              disabled={busy !== null}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-xs font-semibold text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
            >
              {busy === "withdraw" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" strokeWidth={2.5} />
              )}
              Відхилити
            </button>
          </div>

          {confirming && (
            <p className="px-1 text-center text-[0.6875rem] leading-snug text-white/45">
              Ставиш {formatInt(duel.stake)} на {backed.name}. Переможець забирає{" "}
              {formatInt(duel.stake * 2)}.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
