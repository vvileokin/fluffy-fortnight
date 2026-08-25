import { PORTO_GROUPS } from "@/lib/porto-bracket";

/**
 * The 0-2 club — what one group card is worth, and what makes a valid one.
 *
 * Mirrored in migration 0053, which is what actually pays. Change both.
 *
 * A GSL group of eight sends three through and sends two home without winning a
 * map series at all. Naming the three is the prediction every site asks for;
 * naming the two is the one nobody does, and it is the harder read — a
 * favourite can lose twice, and it isn't enough to know who is good, you have
 * to know who is brittle. So a collapse pays double a qualification.
 */
export const PORTO_GROUP_SCORING = {
  /** Per team correctly named as qualifying. Three of them. */
  advance: 50,
  /** Per team correctly named as going out without a win. Two of them. */
  zeroTwo: 100,
  /** All five right in one group. */
  perfect: 200,
} as const;

export const PORTO_GROUP_SIZES = { advance: 3, zeroTwo: 2 } as const;

/** 550 a group, 1100 across the event. */
export const PORTO_GROUP_MAX =
  PORTO_GROUP_SCORING.advance * PORTO_GROUP_SIZES.advance +
  PORTO_GROUP_SCORING.zeroTwo * PORTO_GROUP_SIZES.zeroTwo +
  PORTO_GROUP_SCORING.perfect;

export type PortoGroupPicks = {
  advance: string[];
  zeroTwo: string[];
};

/** The eight teams of a group, in the order the draw pairs them. */
export function groupTeams(groupId: string): string[] {
  const g = PORTO_GROUPS.find((x) => x.id === groupId);
  if (!g) return [];
  return g.upper[0].nodes.flatMap((n) =>
    [n.a, n.b].map((s) => (s.kind === "team" ? s.slug : "")),
  );
}

/**
 * A card is only accepted whole.
 *
 * The two lists must not overlap: a team cannot both qualify and go out without
 * a win, and letting that through would let one pick be scored twice.
 */
export function isCompleteCard(
  groupId: string,
  p: Partial<PortoGroupPicks> | null,
): p is PortoGroupPicks {
  if (!p) return false;
  const pool = groupTeams(groupId);
  const list = (v: unknown, n: number): string[] | null =>
    Array.isArray(v) &&
    v.length === n &&
    v.every((s) => typeof s === "string" && pool.includes(s)) &&
    new Set(v).size === n
      ? (v as string[])
      : null;

  const advance = list(p.advance, PORTO_GROUP_SIZES.advance);
  const zeroTwo = list(p.zeroTwo, PORTO_GROUP_SIZES.zeroTwo);
  if (!advance || !zeroTwo) return false;
  return advance.every((s) => !zeroTwo.includes(s));
}

/** Points for one card against the real thing. Mirrors `score_porto_group`. */
export function scoreCard(picks: PortoGroupPicks, actual: Partial<PortoGroupPicks>): number {
  const hit = (a: string[] = [], b: string[] = []) => a.filter((s) => b.includes(s)).length;
  const advance = hit(picks.advance, actual.advance);
  const zeroTwo = hit(picks.zeroTwo, actual.zeroTwo);
  const base =
    advance * PORTO_GROUP_SCORING.advance + zeroTwo * PORTO_GROUP_SCORING.zeroTwo;
  return advance === PORTO_GROUP_SIZES.advance && zeroTwo === PORTO_GROUP_SIZES.zeroTwo
    ? base + PORTO_GROUP_SCORING.perfect
    : base;
}
