import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Five season points buy one EWC point. */
export const RATE = 5;

/**
 * What this player may exchange, and what it would cost.
 *
 * The cap is `points - ewc_earned_points`: gold that came out of the event
 * cannot be spent on more event currency, or the two columns would print each
 * other. Only season earnings convert.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true, signedIn: false, limit: 0, rate: RATE });

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("points, ewc_points, ewc_earned_points")
    .eq("id", user.id)
    .maybeSingle();

  // Before migration 0050 the column does not exist; the exchange simply isn't
  // offered rather than the profile page failing.
  if (error) {
    return NextResponse.json({ ok: true, signedIn: true, limit: 0, rate: RATE, ready: false });
  }

  const limit = Math.max((data?.points ?? 0) - (data?.ewc_earned_points ?? 0), 0);
  return NextResponse.json({
    ok: true,
    signedIn: true,
    ready: true,
    rate: RATE,
    limit,
    points: data?.points ?? 0,
    ewcPoints: data?.ewc_points ?? 0,
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

  const body = await request.json().catch(() => null);
  const gold = Number(body?.gold);
  if (!Number.isInteger(gold) || gold < RATE) {
    return NextResponse.json({ ok: false, error: "bad_amount" }, { status: 400 });
  }

  // The cap is re-checked inside `convert_points`, under a row lock — checking
  // it here would be reading a balance another request can move first.
  const { data, error } = await createAdminClient().rpc("convert_points", {
    p_user: user.id,
    p_gold: gold,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const out = data as { ok: boolean; error?: string; gained?: number; limit?: number };
  return NextResponse.json(out, { status: out.ok ? 200 : 409 });
}
