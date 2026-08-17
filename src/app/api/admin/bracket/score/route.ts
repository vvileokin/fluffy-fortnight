import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pay out every submitted bracket.
 *
 * The admin supplies who actually reached each round rather than the route
 * inferring it: the playoff ladder in `ewc-bracket.ts` describes shape only —
 * it carries no node ids for playoff matches — so there is nothing to reliably
 * match a finished fixture against. Guessing from stage labels would be a
 * silent source of wrong payouts, and this is a one-shot event where a wrong
 * payout can't be quietly corrected next round.
 *
 * `score_brackets` skips anything already scored, so a re-run tops up brackets
 * without paying anyone twice.
 */
/** How many brackets are in, and how many have already been paid. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const [{ count: total }, { count: scored }] = await Promise.all([
    admin
      .from("bracket_predictions")
      .select("user_id", { count: "exact", head: true })
      .eq("tournament_slug", "ewc-2026"),
    admin
      .from("bracket_predictions")
      .select("user_id", { count: "exact", head: true })
      .eq("tournament_slug", "ewc-2026")
      .not("scored_at", "is", null),
  ]);
  return NextResponse.json({ ok: true, total: total ?? 0, scored: scored ?? 0 });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "ewc-2026");
  const actual = body?.actual as
    | { qf?: string[]; sf?: string[]; final?: string[]; champion?: string }
    | undefined;

  if (!actual?.champion || !Array.isArray(actual.qf)) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("score_brackets", {
    p_slug: slug,
    p_actual: actual,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const scored = Number(data ?? 0);
  await logAdmin("bracket", `Розрахував сітки ${slug} — ${scored} гравцям`);
  return NextResponse.json({ ok: true, scored });
}
