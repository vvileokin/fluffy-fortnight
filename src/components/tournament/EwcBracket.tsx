"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { ChevronDown } from "lucide-react";
import {
  EWC_GROUPS,
  EWC_PLAYOFFS,
  groupNodes,
  playoffNodes,
  type EwcGroup,
  type EwcMatchNode,
} from "@/lib/ewc-bracket";
import { type Match } from "@/lib/data";
import {
  BracketMatch,
  Column,
  resolveSlot,
  type Resolved,
} from "@/components/tournament/BracketParts";
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

function GroupPanel({
  group,
  resolve,
}: {
  group: EwcGroup;
  resolve: (n: EwcMatchNode) => Resolved;
}) {
  const [open, setOpen] = React.useState(false);
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
        <GroupPanel key={g.id} group={g} resolve={resolve} />
      ))}
      {/* Closed, like the groups. On a page that surveys a whole event, a
          section that unfolds on arrival has decided for the reader which part
          they came for. */}
      <PlayoffsPanel resolve={resolve} />
    </div>
  );
}

function PlayoffsPanel({ resolve }: { resolve: (n: EwcMatchNode) => Resolved }) {
  const [open, setOpen] = React.useState(false);
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
