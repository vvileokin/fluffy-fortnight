/**
 * EWC 2026 bracket structure.
 *
 * This file describes the *shape* of the tournament — which slot feeds which,
 * and what the fixed opening pairs are. It holds no results. Everything a
 * viewer sees (teams, times, formats, scores) comes from the matches an admin
 * creates; the bracket is a projection of that data, not a second copy of it.
 * A slot with no matching admin row simply renders TBD.
 *
 * Each group is a GSL double-elimination of eight:
 *
 *   Opening round  4 × BO1   winners rise, losers drop
 *   Upper semis    2 × BO3   winners QUALIFY, losers drop to lower semis
 *   Lower round 1  2 × BO3   losers are ELIMINATED (0-2)
 *   Lower semis    2 × BO3   winners QUALIFY, losers ELIMINATED (1-2)
 *
 * Four qualify per group: two through the upper bracket, two through the lower.
 * The lower semis cross the brackets (upper-semi loser 1 meets lower-R1 winner
 * 2, and vice versa) so a team can't meet the same opponent twice in a row.
 */

export type EwcGroupId = "a" | "b" | "c" | "d";

/** Where a slot's team comes from: a fixed seed, or the result of another match. */
export type SlotSource =
  | { kind: "team"; slug: string }
  | { kind: "winner"; of: string }
  | { kind: "loser"; of: string };

export type EwcMatchNode = {
  /** Stable id, also the key an admin match is matched against. */
  id: string;
  round: string;
  format: "BO1" | "BO3" | "BO5";
  a: SlotSource;
  b: SlotSource;
};

export type EwcGroup = {
  id: EwcGroupId;
  label: string;
  upper: { opening: EwcMatchNode[]; semis: EwcMatchNode[] };
  lower: { round1: EwcMatchNode[]; semis: EwcMatchNode[] };
};

const team = (slug: string): SlotSource => ({ kind: "team", slug });
const win = (of: string): SlotSource => ({ kind: "winner", of });
const lose = (of: string): SlotSource => ({ kind: "loser", of });

/**
 * The confirmed opening pairs. These are fixed by the organiser — never
 * generated, never re-seeded.
 */
const OPENING: Record<EwcGroupId, [string, string][]> = {
  a: [
    ["spirit", "jijiehao"],
    ["luminosity", "gamerlegion"],
    ["g2", "m80"],
    ["big", "aurora"],
  ],
  b: [
    ["falcons", "k27"],
    ["mibr", "astralis"],
    ["betboom", "faze"],
    ["nip", "legacy"],
  ],
  c: [
    ["vitality", "hundredthieves"],
    ["parivision", "b8"],
    ["fut", "tyloo"],
    ["lynn", "mouz"],
  ],
  d: [
    ["natus", "threedmax"],
    ["magic", "mongolz"],
    ["ninez", "pain"],
    ["wildcard", "furia"],
  ],
};

function buildGroup(id: EwcGroupId, label: string): EwcGroup {
  const p = `${id}`;
  const o = (n: number) => `${p}-o${n}`;
  const us = (n: number) => `${p}-us${n}`;
  const lr = (n: number) => `${p}-lr${n}`;
  const ls = (n: number) => `${p}-ls${n}`;

  const opening: EwcMatchNode[] = OPENING[id].map(([x, y], i) => ({
    id: o(i + 1),
    round: "Opening round",
    format: "BO1",
    a: team(x),
    b: team(y),
  }));

  return {
    id,
    label,
    upper: {
      opening,
      semis: [
        { id: us(1), round: "Upper semi-finals", format: "BO3", a: win(o(1)), b: win(o(2)) },
        { id: us(2), round: "Upper semi-finals", format: "BO3", a: win(o(3)), b: win(o(4)) },
      ],
    },
    lower: {
      round1: [
        { id: lr(1), round: "Lower round 1", format: "BO3", a: lose(o(1)), b: lose(o(2)) },
        { id: lr(2), round: "Lower round 1", format: "BO3", a: lose(o(3)), b: lose(o(4)) },
      ],
      // Crossed on purpose: an upper-semi loser meets the *other* half's
      // lower-round survivor, so nobody replays the match they just lost.
      semis: [
        { id: ls(1), round: "Lower semi-finals", format: "BO3", a: lose(us(1)), b: win(lr(2)) },
        { id: ls(2), round: "Lower semi-finals", format: "BO3", a: lose(us(2)), b: win(lr(1)) },
      ],
    },
  };
}

export const EWC_GROUPS: EwcGroup[] = [
  buildGroup("a", "Group A"),
  buildGroup("b", "Group B"),
  buildGroup("c", "Group C"),
  buildGroup("d", "Group D"),
];

/**
 * Playoffs — a 16-team single elimination plus a third-place decider.
 *
 * Every slot is TBD: the sixteen qualifiers aren't known until all four groups
 * finish, and the organiser hasn't published the seeding. Rendering the shape
 * now is still useful — it tells a player how far the event runs and what the
 * ladder looks like — so the rounds exist with empty slots rather than being
 * hidden entirely.
 */
export type EwcPlayoffRound = { id: string; label: string; format: string; matches: number };

export const EWC_PLAYOFFS: EwcPlayoffRound[] = [
  { id: "ro16", label: "Round of 16", format: "BO3", matches: 8 },
  { id: "qf", label: "Quarter-finals", format: "BO3", matches: 4 },
  { id: "sf", label: "Semi-finals", format: "BO3", matches: 2 },
  { id: "gf", label: "Grand final", format: "BO5", matches: 1 },
];

export const EWC_THIRD_PLACE: EwcPlayoffRound = {
  id: "third",
  label: "Матч за 3-тє місце",
  format: "BO3",
  matches: 1,
};

/** All node ids in a group, in bracket order — used to look up admin matches. */
export function groupNodes(g: EwcGroup): EwcMatchNode[] {
  return [...g.upper.opening, ...g.upper.semis, ...g.lower.round1, ...g.lower.semis];
}
