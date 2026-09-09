import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The Major qualification projection.
 *
 * Computed offline and pushed into two tables — see 0077. Nothing here
 * calculates anything: HLTV refuse a plain fetch, so the standings cannot be
 * read from a server function, and the model that turns them into probabilities
 * is a separate program. The site's job is to show the last run and say when it
 * was taken.
 */

export type MajorRegion = "europe" | "americas" | "asia";

export type MajorSlots = {
  total: number;
  stage3: number;
  stage2: number;
  stage1: number;
};

export type MajorEvent = {
  name: string;
  begin: string;
  end: string | null;
  weight: number;
  slots: number | null;
  tier: 1 | 2;
  prize: number | null;
  hasQualifier: boolean;
};

export type MajorMeta = {
  asOf: string;
  cutoff: string;
  event: string;
  runs: number;
  slots: Record<MajorRegion, MajorSlots>;
  events: MajorEvent[];
  source: string;
};

export type MajorTeam = {
  region: MajorRegion;
  team: string;
  slug: string | null;
  vrs: number;
  mu: number;
  sd: number;
  pQual: number;
  p3: number;
  p2: number;
  p1: number;
  projected: number;
  lo: number | null;
  hi: number | null;
  tier1: string[];
  tier2: { name: string; p: number; confirmed: boolean }[];
  qualBy: { name: string; p: number }[];
  /** Percentage points moved since yesterday, signed. Null when there is
   *  nothing to compare against, or when the team has not actually moved. */
  move: number | null;
};

export type MajorData = { meta: MajorMeta; teams: MajorTeam[] } | null;

/**
 * One read for the whole page, request-cached.
 *
 * Returns null rather than throwing when the tables are empty or the migration
 * has not been run — the page then says the projection is not published yet,
 * which is the truth and is better than a five-hundred.
 */
export const getMajorProjection = cache(async (): Promise<MajorData> => {
  try {
    const sb = await createClient();
    const [{ data: meta }, { data: rows }] = await Promise.all([
      sb.from("major_meta").select("*").maybeSingle(),
      sb
        .from("major_projection")
        .select("*")
        .order("region", { ascending: true })
        .order("projected", { ascending: true }),
    ]);
    if (!meta || !rows?.length) return null;

    return {
      meta: {
        asOf: meta.as_of as string,
        cutoff: meta.cutoff as string,
        event: meta.event as string,
        runs: Number(meta.runs ?? 0),
        slots: meta.slots as Record<MajorRegion, MajorSlots>,
        events: (meta.events ?? []) as MajorEvent[],
        source: meta.source as string,
      },
      teams: withMove(rows.map((r) => ({
        region: r.region as MajorRegion,
        team: r.team as string,
        slug: (r.slug as string | null) ?? null,
        vrs: r.vrs as number,
        mu: r.mu as number,
        sd: r.sd as number,
        pQual: r.p_qual as number,
        p3: r.p_stage3 as number,
        p2: r.p_stage2 as number,
        p1: r.p_stage1 as number,
        projected: r.projected as number,
        lo: (r.place_lo as number | null) ?? null,
        hi: (r.place_hi as number | null) ?? null,
        tier1: (r.tier1 ?? []) as string[],
        tier2: (r.tier2 ?? []) as MajorTeam["tier2"],
        qualBy: (r.qual_by ?? []) as MajorTeam["qualBy"],
        move: null,
      })), (meta.prev ?? null) as PrevRow[] | null),
    };
  } catch {
    return null;
  }
});

type PrevRow = { region: string; team: string; p_qual: number };

/**
 * How much each team moved since yesterday, up or down.
 *
 * A standing team gets nothing. That is the whole discipline of the badge: on
 * any given day most of the table has not really moved, and printing "0.0" on
 * thirty rows to say so buries the four that did. Below a twentieth of a point
 * the change is arithmetic noise from the simulation, not news.
 *
 * Matched on region and name, and among namesakes on position: Asia carries two
 * sides called The Huns and two called Rare Atom, hundreds of points apart, so
 * a plain name lookup would hand one of them the other's movement. Both lists
 * arrive in projected order, so the nth of a name here is the nth there.
 */
