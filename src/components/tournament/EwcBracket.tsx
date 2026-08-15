"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { ChevronDown } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import {
  EWC_GROUPS,
  EWC_PLAYOFFS,
  EWC_THIRD_PLACE,
  groupNodes,
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
    // that was created without an explicit bracket id still lands in its slot.
    const byPair = new Map<string, Match>();
    for (const m of matches) {
      byPair.set([m.a, m.b].sort().join("|"), m);
    }
    const byNode = new Map<string, Match>();

    // Two passes: the first fills every slot whose teams are already known
    // (the opening round), the second uses those results to resolve the rounds
    // that depend on them. Two is enough for a group — nothing here is deeper.
    const all = EWC_GROUPS.flatMap(groupNodes);
    for (let pass = 0; pass < 3; pass++) {
      for (const node of all) {
        if (byNode.has(node.id)) continue;
        const a = resolveSlot(node.a, byNode);
        const b = resolveSlot(node.b, byNode);
        if (!a || !b) continue;
        const found = byPair.get([a, b].sort().join("|"));
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-[11.5rem] flex-1">
      <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wide text-white/40">
        {title}
      </p>
      <div className="flex flex-col gap-2.5">{children}</div>
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
    <div className="ewc-aura-card overflow-hidden rounded-xl">
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

function PlayoffSlot() {
  return (
    <div className="overflow-hidden rounded-lg bg-black/35 shadow-[inset_0_0_0_1px_rgb(255_120_50/0.12)]">
      <div className="flex items-center justify-between gap-2 bg-white/[0.03] px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-white/30">
        <span>TBD</span>
      </div>
      <div className="[&>*+*]:shadow-[0_-1px_0_0_rgb(255_255_255/0.07)]">
        <Side />
        <Side />
      </div>
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

      {/* Playoffs — collapsed like the groups. Every slot is TBD: the sixteen
          qualifiers aren't known until all four groups finish. Showing the
          ladder anyway tells a player how far the event runs. */}
      <PlayoffsPanel />
    </div>
  );
}

function PlayoffsPanel() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="ewc-aura-card overflow-hidden rounded-xl">
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
          {EWC_PLAYOFFS.map((r) => (
            <Column key={r.id} title={r.label}>
              {Array.from({ length: r.matches }, (_, i) => (
                <PlayoffSlot key={i} />
              ))}
              {/* The decider sits under the final it shadows, not beside it as
                  a fifth round — that's the empty space every earlier column
                  leaves as the ladder narrows, and it's where a bracket
                  conventionally puts this match. Same column as Grand final,
                  so it lines up under it rather than floating off to the side. */}
              {r.id === "gf" && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wide text-white/40">
                    {EWC_THIRD_PLACE.label}
                  </p>
                  <PlayoffSlot />
                </div>
              )}
            </Column>
          ))}
        </div>
      )}
    </div>
  );
}
