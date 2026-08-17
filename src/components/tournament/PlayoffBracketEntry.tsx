"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Check, Loader2, Lock, LogIn, Pencil } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { useUser } from "@/lib/supabase/use-user";
import { getTeam } from "@/lib/data";
import { BRACKET_MAX, type BracketPicks } from "@/lib/bracket-scoring";
import { cn, formatInt } from "@/lib/utils";

type Api = {
  signedIn: boolean;
  open: boolean;
  started: boolean;
  teams: string[];
  mine: { picks: BracketPicks; points: number; scored: boolean } | null;
};

/**
 * The four rounds, named for the match being played rather than the round being
 * reached. `key` is still the round the winners *arrive* in, because that is
 * what the scoring counts.
 */
const ROUNDS = [
  { key: "qf" as const, label: "1/8", pairs: 8 },
  { key: "sf" as const, label: "1/4", pairs: 4 },
  { key: "final" as const, label: "1/2", pairs: 2 },
  { key: "champion" as const, label: "Фінал", pairs: 1 },
];

type Picks = Record<string, (string | null)[]>;

/**
 * Impeccable: Crafted Bracket Entry — the playoff, called one match at a time.
 *
 * Rebuilt from a checklist into the bracket itself. Asking for "eight of these
 * sixteen" was the honest description of the scoring and the wrong thing to put
 * in front of a person: sixteen names in a flat list hide the one fact the
 * decision turns on, which is who plays whom. Tapping a winner inside a fixture
 * is how everybody already reads a bracket, it cannot produce an impossible
 * entry, and it needs no instructions — which is what takes the wall of text
 * off the phone.
 *
 * The submitted shape is unchanged: the winners of each round are exactly the
 * set that reached the next one, so set-based scoring still applies.
 */
