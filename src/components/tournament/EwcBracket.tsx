"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { ChevronDown } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import {
  EWC_GROUPS,
  EWC_PLAYOFFS,
  groupNodes,
  playoffNodes,
  type EwcGroup,
  type EwcMatchNode,
  type SlotSource,
} from "@/lib/ewc-bracket";
import { getTeam, slotTimeLabel, type Match } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Impeccable: Crafted EWC Bracket — the event's ladder, in the event's clothes.
 *
 * The bracket is a *view* of the matches an admin has created, not a parallel
 * data store. `src/lib/ewc-bracket.ts` describes the shape (which slot feeds
 * which); everything a viewer reads — teams, time, format, score — is pulled
 * off a real match if one exists for that slot, and falls back to TBD if not.
 * So an admin never edits "the bracket": they create Spirit vs JiJieHao at
 * 13:30 BO1 and it appears in Group A → Upper → Opening round on its own.
 *
 * Matching is by `bracketId` first (the explicit link), then by the two team
 * slugs — which is what makes the fixed opening pairs resolve with no admin
 * action at all, since those pairings are already known.
 */

type Resolved = {
  node: EwcMatchNode;
  match?: Match;
  a?: string;
  b?: string;
};

/** Reads a slot down to a team slug, following winner/loser edges when known. */
function resolveSlot(
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

function useResolver(matches: Match[]) {
  return React.useMemo(() => {
    // Index the admin's matches by the pair of teams they involve, so a fixture
    // that was created without an explicit bracket id still lands in its slot —
    // but keep the group and playoff stages in separate books.
    //
    // One shared index put FUT vs MOUZ from Group C into the quarter-final slot
    // those same two teams could reach, complete with its 2:1 from the 14th, so
    // the bracket showed a played result for a match nobody had played. Two
    // teams meeting twice in one tournament is normal; a pair of slugs is
    // therefore not an identity, and the stage is what separates them.
    const isPlayoffStage = (stage?: string | null) =>
      /playoff|плей|1\/8|1\/4|1\/2|фінал/i.test(stage ?? "");
    const byPairPlayoff = new Map<string, Match>();
    const byPairGroup = new Map<string, Match>();
    for (const m of matches) {
      const key = [m.a, m.b].sort().join("|");
      (isPlayoffStage(m.stage) ? byPairPlayoff : byPairGroup).set(key, m);
    }
    const byNode = new Map<string, Match>();

    // Repeated passes: the first fills every slot whose teams are already known
    // (the opening rounds), each later one uses those results to resolve the
    // rounds that depend on them. The playoff ladder is four deep, so it needs
    // one pass per round to reach the grand final.
    const all = [
      ...EWC_GROUPS.flatMap(groupNodes).map((node) => ({ node, playoff: false })),
      ...playoffNodes().map((node) => ({ node, playoff: true })),
    ];
    for (let pass = 0; pass < 5; pass++) {
      for (const { node, playoff } of all) {
        if (byNode.has(node.id)) continue;
        const a = resolveSlot(node.a, byNode);
        const b = resolveSlot(node.b, byNode);
        if (!a || !b) continue;
        const found = (playoff ? byPairPlayoff : byPairGroup).get([a, b].sort().join("|"));
        if (found) byNode.set(node.id, found);
      }
    }

    const resolve = (node: EwcMatchNode): Resolved => ({
      node,
      match: byNode.get(node.id),
      a: resolveSlot(node.a, byNode),
      b: resolveSlot(node.b, byNode),
    });
    return resolve;
  }, [matches]);
}

/* --------------------------------------------------------------------- */

function Side({
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
          won && "text-[rgb(255_186_92)]",
        )}
      >
        {t ? t.name : "TBD"}
      </span>
      {score !== undefined && (
        <span
          className={cn(
            "tnum shrink-0 font-mono text-xs font-bold",
            won ? "text-[rgb(255_186_92)]" : "text-white/45",
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function BracketMatch({ r }: { r: Resolved }) {
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
    <div className="overflow-hidden rounded-lg bg-black/35 shadow-[inset_0_0_0_1px_rgb(255_120_50/0.16)]">
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

function Column({
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

function GroupPanel({
  group,
  resolve,
  defaultOpen,
}: {
  group: EwcGroup;
  resolve: (n: EwcMatchNode) => Resolved;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="skin-aura-card overflow-hidden rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-extrabold tracking-tight text-white">
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-white/45 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-5 px-4 pb-4">
          <div>
            <p className="mb-2.5 text-xs font-bold text-white/70">Upper Bracket</p>
            <div className="no-scrollbar flex gap-4 overflow-x-auto">
              <Column title="Opening round">
                {group.upper.opening.map((n) => (
                  <BracketMatch key={n.id} r={resolve(n)} />
                ))}
              </Column>
              <Column title="Upper semi-finals">
                {group.upper.semis.map((n) => (
                  <BracketMatch key={n.id} r={resolve(n)} />
                ))}
              </Column>
            </div>
          </div>

          <div>
            <p className="mb-2.5 text-xs font-bold text-white/70">Lower Bracket</p>
            <div className="no-scrollbar flex gap-4 overflow-x-auto">
              <Column title="Lower round 1">
                {group.lower.round1.map((n) => (
                  <BracketMatch key={n.id} r={resolve(n)} />
                ))}
              </Column>
              <Column title="Lower semi-finals">
                {group.lower.semis.map((n) => (
                  <BracketMatch key={n.id} r={resolve(n)} />
                ))}
              </Column>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EwcBracket({ matches }: { matches: Match[] }) {
  const resolve = useResolver(matches);

  return (
    <div className="space-y-4">
      {EWC_GROUPS.map((g) => (
        <GroupPanel key={g.id} group={g} resolve={resolve} defaultOpen={false} />
      ))}
      {/* Open by default now that the draw is published — the playoff ladder is
          the part of the event a visitor came to look at. */}
      <PlayoffsPanel resolve={resolve} />
    </div>
  );
}

function PlayoffsPanel({ resolve }: { resolve: (n: EwcMatchNode) => Resolved }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="skin-aura-card overflow-hidden rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-extrabold tracking-tight text-white">Playoffs</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-white/45 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-4">
          {/* Each round holds half as many cards as the one before it, so
              spreading them keeps a match sitting between the two it feeds on
              from — the read a bracket lives or dies by. */}
          {EWC_PLAYOFFS.map((r) => (
            <Column key={r.id} title={r.label} spread={r.id !== "ro16"}>
              {r.matches.map((n) => (
                <BracketMatch key={n.id} r={resolve(n)} />
              ))}
            </Column>
          ))}
        </div>
      )}
    </div>
  );
}
