import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCompleteCard, groupTeams, type PortoGroupPicks } from "@/lib/porto-groups";

const SLUG = "blast-porto-2026";

/**
 * Each group closes on its own first match, not on the event.
 *
 * Group A plays on the 26th and group B on the 27th, so one blanket lock would
 * either shut B a day early or leave A open while it is being played.
 *
 * Closed by the clock, not by the status column. Status is set by a person, and
 * on the opening day nobody set it: Aurora — G2 kicked off at 09:00 and was
 * still marked `upcoming` an hour later, during which seven players filled in a
 * card for a group that was already being played. A lock that depends on
 * somebody remembering is not a lock. `start_at` needs remembering by nobody,
 * and the status check stays alongside it for a fixture brought forward or
 * started early.
 */
async function groupWindows(): Promise<Record<string, boolean>> {
  const { data } = await createAdminClient()
    .from("matches")
    .select("stage, status, start_at")
    .eq("tournament_slug", SLUG);
  const now = Date.now();
  const started: Record<string, boolean> = { a: false, b: false };
  for (const m of data ?? []) {
    const g = /^group\s*a/i.test(m.stage ?? "") ? "a" : /^group\s*b/i.test(m.stage ?? "") ? "b" : null;
    if (!g) continue;
    const due = m.start_at ? new Date(m.start_at as string).getTime() : Infinity;
    if (m.status !== "upcoming" || due <= now) started[g] = true;
  }
  return { a: !started.a, b: !started.b };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const open = await groupWindows();
  const teams = { a: groupTeams("a"), b: groupTeams("b") };

  if (!user) {
    return NextResponse.json({ ok: true, signedIn: false, open, teams, mine: {} });
  }

  const { data } = await createAdminClient()
    .from("porto_groups")
    .select("group_id, advance, zero_two, points, scored_at")
    .eq("user_id", user.id);

  const mine: Record<string, unknown> = {};
  for (const row of data ?? []) {
    mine[row.group_id as string] = {
      advance: row.advance,
      zeroTwo: row.zero_two,
      points: row.points,
      scored: !!row.scored_at,
    };
  }
  return NextResponse.json({ ok: true, signedIn: true, open, teams, mine });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const groupId = String(body?.group ?? "");
  const picks = body?.picks as Partial<PortoGroupPicks> | null;

  if (groupId !== "a" && groupId !== "b") {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (!isCompleteCard(groupId, picks)) {
    return NextResponse.json({ ok: false, error: "incomplete" }, { status: 400 });
  }

  const open = await groupWindows();
  if (!open[groupId]) {
    return NextResponse.json({ ok: false, error: "closed" }, { status: 409 });
  }

  const admin = createAdminClient();
  // A scored card is final: re-opening one would let a player rewrite a
  // prediction they have already been paid for.
  const { data: existing } = await admin
    .from("porto_groups")
    .select("scored_at")
    .eq("user_id", user.id)
    .eq("group_id", groupId)
    .maybeSingle();
  if (existing?.scored_at) {
    return NextResponse.json({ ok: false, error: "scored" }, { status: 409 });
  }

  const { error } = await admin.from("porto_groups").upsert(
    {
      user_id: user.id,
      group_id: groupId,
      advance: picks.advance,
      zero_two: picks.zeroTwo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,group_id" },
  );
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