export function PlayoffBracketEntry() {
  const user = useUser();
  const [data, setData] = React.useState<Api | null>(null);
  const [round, setRound] = React.useState(0);
  const [picks, setPicks] = React.useState<Picks>({});
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/bracket", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  if (!data) return null;

  // Filled in and not being re-edited. Still open means it can be changed —
  // nothing is paid until the playoff ends, so there is no reason to make an
  // early entry final, and every reason not to punish filling it in first.
  if (data.mine && !editing) {
    return (
      <Panel>
        <Head />
        <div className="flex items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--success)_12%,transparent)] px-3 py-2.5 text-sm font-semibold text-success">
          <Check className="size-4 shrink-0" strokeWidth={3} />
          Сітку заповнено
        </div>
        <Filled picks={data.mine.picks} />
        <p className="text-xs text-ink-subtle">
          {data.mine.scored ? (
            <>
              Нараховано{" "}
              <span className="tnum font-bold text-[rgb(255_154_64)]">
                +{formatInt(data.mine.points)}
              </span>{" "}
              EWC.
            </>
          ) : (
            "Бали — після завершення плей-офу."
          )}
        </p>
        {data.open && !data.mine.scored && (
          <button
            onClick={() => {
              setPicks({
                qf: [...data.mine!.picks.qf],
                sf: [...data.mine!.picks.sf],
                final: [...data.mine!.picks.final],
                champion: [data.mine!.picks.champion],
              });
              setRound(0);
              setEditing(true);
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-white/[0.06] text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.12]"
          >
            <Pencil className="size-3.5" />
            Змінити
          </button>
        )}
      </Panel>
    );
  }

  if (!data.signedIn) {
    return (
      <Panel>
        <Head />
        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[rgb(198_96_40)] text-sm font-bold text-[#1a0a0d] transition-colors hover:bg-[rgb(219_112_52)]"
        >
          <LogIn className="size-4" strokeWidth={2.5} />
          Увійти, щоб заповнити
        </Link>
      </Panel>
    );
  }

  if (!data.open) {
    return (
      <Panel>
        <Head />
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" />
          {data.started
            ? "Плей-оф уже почався — сітку закрито."
            : "Прийом прогнозів закрито."}
        </p>
      </Panel>
    );
  }

  /* ---- the form ---- */

  // Round 0 is the published draw; every later round is fed by the winners the
  // player named in the one before it, so the fixtures build themselves.
  const feed = (r: number): (string | null)[] =>
    r === 0 ? data.teams : picks[ROUNDS[r - 1].key] ?? [];
  const slots = (r: number) => picks[ROUNDS[r].key] ?? Array(ROUNDS[r].pairs).fill(null);

  const filled = (r: number) => slots(r).every(Boolean);
  // A round is reachable once the one before it is complete — that's also what
  // makes the stepper safe to click backwards through.
  const reachable = (r: number) => r === 0 || filled(r - 1);

  function pick(r: number, pair: number, slug: string) {
    setError(null);
    setPicks((prev) => {
      const next: Picks = { ...prev };
      const cur = [...(next[ROUNDS[r].key] ?? Array(ROUNDS[r].pairs).fill(null))];
      cur[pair] = slug;
      next[ROUNDS[r].key] = cur;

      // Changing a winner invalidates the fixture it fed into, and whatever
      // that fed in turn. Only that chain is cleared — re-picking one match
      // shouldn't wipe the other half of the bracket the player already filled.
      let idx = pair;
      for (let d = r + 1; d < ROUNDS.length; d++) {
        idx = Math.floor(idx / 2);
        const down = next[ROUNDS[d].key];
        if (!down) break;
        const copy = [...down];
        copy[idx] = null;
        next[ROUNDS[d].key] = copy;
      }
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/bracket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        picks: {
          qf: picks.qf,
          sf: picks.sf,
          final: picks.final,
          champion: (picks.champion ?? [])[0],
        },
      }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!out.ok) {
      setError(
        out.error === "already_scored"
          ? "Сітку вже розраховано."
          : out.error === "closed" || out.error === "not_open"
            ? "Прийом прогнозів закрито."
            : "Не вдалося зберегти. Спробуй ще раз.",
      );
    } else {
      setEditing(false);
    }
    setNonce((n) => n + 1);
  }

  const current = ROUNDS[round];
  const pairs = feed(round);
  const chosen = slots(round);
  const done = filled(round);
  const last = round === ROUNDS.length - 1;

  return (
    <Panel>
      <Head />

      {/* The stepper is the only running commentary the form needs: which round
          you're in, how far along, and a way back to change a call. */}
      <div className="flex items-center gap-1">
        {ROUNDS.map((r, i) => {
          const ok = filled(i);
          return (
            <button
              key={r.key}
              disabled={!reachable(i)}
              onClick={() => setRound(i)}
              className={cn(
                "flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-xs font-bold transition-colors",
                i === round
                  ? "bg-[rgb(198_96_40)] text-[#1a0a0d]"
                  : ok
                    ? "bg-[rgb(198_96_40/0.28)] text-[rgb(255_178_112)]"
                    : "bg-black/30 text-white/35",
                reachable(i) ? "cursor-pointer" : "cursor-not-allowed",
              )}
            >
              {ok && i !== round && <Check className="size-3" strokeWidth={3} />}
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Fixtures. Two across from `sm` so the later rounds don't leave a
          near-empty card floating in a wide column. */}
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: current.pairs }, (_, i) => {
          const a = pairs[i * 2] ?? null;
          const b = pairs[i * 2 + 1] ?? null;
          return (
            <div
              key={i}
              className="overflow-hidden rounded-lg bg-black/30 shadow-[inset_0_0_0_1px_rgb(255_120_50/0.16)]"
            >
              {[a, b].map((slug, side) => {
                const t = slug ? getTeam(slug) : undefined;
                const on = !!slug && chosen[i] === slug;
                return (
                  <button
                    key={side}
                    disabled={!slug}
                    onClick={() => slug && pick(round, i, slug)}
                    aria-pressed={on}
                    className={cn(
                      "flex h-11 w-full items-center gap-2 px-2.5 text-left transition-colors",
                      side === 1 && "shadow-[0_-1px_0_0_rgb(255_255_255/0.07)]",
                      on
                        ? "bg-[rgb(255_122_44/0.22)]"
                        : slug
                          ? "hover:bg-white/[0.05]"
                          : "",
                    )}
                  >
                    {t ? (
                      <TeamLogo team={t} size="xs" />
                    ) : (
                      <span className="size-5 shrink-0 rounded bg-white/5" />
                    )}
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-xs font-semibold",
                        on ? "text-white" : t ? "text-white/70" : "text-white/30",
                      )}
                    >
                      {t?.name ?? "—"}
                    </span>
                    {on && (
                      <Check
                        className="size-3.5 shrink-0 text-[rgb(255_154_64)]"
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}

      <button
        onClick={() => (last ? submit() : setRound((r) => r + 1))}
        disabled={!done || busy}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors",
          "bg-[rgb(198_96_40)] text-[#1a0a0d] hover:bg-[rgb(219_112_52)]",
          "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[rgb(255_122_44)]",
        )}
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {last ? "Зберегти сітку" : "Далі"}
      </button>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="ewc-aura-card space-y-2.5 rounded-xl p-3 sm:p-4">{children}</div>;
}

/**
 * One line, not a paragraph. The old intro spent five lines explaining
 * set-based scoring before the player could touch anything — on a phone that
 * was the whole first screen. The rule it was explaining only matters once the
 * bracket is submitted, and the fixtures now teach the form by themselves.
 */
function Head() {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-extrabold tracking-tight text-white">Сітка плей-офу</p>
      <span className="tnum flex shrink-0 items-center gap-1 text-xs font-bold text-[rgb(255_154_64)]">
        до {formatInt(BRACKET_MAX)}
        <BrandIcon name="points-ewc" className="size-3.5" />
      </span>
    </div>
  );
}

/** A submitted bracket, read-only — champion first, then back down the rounds. */
function Filled({ picks }: { picks: BracketPicks }) {
  const rows = [
    { label: "Чемпіон", teams: [picks.champion] },
    { label: "Фінал", teams: picks.final },
    { label: "1/2", teams: picks.sf },
    { label: "1/4", teams: picks.qf },
  ];
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start gap-2">
          <span className="w-12 shrink-0 pt-1 text-[0.625rem] font-bold uppercase tracking-wide text-white/40">
            {r.label}
          </span>
          <div className="flex flex-wrap gap-1">
            {r.teams.map((slug) => {
              const t = getTeam(slug);
              return (
                <span
                  key={slug}
                  className="flex items-center gap-1 rounded bg-black/35 px-1.5 py-1 text-[0.6875rem] font-semibold text-white"
                >
                  {t && <TeamLogo team={t} size="xs" />}
                  {t?.name ?? slug}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
