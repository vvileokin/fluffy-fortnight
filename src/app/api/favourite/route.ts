import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EWC_PLAYOFF_TEAMS } from "@/lib/ewc-bracket";
import { playoffWindow } from "@/lib/db/playoff-window";

const SLUG = "ewc-2026";

/**
 * Open exactly as long as the bracket is — the same switch, deliberately.
 *
 * They are the same decision taken at the same moment (pick your sixteen, pick
 * your one), so closing one but not the other would be arbitrary and would let
 * a player hedge a locked bracket with a fresh team.
 */

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const window = await playoffWindow();
  if (!user) {
    return NextResponse.json({ ok: true, signedIn: false, ...window, team: null, earned: 0 });
  }

  const admin = createAdminClient();
  const [{ data: pick }, { data: payouts }] = await Promise.all([
    admin
      .from("favourite_teams")
      .select("team_slug")
      .eq("user_id", user.id)
      .eq("tournament_slug", SLUG)
      .maybeSingle(),
    admin.from("favourite_payouts").select("amount").eq("user_id", user.id),
  ]);

  return NextResponse.json({
    ok: true,
    signedIn: true,
    ...window,
    team: pick?.team_slug ?? null,
    earned: (payouts ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0),
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

  const { open } = await playoffWindow();
  if (!open) {
    return NextResponse.json({ ok: false, error: "closed" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const team = String(body?.team ?? "");
  // Only the sixteen actually in the draw — otherwise a crafted request could
  // park a player on a team that has no fixtures and no way to be paid.
  if (!EWC_PLAYOFF_TEAMS.includes(team)) {
    return NextResponse.json({ ok: false, error: "unknown_team" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("favourite_teams")
    .upsert(
      { user_id: user.id, tournament_slug: SLUG, team_slug: team },
      { onConflict: "user_id,tournament_slug" },
    );
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, team });
}
