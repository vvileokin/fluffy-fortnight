import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Create / update a match (admin only, service-role write).
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const m = await request.json().catch(() => null);
  if (!m?.id || !m.team_a || !m.team_b) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const row = {
    id: String(m.id),
    tournament_slug: String(m.tournament_slug ?? "blast-bounty-s2"),
    is_event: Boolean(m.is_event),
    team_a: String(m.team_a),
    team_b: String(m.team_b),
    status: String(m.status ?? "upcoming"),
    format: String(m.format ?? "BO3"),
    stage: m.stage ? String(m.stage) : null,
    time_label: m.time_label ? String(m.time_label) : null,
    start_at: m.start_at || null,
    score_a: Number(m.score_a ?? 0),
    score_b: Number(m.score_b ?? 0),
    live_map_label: m.live_map_label ? String(m.live_map_label) : null,
    live_round_a: Number(m.live_round_a ?? 0),
    live_round_b: Number(m.live_round_b ?? 0),
    maps: Array.isArray(m.maps) ? m.maps : [],
    veto: Array.isArray(m.veto) ? m.veto : [],
    h2h: m.h2h ?? null,
    open_questions: Number(m.open_questions ?? 0),
    max_reward: Number(m.max_reward ?? 0),
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { error } = await admin.from("matches").upsert(row, { onConflict: "id" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await request.json().catch(() => ({ id: "" }));
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("matches").delete().eq("id", String(id));
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
