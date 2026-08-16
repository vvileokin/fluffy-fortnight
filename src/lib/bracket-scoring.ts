/**
 * What a filled playoff bracket is worth.
 *
 * Mirrored in migration 0038, which is what actually pays — change both.
 *
 * Scoring compares the *set of teams* a player named for each round against the
 * set that genuinely reached it, rather than checking match slots one by one.
 * A slot-based bracket dies on the first upset: everything downstream of a lost
 * pick scores zero even where the player read the rest of the tournament
 * correctly, and a card that can be dead by Friday is a card nobody opens on
 * Saturday. Sets keep every correct call alive on its own merit.
 */
export const BRACKET_SCORING = {
  /** Per team correctly named as a quarter-finalist. 8 of them. */
  qf: 25,
  /** Per team correctly named as a semi-finalist. 4 of them. */
  sf: 50,
  /** Per team correctly named as a finalist. 2 of them. */
  final: 100,
  /** For calling the champion. */
  champion: 300,
} as const;

export const BRACKET_ROUND_SIZES = { qf: 8, sf: 4, final: 2 } as const;

/**
 * 200 a round, three times over, and 300 for the champion.
 *
 * Each round carries the same total (8×25, 4×50, 2×100) so no single one runs
 * away with the board, while the per-team rate doubles each step — depth of
 * read beats breadth of guessing. The champion sits above its round because it
 * is the one call everybody has an argument about.
 */
export const BRACKET_MAX =
  BRACKET_SCORING.qf * BRACKET_ROUND_SIZES.qf +
  BRACKET_SCORING.sf * BRACKET_ROUND_SIZES.sf +
  BRACKET_SCORING.final * BRACKET_ROUND_SIZES.final +
  BRACKET_SCORING.champion;

export type BracketPicks = {
  /** Eight teams the player says reach the quarter-finals. */
  qf: string[];
  /** Four that reach the semi-finals. */
  sf: string[];
  /** Two that reach the final. */
  final: string[];
  /** One champion. */
  champion: string;
};

/** A submission is only accepted whole — a half-filled bracket scores nothing. */
export function isCompleteBracket(p: Partial<BracketPicks> | null): p is BracketPicks {
  if (!p) return false;

  const list = (v: unknown, n: number): string[] | null =>
    Array.isArray(v) &&
    v.length === n &&
    v.every((s) => typeof s === "string" && s) &&
    new Set(v).size === n // a team can't fill two slots of the same round
      ? (v as string[])
      : null;

  const qf = list(p.qf, BRACKET_ROUND_SIZES.qf);
  const sf = list(p.sf, BRACKET_ROUND_SIZES.sf);
  const final = list(p.final, BRACKET_ROUND_SIZES.final);
  const champion = typeof p.champion === "string" ? p.champion : "";
  if (!qf || !sf || !final || !champion) return false;

  // Every later round is drawn from the one before it, or this isn't a bracket —
  // it's four unrelated lists that happen to be the right length.
  return (
    sf.every((s) => qf.includes(s)) &&
    final.every((s) => sf.includes(s)) &&
    final.includes(champion)
  );
}

/** Points for one bracket against the real thing. Mirrors `score_brackets`. */
export function scoreBracket(picks: BracketPicks, actual: Partial<BracketPicks>): number {
  const overlap = (a: string[] = [], b: string[] = []) =>
    a.filter((s) => b.includes(s)).length;
  return (
    overlap(picks.qf, actual.qf) * BRACKET_SCORING.qf +
    overlap(picks.sf, actual.sf) * BRACKET_SCORING.sf +
    overlap(picks.final, actual.final) * BRACKET_SCORING.final +
    (actual.champion && picks.champion === actual.champion ? BRACKET_SCORING.champion : 0)
  );
}
