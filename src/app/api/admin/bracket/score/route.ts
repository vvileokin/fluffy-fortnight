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
