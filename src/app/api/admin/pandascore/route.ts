import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { teams } from "@/lib/data";
import {
  matchesTodayAndTomorrow,
  formatOf,
  sidesOf,
  scoreFor,
  competitionOf,
  stageOf,
  kyivDayStart,
  rateLimitRemaining,
  PandaScoreError,
  type PsMatch,
} from "@/lib/pandascore";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type CatalogTeam = { slug: string; name: string; tag: string; logo: string; brand: string };

/** Teams indexed by every spelling we might recognise one by. */
function buildIndex(list: CatalogTeam[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const t of list) {
    for (const key of [t.name, t.tag, t.slug]) {
      const k = norm(key);
      if (k && !index.has(k)) index.set(k, t.slug);
    }
  }
  return index;
}

/** The hardcoded catalog plus anything created from an earlier import. */
async function fullCatalog(
  admin: ReturnType<typeof createAdminClient>,
): Promise<CatalogTeam[]> {
  const base: CatalogTeam[] = Object.values(teams).map((t) => ({
    slug: t.slug,
    name: t.name,
    tag: t.tag,
    logo: t.logo,
    brand: t.brand,
  }));
  const { data } = await admin.from("custom_teams").select("slug, name, tag, logo, brand");
  const known = new Set(base.map((t) => t.slug));
  for (const t of data ?? []) {
    if (!known.has(t.slug)) {
      base.push({ slug: t.slug, name: t.name, tag: t.tag, logo: t.logo ?? "", brand: t.brand });
    }
  }
  return base.sort((a, b) => a.name.localeCompare(b.name));
}

/** The inbox, newest first. `?review=` filters; defaults to what needs a decision. */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const review = new URL(request.url).searchParams.get("review") ?? "pending";
  const admin = createAdminClient();

  let query = admin
    .from("ps_matches")
    .select("*")
    .eq("review", review)
    .order("begin_at", { ascending: false })
    .limit(200);
  // The queue is only ever about today and tomorrow, so rows left pending from
  // earlier syncs drop out of view instead of piling up.
  if (review === "pending") query = query.gte("begin_at", kyivDayStart(0));

  const [{ data: rows, error }, { data: mappings }, catalog] = await Promise.all([
    query,
    admin.from("ps_teams").select("ps_team_id, slug"),
    fullCatalog(admin),
  ]);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const index = buildIndex(catalog);
  const mapped = new Map((mappings ?? []).map((m) => [Number(m.ps_team_id), m.slug as string]));
  // A side we've mapped before wins; otherwise fall back to matching by name.
  const resolve = (psId: number | null, name: string | null, acronym: string | null) => {
    const remembered = psId ? mapped.get(Number(psId)) : null;
    if (remembered) return remembered;
    for (const candidate of [name, acronym]) {
      const hit = candidate ? index.get(norm(candidate)) : null;
      if (hit) return hit;
    }
    return null;
  };

  const items = (rows ?? []).map((r) => ({
    ...r,
    suggested_a: resolve(r.team_a_ps_id, r.team_a_name, r.team_a_acronym),
    suggested_b: resolve(r.team_b_ps_id, r.team_b_name, r.team_b_acronym),
  }));

  return NextResponse.json({ ok: true, items, catalog });
}

/** Pull the latest CS2 fixtures into the inbox. Decisions already made stand. */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let fetched: PsMatch[];
  try {
    fetched = await matchesTodayAndTomorrow();
  } catch (e) {
    const err = e as PandaScoreError;
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: err.status === 429 ? 429 : 502 },
    );
  }

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
