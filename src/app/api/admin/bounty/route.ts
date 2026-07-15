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
  const lowSet = new Set(teams);
  const row = {
    stage_id: String(b.stage_id),
    teams,
    low_seeds: asSlugs(b.low_seeds).filter((s) => lowSet.has(s)),
    winners: asSlugs(b.winners).filter((s) => lowSet.has(s)),
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
