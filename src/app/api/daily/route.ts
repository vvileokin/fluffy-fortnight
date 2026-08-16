import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dailyState } from "@/lib/daily";

/**
 * Where the signed-in player stands on the ladder.
 *
 * Read-only: the modal calls this to decide whether to open and which day to
 * highlight. Claiming goes through POST, which is the only thing that pays.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("daily_day, daily_claimed_on")
    .eq("id", user.id)
    .maybeSingle();

  // Absent until migration 0037 runs. Reporting "nothing to claim" keeps the
  // modal shut rather than showing a ladder that can't pay out.
  if (error || !data) {
    return NextResponse.json({ ok: true, available: false, nextDay: 1, amount: 0 });
  }

  const state = dailyState(
    (data.daily_claimed_on as string | null) ?? null,
    Number(data.daily_day ?? 0),
  );
  return NextResponse.json({ ok: true, ...state });
}

/** Claim it. The database decides the day and the amount; this just asks. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_daily_reward", { p_user: user.id });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    day?: number;
    amount?: number;
  };
  // `already_claimed` is the honest answer to a second tap, not a fault — the
  // client shows the ladder as claimed rather than an error.
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