function withMove(teams: MajorTeam[], prev: PrevRow[] | null): MajorTeam[] {
  if (!prev?.length) return teams;
  const queue = new Map<string, number[]>();
  for (const p of prev) {
    const k = p.region + "|" + p.team;
    const list = queue.get(k);
    if (list) list.push(p.p_qual);
    else queue.set(k, [p.p_qual]);
  }
  const used = new Map<string, number>();
  return teams.map((t) => {
    const k = t.region + "|" + t.team;
    const list = queue.get(k);
    if (!list) return t;
    const i = used.get(k) ?? 0;
    used.set(k, i + 1);
    const was = list[i];
    if (typeof was !== "number") return t;
    const d = (t.pQual - was) * 100;
    return { ...t, move: Math.abs(d) >= 0.05 ? d : null };
  });
}

/**
 * Teams of one region, strongest chance first.
 *
 * The rows used to come back in the model's projected finishing order, which is
 * ranked on expected VRS points, while the column the reader actually compares
 * is the probability of getting an invitation. Those two disagree whenever a
 * side is more volatile than the one above it, and the table then printed
 * Vitality at 98.2% above Falcons at 98.9% — which reads as a sorting bug
 * whatever the arithmetic behind it.
 *
 * The page is about who gets in, so it is ordered on that, and the place and
 * stage each row is given follow from this order rather than from the separate
 * projected standing. One ranking, stated once.
 */
export function regionTeams(data: NonNullable<MajorData>, region: MajorRegion) {
  return data.teams
    .filter((t) => t.region === region)
    .sort((a, b) => b.pQual - a.pQual || a.projected - b.projected);
}

/**
 * The sides this site is actually about.
 *
 * Matched on the name HLTV prints, because that is what the projection carries
 * and it is stable — the site's own catalogue only covers teams we run matches
 * on, and half of these are not in it.
 */
export const UA_TEAMS = ["B8", "Natus Vincere", "Inner Circle", "G2", "fnatic", "FUT"];

/**
 * Which stage a projected place lands in.
 *
 * The Major is played in three, and where a team enters is most of what the
 * invitation is worth: the top of Europe starts in the last stage with a
 * bracket already half survived, and the bottom of it starts in the first with
 * a week of qualifying ahead. A page that says only "in" or "out" throws that
 * away.
 */
export function stageOf(projected: number, slots: MajorSlots): 3 | 2 | 1 | 0 {
  if (projected <= slots.stage3) return 3;
  if (projected <= slots.stage3 + slots.stage2) return 2;
  if (projected <= slots.total) return 1;
  return 0;
}

export function ourTeams(data: NonNullable<MajorData>) {
  const want = new Map(UA_TEAMS.map((n, i) => [n, i]));
  // The place comes from the same ordering the region table uses, so the banner
  // and the row for the same side can never disagree about where it stands.
  const placeOf = new Map<string, number>();
  for (const region of ["europe", "americas", "asia"] as MajorRegion[])
    regionTeams(data, region).forEach((t, i) => placeOf.set(t.region + t.team, i + 1));

  // Strongest chance first, like every other list on the page. `UA_TEAMS` is
  // the guest list, not the running order — reading it as one put fnatic at
  // 12.5% under G2 at 95.9% purely because of where it sits in that array.
  return data.teams
    .filter((t) => want.has(t.team))
    .sort((a, b) => b.pQual - a.pQual)
    .map((t) => ({ ...t, place: placeOf.get(t.region + t.team) ?? t.projected }));
}

/** Days from today to the invitation date, floored at zero. */
export function daysLeft(cutoff: string): number {
  const ms = new Date(cutoff + "T00:00:00Z").getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
