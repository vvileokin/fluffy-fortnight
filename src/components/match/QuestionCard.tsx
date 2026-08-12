"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Check } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { getMatch, matchTeam, teamByLabel, type Question, type Match } from "@/lib/data";
import { useUser } from "@/lib/supabase/use-user";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const [picked, setPicked] = React.useState<string | undefined>();
  const [justSaved, setJustSaved] = React.useState(false);

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

  async function choose(id: string) {
    if (locked || upcoming) return;
    if (!user) {
      router.push("/login");
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
  function resolveTeam(label: string) {
    const key = label.trim().toLowerCase();
    return (
      sides.find(
        (t) => t.name.toLowerCase() === key || t.tag.toLowerCase() === key,
      ) ?? teamByLabel(label)
    );
  }

  // Nothing to say on an untouched, open question — the options speak for
  // themselves — so the footer collapses rather than reserving a line.
  const footer = justSaved ? (
    <span className="flex items-center gap-1 font-semibold text-success">
      <Check className="size-3.5" strokeWidth={3} /> Збережено
    </span>
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
            question.options.length > 2 ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {question.options.map((opt) => {
            const selected = picked === opt.id;
            const optTeam = resolveTeam(opt.label);
            return (
              <button
                key={opt.id}
                onClick={() => choose(opt.id)}
                disabled={locked || upcoming}
                aria-pressed={selected}
                style={
                  optTeam
                    ? ({
                        backgroundImage: `linear-gradient(100deg, color-mix(in oklch, ${optTeam.brand} ${selected ? 26 : 13}%, transparent), transparent 68%)`,
                      } as CSSProperties)
                    : undefined
                }
                className={cn(
                  // `rounded-md` (12px), not `rounded-xl` (20px): the crest
                  // inside sits 5px in with a 7px radius, and nested boxes only
                  // look right when their curves are concentric — inner radius
                  // equals outer minus the gap. At 20px the plate curved away
                  // from a crest that then read as a square in a pill.
                  "group/opt relative flex h-[2.75rem] min-w-0 items-center gap-2 overflow-hidden rounded-md px-2.5 text-left",
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
                    {opt.sublabel && (
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
                      "tnum flex items-center gap-1 font-mono text-xs font-extrabold leading-none",
                      isEwc
                        ? selected
                          ? "text-[rgb(255_154_64)]"
                          : "text-[rgb(255_154_64)]/80"
                        : selected
                          ? "text-accent"
                          : "text-accent/80",
                    )}
                  >
                    <BrandIcon name={isEwc ? "points-ewc" : "points"} className="size-4" />
                    +{opt.reward}
                  </span>
                </span>

              </button>
            );
          })}
        </div>

        {/* Footer — one line of status, and only when there is one. It used to
            hold a reserved min-height so every card measured the same, but once
            the idle prompt went the reserved strip was pure dead space under
            every unanswered question. Cards in a grid already stretch to the
            tallest in their row, so nothing needs padding out by hand. */}
        {footer && (
          <div className="mt-2 flex items-center justify-center text-xs">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

