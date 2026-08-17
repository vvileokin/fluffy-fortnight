"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Check, Flame } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { getMatch, matchTeam, teamByLabel, teams, type Question, type Match } from "@/lib/data";
import { useUser } from "@/lib/supabase/use-user";
import { useProfile } from "@/lib/supabase/use-profile";
import { createClient } from "@/lib/supabase/client";
import { applyStreak, streakMultiplier } from "@/lib/streak";
import { BetSlip, type Bet } from "@/components/match/BetSlip";
import { SponsorStrip } from "@/components/ui/BetkingMark";
import { cn } from "@/lib/utils";

/**
 * The streak badge, worn by whichever number the streak is currently lifting —
 * a flat payout or a coefficient. Same mark on both, because it is the same
 * multiplier: a player should not have to work out that the thing boosting
 * their points also boosts their winnings.
 */
function StreakChip({ multiplier }: { multiplier: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-current/15 px-1 py-px text-[0.625rem] font-bold leading-none">
      <Flame className="size-2.5" />×{multiplier}
    </span>
  );
}

export function QuestionCard({
  question,
  withMatch = false,
  match: matchProp,
}: {
  question: Question;
  withMatch?: boolean;
  match?: Match;
}) {
  const user = useUser();
  const { profile } = useProfile();
  const router = useRouter();
  // Signed out, everyone sees the base rate — there's no run to multiply yet.
  const streak = profile?.streak ?? 0;
  const multiplier = streakMultiplier(streak);
  const [picked, setPicked] = React.useState<string | undefined>();
  const [justSaved, setJustSaved] = React.useState(false);
  const [bet, setBet] = React.useState<Bet | null>(null);
  const [betNonce, setBetNonce] = React.useState(0);

  // A betting question stakes points instead of handing them out, so the two
  // never mix on one card: odds replace the flat payout, and the slip replaces
  // the "you can change this until the deadline" footer.
  const betting = !!question.betting;

  const locked = question.status === "locked" || question.status === "resolved";
  const upcoming = question.status === "upcoming";
  // Prefer the passed match (works for DB matches); fall back to the static catalog.
  const match = matchProp ?? (withMatch ? getMatch(question.matchId) : undefined);
  // Questions wear their event. EWC swaps the brand yellow for the event's
  // ember on every selected/‌payout cue, so a prediction on an EWC match
  // doesn't look like it belongs to the season board.
  const isEwc = match?.tournamentSlug === "ewc-2026";

  // Load this user's saved answer.
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    createClient()
      .from("predictions")
      .select("option_id")
      .eq("question_id", question.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setPicked(data.option_id);
      });
    return () => {
      cancelled = true;
    };
  }, [user, question.id]);

  // A betting question's slip is the record, so there is nothing to load from
  // `predictions` and nothing to write there either.
  React.useEffect(() => {
    if (!betting || !user) return;
    let cancelled = false;
    fetch(`/api/bets?question=${encodeURIComponent(question.id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setBet(d.bet as Bet | null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [betting, user, question.id, betNonce]);

  async function choose(id: string) {
    if (locked || upcoming) return;
    if (!user) {
      router.push("/login");
      return;
    }
    // Selecting an option on a betting question commits nothing — the stake
    // does. Writing a prediction row here would record an answer the player
    // never actually paid for.
    if (betting) {
      if (!bet) setPicked(id);
      return;
    }
    setPicked(id);
    setJustSaved(true);
    await createClient()
      .from("predictions")
      .upsert(
        { user_id: user.id, question_id: question.id, option_id: id, updated_at: new Date().toISOString() },
        { onConflict: "user_id,question_id" },
      );
    window.setTimeout(() => setJustSaved(false), 1600);
  }

  // An option label like "Liquid" or "NAVI" gets a crest; "Більше 24.5" gets
  // none. The two sides of this match are checked first because imported teams
  // (PandaScore, admin-created) exist on the match but not in the static
  // catalog — fnatic is one of them.
  const sides = match ? [matchTeam(match, "a"), matchTeam(match, "b")] : [];

  /**
   * Which side(s) a scoreline belongs to — "2:0" is the home team, "0:2" the
   * away one, "2:1 / 1:2" is either.
   *
   * A score option names a team just as plainly as a winner option does, it
   * just spells it with digits. Reading it back out means the exact-score card
   * can wear the same crests as the winner card above it, instead of three
   * identical grey dots that make the reader map "2:0" onto a side themselves.
   */
  function scoreCrests(label: string) {
    if (sides.length !== 2) return null;
    const legs = label.split("/").map((s) => s.trim());
    const sidesHit = new Set<0 | 1>();
    for (const leg of legs) {
      const m = /^(\d+)\s*[:\-–]\s*(\d+)$/.exec(leg);
      if (!m) return null; // not a scoreline at all — leave it to the dot
      const [x, y] = [Number(m[1]), Number(m[2])];
      if (x === y) return null; // a draw names nobody
      sidesHit.add(x > y ? 0 : 1);
    }
    if (sidesHit.size === 0) return null;
    return [...sidesHit].sort().map((i) => sides[i]);
  }
  function resolveTeam(label: string) {
    const key = label.trim().toLowerCase();
    // First check exact match in match sides
    let t = sides.find(
      (t) => t.name.toLowerCase() === key || t.tag.toLowerCase() === key,
    );
    if (t) return t;
    // Then try catalog by exact match
    t = teamByLabel(label);
    if (t) return t;
    // Finally, try partial match: "BetBoom" → "BetBoom Team"
    return Object.values(teams).find(
      (team) => team.name.toLowerCase().includes(key)
    );
  }

  // Nothing to say on an untouched, open question — the options speak for
  // themselves — so the footer collapses rather than reserving a line.
  // What the run is worth, and what dropping it costs. The multiplier is
  // already on every option; this says the part a number can't — that it holds
  // only while the streak does, and that a miss simply pays the base rate
  // rather than taking anything away.
  const streakNote =
    multiplier > 1 && !locked && !upcoming ? (
      <span className="flex items-center gap-1 text-[rgb(255_154_64)]">
        <Flame className="size-3.5 shrink-0" />
        Серія {streak} — виграш ×{multiplier}. Схибиш — серія згорить і далі
        рахуватиметься як звичайно.
      </span>
    ) : null;

  const footer = justSaved ? (
    <span className="flex items-center gap-1 font-semibold text-success">
      <Check className="size-3.5" strokeWidth={3} /> Збережено
    </span>
  ) : streakNote ? (
    streakNote
  ) : locked ? (
    picked ? <span className="text-ink-subtle">Твій вибір зафіксовано</span> : null
  ) : picked ? (
    <span className="text-ink-subtle">Можна змінити до дедлайну</span>
  ) : upcoming ? (
    <span className="text-ink-subtle">Відкриється перед матчем</span>
  ) : null;

  return (
    /* Impeccable: Crafted Prediction Slate — rebuilt as a selector, not a
       table. The two-tone rows split every option into a grey half and a
       yellow half and fought the scoreboard for attention; now the options
       sit as equal segments inside one recessed track, each carrying its own
       label over its own payout, and picking one lights the whole segment.
       Same control language as the filter tabs and tournament switch, so the
       page has one way of saying "this one is selected". */
    <div
      className={cn(
        "overflow-hidden rounded-2xl",
        isEwc ? "ewc-match" : "surface-1",
      )}
    >
      {/* The "which match is this" row belongs to feeds that mix matches
          together. `withMatch` is what asks for it — the match page passes
          `match` purely so the options can resolve their crests, and would
          otherwise render a link back to the page you're already on. */}
      {withMatch && match && (
        <Link
          href={`/matches/${match.id}`}
          className="flex min-h-8 items-center gap-2 px-3 py-1 text-xs text-ink-muted shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] transition-colors hover:text-ink"
        >
          <TeamLogo team={matchTeam(match, "a")} size="xs" />
          <span className="truncate font-semibold">{matchTeam(match, "a").name}</span>
          <span className="shrink-0 text-ink-faint">vs</span>
          <span className="truncate font-semibold">{matchTeam(match, "b").name}</span>
          <TeamLogo team={matchTeam(match, "b")} size="xs" />
          <span className="ml-auto truncate text-ink-subtle">{match.stage}</span>
        </Link>
      )}

      <div className="p-3">
        {/* Just the question. The deadline chip that used to sit here read
            "до старту матчу" — a restatement of the rule every question follows,
            not a time — so it cost a rail and told nobody anything. */}
        <h3 className="text-sm font-bold leading-snug text-ink text-balance">
          {question.title}
        </h3>

        {/* Impeccable: Crafted Choice Row — the options wear the teams. Each
            one is raked with that side's real brand colour, the same light the
            match header, the veto ledger and the mobile scorelines already use,
            so picking a winner looks like picking *that team* rather than
            operating a generic control. Options that aren't teams (over/under,
            map counts) fall back to a neutral plate and still line up. */}
        <div
          className={cn(
            "mt-2 grid gap-2",
            // Three across only once there's width for it. On a phone a third
            // of the card leaves ~40px for the label, so "2:1 / 1:2" came out
            // as "2:1…" — the option couldn't say what it was. Stacked, each
            // one gets the full width and the crests stay full size.
            question.options.length > 2 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2",
          )}
        >
          {question.options.map((opt) => {
            const selected = picked === opt.id;
            const optTeam = resolveTeam(opt.label);
            // Keyed off the label parsing as a scoreline, not off `kind`. The
            // crests vanished on the betting cards because those are authored
            // as `custom` — `kind` is a label an admin picks, so gating a
            // visual on it means the crests appear or don't depending on a
            // dropdown nobody connects to the outcome. A "2:0" against two
            // known sides names one of them whatever the question is called.
            const crests = !optTeam ? scoreCrests(opt.label) : null;
            // The plate is tinted by whichever side the option backs. Split
            // scorelines back both, so they stay neutral rather than picking
            // one team's colour to stand for a two-team answer.
            const tint = optTeam ?? (crests?.length === 1 ? crests[0] : undefined);
            return (
              <button
                key={opt.id}
                onClick={() => choose(opt.id)}
                disabled={locked || upcoming}
                aria-pressed={selected}
                style={
                  tint
                    ? ({
                        backgroundImage: `linear-gradient(100deg, color-mix(in oklch, ${tint.brand} ${selected ? 26 : 13}%, transparent), transparent 68%)`,
                      } as CSSProperties)
                    : undefined
                }
                className={cn(
                  // `rounded-md` (12px), not `rounded-xl` (20px): the crest
                  // inside sits 5px in with a 7px radius, and nested boxes only
                  // look right when their curves are concentric — inner radius
                  // equals outer minus the gap. At 20px the plate curved away
                  // from a crest that then read as a square in a pill.
                  // The left inset matches the 5px the crest already has above
                  // and below it, so the logo sits in an even margin on three
                  // sides instead of floating 10px in from the edge. The right
                  // keeps its full padding — that side holds text, not a tile.
                  "group/opt relative flex h-[2.75rem] min-w-0 items-center gap-2 overflow-hidden rounded-md pl-[0.3125rem] pr-2.5 text-left",
                  "transition-[background-color,box-shadow,transform,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "active:scale-[0.99] motion-reduce:active:scale-100 disabled:cursor-not-allowed",
                  // On the event the option plate is a well cut into the ember
                  // floor, not a navy chip sitting on top of it.
                  isEwc ? "bg-black/35" : "bg-surface-2",
                  selected
                    ? isEwc
                      ? "shadow-[0_0_0_1px_rgb(255_122_44/0.7),0_4px_18px_-14px_rgb(255_122_44/0.6)]"
                      : "shadow-[0_0_0_1px_color-mix(in_oklch,var(--accent)_65%,transparent),0_4px_16px_-14px_color-mix(in_oklch,var(--accent)_45%,transparent)]"
                    : isEwc
                      ? "shadow-[0_0_0_1px_rgb(255_120_50/0.18)] hover:shadow-[0_0_0_1px_rgb(255_120_50/0.4)]"
                      : "shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_8%,transparent)] hover:shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_18%,transparent)]",
                  (locked || upcoming) && !selected && "opacity-55",
                )}
              >
                {optTeam ? (
                  <TeamLogo team={optTeam} size="cardCrest" />
                ) : crests ? (
                  // Same 34px crest as a winner option — a split scoreline just
                  // shows both, overlapped, so the pair still reads as one mark
                  // in the slot rather than two separate logos competing with
                  // the label for the row's width.
                  <span className="flex shrink-0 items-center">
                    {crests.map((t, i) => (
                      <span
                        key={t.slug}
                        className={cn(
                          "inline-flex rounded-[8px]",
                          // Overlapped, the near crest has to look like it is
                          // *in front of* the far one, not fused to it. Two
                          // dark brands touching read as one blob, so the near
                          // tile carries a hard cut on its leading edge and a
                          // soft shadow falling back over the tile behind —
                          // the same pair of cues a stacked deck gives. Both
                          // are shadows rather than a matched plate colour, so
                          // it works on the event floor and the season one.
                          i > 0 &&
                            "-ml-3 shadow-[-2px_0_0_0_rgb(0_0_0/0.7),-6px_0_10px_-3px_rgb(0_0_0/0.65)]",
                        )}
                      >
                        <TeamLogo team={t} size="cardCrest" />
                      </span>
                    ))}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full transition-colors",
                      selected
                        ? isEwc
                          ? "bg-[rgb(255_122_44)]"
                          : "bg-accent"
                        : "bg-[color-mix(in_oklch,var(--ink)_25%,transparent)]",
                    )}
                  />
                )}

                {/* The text column is exactly as tall as the crest beside it
                    (34px, `cardCrest`) and pushes its two lines to the ends, so
                    the name caps off the crest's top edge and the payout sits on
                    its baseline. Left to `gap`, the stack was a few pixels
                    taller than the logo and the whole row read as unaligned. */}
                <span className="flex h-[2.125rem] min-w-0 flex-1 flex-col justify-between">
                  <span className="flex min-w-0 max-w-full items-baseline gap-1.5">
                    <span
                      className={cn(
                        "truncate text-sm font-bold leading-none",
                        selected ? "text-ink" : "text-ink-muted group-hover/opt:text-ink",
                      )}
                    >
                      {opt.label}
                    </span>
                    {/* A score option's sublabel is the team tags ("MOUZ /
                        PARI") — which the crests beside it now say in full, so
                        keeping it would repeat the answer and, being
                        `shrink-0`, squeeze the scoreline itself down to an
                        ellipsis. */}
                    {opt.sublabel && !crests && (
                      <span className="shrink-0 text-[0.6875rem] text-ink-subtle">
                        {opt.sublabel}
                      </span>
                    )}
                  </span>
                  {/* The payout is the currency, so it carries the currency's
                      mark. `items-center` + `leading-none` is what keeps the
                      gem and the digits on one axis at this size. */}
                  <span
                    className={cn(
                      // Fixed 16px, the height of the currency mark. The
                      // betting branch has no icon, so left to its content this
                      // row measured 12px and the odds sat four pixels above
                      // where the flat payout sits — against a 34px crest that
                      // reads as the whole row being out of true.
                      "tnum flex h-4 items-center gap-1 font-mono text-xs font-extrabold leading-none",
                      isEwc
                        ? selected
                          ? "text-[rgb(255_154_64)]"
                          : "text-[rgb(255_154_64)]/80"
                        : selected
                          ? "text-accent"
                          : "text-accent/80",
                    )}
                  >
                    {betting ? (
                      // On a betting question the coefficient *is* the payout
                      // line — there is no flat figure to show, because what
                      // this option pays depends on what the player stakes.
                      // The streak rides on top of it exactly as it does on a
                      // flat reward, so the effective number is shown with the
                      // raw coefficient struck through behind it: a player on a
                      // run is not choosing against 2.10, they're choosing
                      // against 4.20.
                      <>
                        {multiplier > 1 && (
                          <span className="font-normal text-current/45 line-through">
                            ×{(opt.odds ?? 1).toFixed(2)}
                          </span>
                        )}
                        ×{((opt.odds ?? 1) * multiplier).toFixed(2)}
                        {multiplier > 1 && <StreakChip multiplier={multiplier} />}
                      </>
                    ) : (
                      <>
                        <BrandIcon
                          name={isEwc ? "points-ewc" : "points"}
                          className="size-4"
                        />
                        {/* The multiplied figure, not the base one with an
                            asterisk. The player is choosing between options on
                            what each pays *them*, so the number has to already
                            be their number — the ×N chip explains where it
                            came from. */}
                        +{applyStreak(opt.reward, streak)}
                        {multiplier > 1 && <StreakChip multiplier={multiplier} />}
                      </>
                    )}
                  </span>
                </span>

              </button>
            );
          })}
        </div>

        {betting ? (
          user ? (
            <>
              {/* Betting cards replace the footer with the slip, so the note
                  rides above it instead of being lost with the footer. */}
              {streakNote && (
                <p className="mt-2 flex justify-center text-center text-[0.6875rem] leading-snug">
                  {streakNote}
                </p>
              )}
              <BetSlip
                questionId={question.id}
                optionId={bet?.option_id ?? picked}
                odds={question.options.find((o) => o.id === picked)?.odds}
                balance={profile?.ewc_points ?? 0}
                locked={locked || upcoming}
                bet={bet}
                multiplier={multiplier}
                onPlaced={() => setBetNonce((n) => n + 1)}
              />
            </>
          ) : (
            <p className="mt-2 text-center text-xs text-ink-subtle">
              Увійди, щоб зробити ставку.
            </p>
          )
        ) : (
          /* Footer — one line of status, and only when there is one. It used to
             hold a reserved min-height so every card measured the same, but once
             the idle prompt went the reserved strip was pure dead space under
             every unanswered question. Cards in a grid already stretch to the
             tallest in their row, so nothing needs padding out by hand. */
          footer && (
            <div className="mt-2 flex items-center justify-center text-xs">{footer}</div>
          )
        )}
      </div>

      {/* Outside the padded body on purpose: full-bleed across the bottom edge,
          clipped to the card's own corners, so the card stands on the sponsor's
          plate instead of carrying a sticker inside it. */}
      {betting && <SponsorStrip />}
    </div>
  );
}

