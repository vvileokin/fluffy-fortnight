import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeStreaks } from "@/lib/db/streaks";

/** Any positive whole number of points. Mirrored in `place_bet`. */
export const MIN_STAKE = 1;

/**
 * One slip, or the whole history.
 *
 * `?question=` is the card asking about itself; no parameter is the profile
 * asking for everything, newest first, with the question titles joined on so a
 * settled slip still says what it was a bet on.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true, signedIn: false, bet: null, bets: [] });

  const questionId = new URL(request.url).searchParams.get("question");
  if (!questionId) {
    const { data } = await createAdminClient()
      .from("bets")
      .select("question_id, option_id, stake, odds, payout, settled_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = data ?? [];

    // Titles and option labels live on the question, and a slip outlives the
    // card it was placed from — without this the history reads as bare ids.
    const ids = [...new Set(rows.map((b) => b.question_id))];
    const { data: qs } = ids.length
      ? await createAdminClient().from("questions").select("id, title, options").in("id", ids)
      : { data: [] };
    const byId = new Map((qs ?? []).map((q) => [q.id, q]));

    return NextResponse.json({
      ok: true,
      signedIn: true,
      bets: rows.map((b) => {
        const q = byId.get(b.question_id) as
          | { title: string; options: { id: string; label: string }[] }
          | undefined;
        return {
          ...b,
          title: q?.title ?? b.question_id,
          option: (Array.isArray(q?.options) ? q.options : []).find((o) => o.id === b.option_id)
            ?.label,
        };
      }),
    });
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

/**
 * Take a bet back while the question is still open.
 *
 * Nothing is at stake for the house in allowing it — the question hasn't been
 * resolved, so no coefficient has been proven right or wrong yet, and the stake
 * returns to exactly where it came from. A mis-tap on the wrong option, or on a
 * stake with an extra zero, otherwise stood for good.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const questionId = typeof body?.question === "string" ? body.question : "";
  if (!questionId) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const { data, error } = await createAdminClient().rpc("cancel_bet", {
    p_user: user.id,
    p_question: questionId,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const out = data as { ok: boolean; error?: string; refunded?: number };
  // A withdrawn slip is an outcome that no longer exists, so the run it fed has
  // to be replayed. Doing it here is what keeps the streak true without anyone
  // pressing anything.
  if (out.ok) await recomputeStreaks(createAdminClient(), [user.id]);
  return NextResponse.json(out, { status: out.ok ? 200 : 409 });
}
