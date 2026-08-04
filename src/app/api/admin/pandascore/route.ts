import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { kyivDayStart, PandaScoreError } from "@/lib/pandascore";
import { runPandaScoreSync } from "@/lib/pandascore-sync";
import { buildTeamIndex, resolveTeamSlug, fullTeamCatalog } from "@/lib/team-match";

/** The hardcoded catalog plus anything created from an earlier import, sorted. */
async function fullCatalog(admin: ReturnType<typeof createAdminClient>) {
  return (await fullTeamCatalog(admin)).sort((a, b) => a.name.localeCompare(b.name));
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
  // The queue is only ever about today and tomorrow: rows left pending from
  // earlier syncs drop out of view instead of piling up, and nothing further
  // ahead shows up either.
  if (review === "pending") {
    query = query.gte("begin_at", kyivDayStart(0)).lt("begin_at", kyivDayStart(2));
  }

  const [{ data: rows, error }, { data: mappings }, catalog] = await Promise.all([
    query,
    admin.from("ps_teams").select("ps_team_id, slug"),
    fullCatalog(admin),
  ]);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const index = buildTeamIndex(catalog);
  const mapped = new Map((mappings ?? []).map((m) => [Number(m.ps_team_id), m.slug as string]));
  // A side we've mapped before wins; otherwise fall back to matching by name.
  const resolve = (psId: number | null, name: string | null, acronym: string | null) => {
    const remembered = psId ? mapped.get(Number(psId)) : null;
    return remembered ?? resolveTeamSlug(index, name, acronym);
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
  try {
    const r = await runPandaScoreSync();
    await logAdmin(
      "import",
      `Синхронізував PandaScore: ${r.total} матчів, нових ${r.added}, оновлено час у ${r.rescheduled}`,
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const err = e as PandaScoreError;
    return NextResponse.json(
      { ok: false, error: err.message || "Помилка синхронізації" },
      { status: err.status === 429 ? 429 : 502 },
    );
  }
}

export const dynamic = "force-dynamic";
