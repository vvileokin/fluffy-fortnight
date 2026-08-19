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
/** Open or shut the bracket for everyone. */
export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const closed = !!body?.closed;

  // Opening means opening. Pairing the two flags here is what makes the button
  // honest: `started` would otherwise keep the bracket shut and the press would
  // appear to do nothing at all.
  const { error } = await createAdminClient()
    .from("site_settings")
    .update({ bracket_closed: closed, bracket_force_open: !closed })
    .eq("id", 1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await logAdmin("bracket", closed ? "Закрив сітку плей-офу" : "Відкрив сітку плей-офу");
  return NextResponse.json({ ok: true, closed });
}

/** How many brackets are in, how many are paid, and whether picks are open. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("site_settings")
    .select("bracket_closed, bracket_force_open")
    .eq("id", 1)
    .maybeSingle();
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
  // Who backed whom, so an admin can see the spread before the playoff runs —
  // and afterwards, work out what the underdog band actually cost.
  const { data: favs } = await admin
    .from("favourite_teams")
    .select("team_slug")
    .eq("tournament_slug", "ewc-2026");
  const favourites: Record<string, number> = {};
  for (const f of (favs ?? []) as { team_slug: string }[]) {
    favourites[f.team_slug] = (favourites[f.team_slug] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    total: total ?? 0,
    scored: scored ?? 0,
    closed: !!settings?.bracket_closed,
    forceOpen: !!settings?.bracket_force_open,
    favourites,
  });
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

  // Everything else that pays tells the player it paid; the bracket was the one
  // silent payout, which is the worst kind — points appear and nothing accounts
  // for them. Read back after scoring so the figure quoted is the one banked.
  const { data: paid } = await admin
    .from("bracket_predictions")
    .select("user_id, points")
    .eq("tournament_slug", slug)
    .not("scored_at", "is", null);
  const notifs = (paid ?? []).map((b: { user_id: string; points: number | null }) => ({
    user_id: b.user_id,
    kind: "reward",
    title: `Сітка плей-офу розрахована — +${b.points ?? 0} EWC`,
  }));
  if (notifs.length > 0) await admin.from("notifications").insert(notifs);

  await logAdmin("bracket", `Розрахував сітки ${slug} — ${scored} гравцям`);
  return NextResponse.json({ ok: true, scored });
}
