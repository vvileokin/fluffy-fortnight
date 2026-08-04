import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTeamIndex, resolveTeamSlug, fullTeamCatalog } from "@/lib/team-match";
import { fetchLatestStandings, type Region } from "@/lib/valve-standings";

export type ValveSyncResult = {
  found: boolean;
  globalMatched: number;
  globalTotal: number;
  regionMatched: number;
  regionTotal: number;
};

type RankRow = {
  slug: string;
  global_rank: number | null;
  global_points: number | null;
  region: Region | null;
  region_rank: number | null;
  region_points: number | null;
  updated_at: string;
};

/**
 * Pull Valve's latest Regional Standings and stamp a world/regional rank onto
 * every team we recognise by name. Teams we don't have in the catalog (or
 * can't match confidently) are left alone — this only annotates teams that
 * already exist, never creates one.
 */
export async function runValveStandingsSync(): Promise<ValveSyncResult> {
  const standings = await fetchLatestStandings();
  if (!standings) {
    return { found: false, globalMatched: 0, globalTotal: 0, regionMatched: 0, regionTotal: 0 };
  }

  const admin = createAdminClient();
  const index = buildTeamIndex(await fullTeamCatalog(admin));
  const now = new Date().toISOString();

  const bySlug = new Map<string, RankRow>();
  const touch = (slug: string): RankRow => {
    const existing = bySlug.get(slug);
    if (existing) return existing;
    const fresh: RankRow = {
      slug,
      global_rank: null,
      global_points: null,
      region: null,
      region_rank: null,
      region_points: null,
      updated_at: now,
    };
    bySlug.set(slug, fresh);
    return fresh;
  };

  // Valve's tables can list the same display name twice — an org's main roster
  // and an academy/secondary squad both appear as e.g. "Liquid". Matching by
  // name alone can't tell them apart, so keep the better placement rather than
  // letting whichever row comes last overwrite it.
  let globalMatched = 0;
  for (const row of standings.global) {
    const slug = resolveTeamSlug(index, row.teamName);
    if (!slug) continue;
    globalMatched++;
    const r = touch(slug);
    if (r.global_rank === null || row.rank < r.global_rank) {
      r.global_rank = row.rank;
      r.global_points = row.points;
    }
  }

  let regionMatched = 0;
  let regionTotal = 0;
  for (const region of Object.keys(standings.regions) as Region[]) {
    const rows = standings.regions[region];
    regionTotal += rows.length;
    for (const row of rows) {
      const slug = resolveTeamSlug(index, row.teamName);
      if (!slug) continue;
      regionMatched++;
      const r = touch(slug);
      if (r.region_rank === null || row.rank < r.region_rank) {
        r.region = region;
        r.region_rank = row.rank;
        r.region_points = row.points;
      }
    }
  }

  const rankRows = [...bySlug.values()];
  if (rankRows.length > 0) {
    const { error } = await admin.from("team_ranks").upsert(rankRows, { onConflict: "slug" });
    if (error) throw new Error(error.message);
  }

  return {
    found: true,
    globalMatched,
    globalTotal: standings.global.length,
    regionMatched,
    regionTotal,
  };
}
