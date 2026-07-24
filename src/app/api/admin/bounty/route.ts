import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Save one BLAST Bounty stage's state (teams, low seeds, winners, deadline, lock).
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const b = await request.json().catch(() => null);
  if (!b?.stage_id) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const asSlugs = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const teams = asSlugs(b.teams);
  const teamSet = new Set(teams);
  const rawResults =
    b.results && typeof b.results === "object" && !Array.isArray(b.results) ? b.results : {};
  const results: Record<string, string> = {};
  for (const [low, high] of Object.entries(rawResults)) {
    if (teamSet.has(low) && typeof high === "string" && teamSet.has(high)) results[low] = high;
  }
  // Per-team seed number (position in the seeding); only keep valid teams/numbers.
  const rawSeeds =
    b.seeds && typeof b.seeds === "object" && !Array.isArray(b.seeds) ? b.seeds : {};
  const seeds: Record<string, number> = {};
  for (const [slug, n] of Object.entries(rawSeeds)) {
    const num = Number(n);
    if (teamSet.has(slug) && Number.isFinite(num)) seeds[slug] = num;
  }
  const row = {
    stage_id: String(b.stage_id),
    teams,
    low_seeds: asSlugs(b.low_seeds).filter((s) => teamSet.has(s)),
    winners: asSlugs(b.winners).filter((s) => teamSet.has(s)),
    results,
    seeds,
    locked: Boolean(b.locked),
    deadline: b.deadline ? new Date(b.deadline).toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { error } = await admin.from("bounty_stages").upsert(row, { onConflict: "stage_id" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
