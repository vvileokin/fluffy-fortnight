"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { TeamLogo } from "@/components/ui/TeamLogo";
import type { EwcMatchNode, SlotSource } from "@/lib/ewc-bracket";
import { getTeam, slotTimeLabel, type Match } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * The pieces every event bracket is drawn from.
 *
 * Two tournaments now render a ladder — the World Cup's four GSL groups and
 * Porto's two — and they differ only in shape: how many columns a group has and
 * whether the playoff pairings are known in advance. The cards, the sides, the
 * score lookup and the winner derivation are the same object in both, so they
 * live here once. Colours come from the `--skin-*` palette, so a card takes
 * whichever event it is sitting inside.
 */

export type Resolved = {
  node: EwcMatchNode;
  match?: Match;
  a?: string;
  b?: string;
};

/** Reads a slot down to a team slug, following winner/loser edges when known. */
export function resolveSlot(
  src: SlotSource,
  byNode: Map<string, Match>,
): string | undefined {
  if (src.kind === "team") return src.slug;
  const feeder = byNode.get(src.of);
  if (!feeder || feeder.status !== "finished") return undefined;
  const aWon = feeder.scoreA > feeder.scoreB;
  const winner = aWon ? feeder.a : feeder.b;
  const loser = aWon ? feeder.b : feeder.a;
  return src.kind === "winner" ? winner : loser;
}

/* --------------------------------------------------------------------- */

export function Side({
  slug,
  score,
  won,
  dim,
}: {
  slug?: string;
  score?: number;
  won?: boolean;
  dim?: boolean;
}) {
  const t = slug ? getTeam(slug) : undefined;
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5",
        dim && "opacity-55",
      )}
    >
      {t ? (
        <TeamLogo team={t} size="xs" />
      ) : (
        <span className="grid size-5 shrink-0 place-items-center rounded bg-white/5 text-[0.625rem] font-bold text-white/30">
          ?
        </span>
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-xs",
          t ? "font-semibold text-white" : "text-white/35",
          won && "text-[rgb(var(--skin-ring))]",
        )}
      >
        {t ? t.name : "TBD"}
      </span>
      {score !== undefined && (
        <span
          className={cn(
            "tnum shrink-0 font-mono text-xs font-bold",
            won ? "text-[rgb(var(--skin-ring))]" : "text-white/45",
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}

export function BracketMatch({ r }: { r: Resolved }) {
  const m = r.match;
  const done = m?.status === "finished";
  // The bracket fixes its own side order (the published opening pairs); the
  // admin's row is in whatever order it was created in, and `byPair` matches
  // the two on a sorted key, so the orders routinely disagree. Reading
  // `scoreA` for whichever team the *bracket* lists first therefore printed
  // the result backwards — a win for the away side showed as a win for the
  // home one. Scores belong to teams, not to positions, so look them up by
  // slug and derive the winner from the match's own sides.
  const scoreOf = (slug?: string) =>
    !m || !slug ? undefined : m.a === slug ? m.scoreA : m.b === slug ? m.scoreB : undefined;
  const winner =
    m && done && m.scoreA !== m.scoreB ? (m.scoreA > m.scoreB ? m.a : m.b) : undefined;
  const aWon = winner !== undefined && winner === r.a;
  const bWon = winner !== undefined && winner === r.b;
  // Same relative-day phrasing every other time label on the site uses
  // ("Сьогодні 18:00", "Завтра 18:00", "12 сер 18:00") — a bare HH:mm told a
  // reader the kickoff time but not which of the tournament's many days it
  // fell on, so every card looked like it could be happening right now.
  const time = m?.startISO ? slotTimeLabel(m.startISO) : null;

  const body = (
    // `shadow-inset`, not a plain spread shadow: on the same element as
    // `overflow-hidden` + `rounded-lg`, a non-inset box-shadow paints outside
    // the border box and gets clipped unevenly right at the rounded corners —
    // the outline reads as broken there instead of continuous. Inset paints
    // inside the box, where the clip never reaches it.
    <div className="overflow-hidden rounded-lg bg-black/35 shadow-[inset_0_0_0_1px_rgb(var(--skin-ring)/0.18)]">
      <div className="flex items-center justify-between gap-2 bg-white/[0.04] px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-white/45">
        <span>{time ?? "TBD"}</span>
        <span>{m?.format ?? r.node.format}</span>
      </div>
      <div className="[&>*+*]:shadow-[0_-1px_0_0_rgb(255_255_255/0.07)]">
        <Side slug={r.a} score={scoreOf(r.a)} won={aWon} dim={bWon} />
        <Side slug={r.b} score={scoreOf(r.b)} won={bWon} dim={aWon} />
      </div>
    </div>
  );

  return m ? (
    <Link href={`/matches/${m.id}`} className="block transition-opacity hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Column({
  title,
  spread,
  children,
}: {
  title: string;
  /** Spread the cards down the column instead of stacking them at the top. */
  spread?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[11.5rem] flex-1 flex-col">
      <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wide text-white/40">
        {title}
      </p>
      <div
        className={cn(
          "flex flex-1 flex-col gap-2.5",
          spread && "justify-around",
        )}
      >
        {children}
      </div>
    </div>
  );
}

