import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const MIN_STAKE = 50;

/** This player's slip for one question, so the card can render it back. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true, signedIn: false, bet: null });

  const questionId = new URL(request.url).searchParams.get("question");
  if (!questionId) {
    return NextResponse.json({ ok: false, error: "missing_question" }, { status: 400 });
  }

  const { data } = await createAdminClient()
    .from("bets")
    .select("option_id, stake, odds, payout, settled_at")
    .eq("user_id", user.id)
    .eq("question_id", questionId)
    .maybeSingle();

  return NextResponse.json({ ok: true, signedIn: true, bet: data ?? null });
}

/**
 * Place one bet.
 *
 * Every check that matters — the question is open and takes bets, the option
 * exists, the balance covers the stake — happens inside `place_bet`, under a
 * row lock on the profile. Doing any of it here would be checking a balance
 * that another request can change before the write lands.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const questionId = typeof body?.question === "string" ? body.question : "";
  const optionId = typeof body?.option === "string" ? body.option : "";
  const stake = Number(body?.stake);

  if (!questionId || !optionId || !Number.isInteger(stake) || stake < MIN_STAKE) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const { data, error } = await createAdminClient().rpc("place_bet", {
    p_user: user.id,
    p_question: questionId,
    p_option: optionId,
    p_stake: stake,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const out = data as { ok: boolean; error?: string; odds?: number; balance?: number };
  // A refusal is the rules working, so it comes back as a 409 the card can
  // explain rather than a 500 it can only apologise for.
  return NextResponse.json(out, { status: out.ok ? 200 : 409 });
}
