import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  matchesTodayAndTomorrow,
  formatOf,
  sidesOf,
  scoreFor,
  competitionOf,
  stageOf,
  rateLimitRemaining,
} from "@/lib/pandascore";

export type SyncResult = {
  total: number;
  added: number;
  rescheduled: number;
  quotaLeft: string | null;
};

/**
 * Pull today's and tomorrow's CS2 fixtures into the inbox.
 *
 * Two things this must not do: resurrect a match the admin already rejected,
 * and touch anything editorial. So decisions are carried over the upsert, and
 * for matches already approved only the calendar facts — kick-off and best-of —
 * are pushed onto the live match. Maps, veto and scores stay ours.
 *
 * Shared by the admin's button and the hourly cron.
 */
export async function runPandaScoreSync(): Promise<SyncResult> {
  const fetched = await matchesTodayAndTomorrow();
  const admin = createAdminClient();

  // A bracket slot without both sides decided yet (TBD vs TBD, or TBD vs a
  // real team) isn't reviewable — there's nothing to bind to our catalog. Skip
  // it; it'll show up once PandaScore fills the pairing in.
  const decided = fetched.filter((m) => {
    const [a, b] = sidesOf(m);
    return !!a && !!b;
  });
  const byId = new Map(decided.map((m) => [m.id, m]));

  // Pending rows synced before this filter existed (still TBD) don't belong
  // in the queue either — drop them now instead of waiting for them to age out.
  await admin
    .from("ps_matches")
    .delete()
    .eq("review", "pending")
    .or("team_a_name.is.null,team_b_name.is.null");

  if (byId.size === 0) {
    return { total: 0, added: 0, rescheduled: 0, quotaLeft: rateLimitRemaining() };
  }

  const { data: existing } = await admin
    .from("ps_matches")
    .select("ps_id, review, match_id, decided_at, decided_by")
    .in("ps_id", [...byId.keys()]);
  const prior = new Map((existing ?? []).map((r) => [Number(r.ps_id), r]));

  const rows = [...byId.values()].map((m) => {
    const [a, b] = sidesOf(m);
    const was = prior.get(m.id);
    return {
      ps_id: m.id,
      name: m.name,
      ps_status: m.status,
      begin_at: m.begin_at ?? m.scheduled_at,
      number_of_games: m.number_of_games,
      match_type: m.match_type,
      league_name: m.league?.name ?? null,
      serie_name: m.serie?.full_name ?? m.serie?.name ?? null,
      tournament_name: m.tournament?.name ?? null,
      competition: competitionOf(m) || null,
      stage_name: stageOf(m) || null,
      team_a_ps_id: a?.id ?? null,
      team_a_name: a?.name ?? null,
      team_a_acronym: a?.acronym ?? null,
      team_a_logo: a?.image_url ?? null,
      team_b_ps_id: b?.id ?? null,
      team_b_name: b?.name ?? null,
      team_b_acronym: b?.acronym ?? null,
      team_b_logo: b?.image_url ?? null,
      score_a: scoreFor(m, a?.id),
      score_b: scoreFor(m, b?.id),
      raw: m,
      synced_at: new Date().toISOString(),
      // An upsert replaces the whole row, so the decision has to be carried
      // over — otherwise a re-sync drops rejected matches back into the queue.
      review: was?.review ?? "pending",
      match_id: was?.match_id ?? null,
      decided_at: was?.decided_at ?? null,
      decided_by: was?.decided_by ?? null,
    };
  });

  const { error } = await admin.from("ps_matches").upsert(rows, { onConflict: "ps_id" });
  if (error) throw new Error(error.message);

  // A match that gets moved in PandaScore moves on the site too.
  let rescheduled = 0;
  for (const row of rows) {
    if (row.review !== "approved" || !row.match_id) continue;
    const psMatch = byId.get(Number(row.ps_id))!;
    const { error: upErr } = await admin
      .from("matches")
      .update({
        start_at: row.begin_at,
        format: formatOf(psMatch),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.match_id);
    if (!upErr) rescheduled++;
  }

  return {
    total: rows.length,
    added: rows.filter((r) => !prior.has(Number(r.ps_id))).length,
    rescheduled,
    quotaLeft: rateLimitRemaining(),
  };
}
