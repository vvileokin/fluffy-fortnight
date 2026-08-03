import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { teams } from "@/lib/data";
import {
  upcomingMatches,
  runningMatches,
  pastMatches,
  formatOf,
  sidesOf,
  scoreFor,
  rateLimitRemaining,
  PandaScoreError,
  type PsMatch,
} from "@/lib/pandascore";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Our catalog, indexed by every spelling we might recognise a team by. */
const catalogIndex = (() => {
  const index = new Map<string, string>();
  for (const t of Object.values(teams)) {
    for (const key of [t.name, t.tag, t.slug]) {
      const k = norm(key);
      if (k && !index.has(k)) index.set(k, t.slug);
    }
  }
  return index;
})();

/** Best guess at which of our teams a PandaScore side is, or null. */
function guessSlug(name: string | null, acronym: string | null): string | null {
  for (const candidate of [name, acronym]) {
    if (!candidate) continue;
    const hit = catalogIndex.get(norm(candidate));
    if (hit) return hit;
  }
  return null;
}

/** The inbox, newest first. `?review=` filters; defaults to what needs a decision. */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const review = new URL(request.url).searchParams.get("review") ?? "pending";
  const admin = createAdminClient();

  const [{ data: rows, error }, { data: mappings }] = await Promise.all([
    admin
      .from("ps_matches")
      .select("*")
      .eq("review", review)
      .order("begin_at", { ascending: false })
      .limit(200),
    admin.from("ps_teams").select("ps_team_id, slug"),
  ]);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const mapped = new Map((mappings ?? []).map((m) => [Number(m.ps_team_id), m.slug as string]));
  // A side we've mapped before wins; otherwise fall back to matching by name.
  const resolve = (psId: number | null, name: string | null, acronym: string | null) =>
    (psId ? mapped.get(Number(psId)) : null) ?? guessSlug(name, acronym);

  const items = (rows ?? []).map((r) => ({
    ...r,
    suggested_a: resolve(r.team_a_ps_id, r.team_a_name, r.team_a_acronym),
    suggested_b: resolve(r.team_b_ps_id, r.team_b_name, r.team_b_acronym),
  }));

  return NextResponse.json({ ok: true, items });
}

/** Pull the latest CS2 fixtures into the inbox. Decisions already made stand. */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let fetched: PsMatch[];
  try {
    const [upcoming, running, past] = await Promise.all([
      upcomingMatches(),
      runningMatches(),
      pastMatches(),
    ]);
    fetched = [...upcoming, ...running, ...past];
  } catch (e) {
    const err = e as PandaScoreError;
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: err.status === 429 ? 429 : 502 },
    );
  }

  // De-duplicate: a match can be in two lists as it flips state mid-sync.
  const byId = new Map(fetched.map((m) => [m.id, m]));
  const admin = createAdminClient();

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
      // Carry the decision over — an upsert replaces the whole row, and without
      // this a re-sync would drop rejected matches back into the queue.
      review: was?.review ?? "pending",
      match_id: was?.match_id ?? null,
      decided_at: was?.decided_at ?? null,
      decided_by: was?.decided_by ?? null,
    };
  });

  const { error } = await admin.from("ps_matches").upsert(rows, { onConflict: "ps_id" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // PandaScore owns the calendar, so keep approved matches' time and best-of in
  // step with it. Maps, veto and scores are ours and are never touched here.
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

  const added = rows.filter((r) => !prior.has(Number(r.ps_id))).length;
  await logAdmin(
    "import",
    `Синхронізував PandaScore: ${rows.length} матчів, нових ${added}, оновлено час у ${rescheduled}`,
  );

  return NextResponse.json({
    ok: true,
    total: rows.length,
    added,
    rescheduled,
    quotaLeft: rateLimitRemaining(),
  });
}

export const dynamic = "force-dynamic";
