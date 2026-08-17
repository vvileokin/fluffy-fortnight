import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCompleteBracket, type BracketPicks } from "@/lib/bracket-scoring";
import { EWC_PLAYOFF_TEAMS } from "@/lib/ewc-bracket";
import { getMatches } from "@/lib/db/matches";

const SLUG = "ewc-2026";

/**
 * The playoff shuts the moment the first playoff match starts.
 *
 * The field is the published draw, not whatever fixtures an admin happens to
 * have created — the sixteen are known and the form should be fillable now,
 * rather than waiting on eight rows being typed in to unlock itself.
 *
 * The deadline still reads from the matches rather than a date in a config:
 * the schedule moves, and a hardcoded deadline that drifts past the first game
 * would let someone submit a bracket with a result already on the board. No
 * playoff fixture existing yet simply means nothing has started.
 */
async function playoffLock() {
  const matches = await getMatches();
  const started = matches.some(
    (m) =>
      m.tournamentSlug === SLUG &&
      m.status !== "upcoming" &&
      /playoff|плей|1\/8|1\/4|1\/2|фінал/i.test(m.stage ?? ""),
  );
  return { open: !started, started, teams: EWC_PLAYOFF_TEAMS };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const lock = await playoffLock();
  if (!user) {
    return NextResponse.json({ ok: true, signedIn: false, ...lock, mine: null });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("bracket_predictions")
    .select("picks, points, scored_at")
    .eq("user_id", user.id)
    .eq("tournament_slug", SLUG)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    signedIn: true,
    ...lock,
    mine: data
      ? { picks: data.picks, points: data.points, scored: !!data.scored_at }
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

  const lock = await playoffLock();
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
  if (!picks.qf.every((s) => lock.teams.includes(s))) {
    return NextResponse.json({ ok: false, error: "unknown_team" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("bracket_predictions")
    .insert({ user_id: user.id, tournament_slug: SLUG, picks });

  if (error) {
    // The primary key is the guard against a second submission, so a unique
    // violation here is the feature working, not a fault.
    const already = error.code === "23505";
    return NextResponse.json(
      { ok: false, error: already ? "already_submitted" : error.message },
      { status: already ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
