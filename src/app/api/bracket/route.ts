import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCompleteBracket, type BracketPicks } from "@/lib/bracket-scoring";
import { EWC_PLAYOFF_TEAMS } from "@/lib/ewc-bracket";
import { playoffWindow } from "@/lib/db/playoff-window";

const SLUG = "ewc-2026";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const lock = await playoffWindow();
  if (!user) {
    return NextResponse.json({ ok: true, signedIn: false, ...lock, teams: EWC_PLAYOFF_TEAMS, mine: null });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("bracket_predictions")
    .select("picks, points, scored_at, scored_rounds")
    .eq("user_id", user.id)
    .eq("tournament_slug", SLUG)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    signedIn: true,
    ...lock,
    // The draw is fixed and lives in the bundle, so it never needed a query —
    // the form reads its round-of-16 fixtures straight from here.
    teams: EWC_PLAYOFF_TEAMS,
    mine: data
      ? {
          picks: data.picks,
          points: data.points,
          scored: !!data.scored_at,
          // Which round/team pairs have been settled. They are the real results,
          // identical for everybody, and they come free with the row already
          // being read — so the card can show which calls actually landed
          // instead of a total with no working shown.
          settled: (data.scored_rounds ?? []) as string[],
        }
      : null,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const lock = await playoffWindow();
  if (!lock.open) {
    return NextResponse.json(
      { ok: false, error: lock.started ? "closed" : "not_open" },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const picks = body?.picks as Partial<BracketPicks> | null;
  if (!isCompleteBracket(picks)) {
    return NextResponse.json({ ok: false, error: "incomplete" }, { status: 400 });
  }
  // Every name has to be one of the sixteen actually in the playoff — otherwise
  // a crafted request could bank points on a team that was never there.
  if (!picks.qf.every((s) => EWC_PLAYOFF_TEAMS.includes(s))) {
    return NextResponse.json({ ok: false, error: "unknown_team" }, { status: 400 });
  }

  const admin = createAdminClient();
  // The RLS policy already refuses to touch a scored row, but this route holds
  // the service key and RLS does not apply to it — so the same rule is enforced
  // here rather than assumed. Scoring must never move under a bracket that has
  // already been paid.
  const { data: existing } = await admin
    .from("bracket_predictions")
    .select("scored_at")
    .eq("user_id", user.id)
    .eq("tournament_slug", SLUG)
    .maybeSingle();
  if (existing?.scored_at) {
    return NextResponse.json({ ok: false, error: "already_scored" }, { status: 409 });
  }

  // Upsert, not insert. A bracket stays editable until it closes: nothing is
  // paid out until the playoff ends, so a change before the deadline costs
  // nobody anything, while one-shot entry punished filling it in early — the
  // exact behaviour the feature wants to encourage.
  const { error } = await admin
    .from("bracket_predictions")
    .upsert(
      { user_id: user.id, tournament_slug: SLUG, picks },
      { onConflict: "user_id,tournament_slug" },
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
