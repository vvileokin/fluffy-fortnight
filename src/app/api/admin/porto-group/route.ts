import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupTeams, PORTO_GROUP_SIZES } from "@/lib/porto-groups";

/**
 * Settling a 0-2 group.
 *
 * The result is entered by hand rather than inferred from the fixtures. A GSL
 * group's three qualifiers can be read off the ladder, but "went out without a
 * single series win" cannot: a team can be eliminated at 1-2 and it looks the
 * same from the outside as 0-2 unless every one of its matches is read. Payout
 * is one-shot, so a wrong inference has no round after it to correct in — an
 * admin ticking five names is slower and right.
 */

/** How many cards are in, how many are paid, and what each group picked. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("porto_groups")
    .select("group_id, advance, zero_two, points, scored_at");

  const rows = (data ?? []) as {
    group_id: string;
    advance: string[];
    zero_two: string[];
    points: number;
    scored_at: string | null;
  }[];

  const groups: Record<string, unknown> = {};
  for (const id of ["a", "b"]) {
    const mine = rows.filter((r) => r.group_id === id);
    // Who the field expects, so an admin can see the consensus before settling
    // — and afterwards, see what it cost.
    const advance: Record<string, number> = {};
    const zeroTwo: Record<string, number> = {};
    for (const r of mine) {
      for (const t of r.advance ?? []) advance[t] = (advance[t] ?? 0) + 1;
      for (const t of r.zero_two ?? []) zeroTwo[t] = (zeroTwo[t] ?? 0) + 1;
    }
    groups[id] = {
      total: mine.length,
      scored: mine.filter((r) => r.scored_at).length,
      paid: mine.reduce((n, r) => n + (r.points ?? 0), 0),
      teams: groupTeams(id),
      advance,
      zeroTwo,
    };
  }
  // Absent until 0068 runs, and absent reads as "not closed by hand" — which
  // is what it was before the switch existed.
  const { data: settings } = await admin
    .from("site_settings")
    .select("porto_club_closed")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    groups,
    closed: !!settings?.porto_club_closed,
  });
}

/**
 * Close the club early, or re-open it.
 *
 * Separate from settling because they are separate decisions: closing stops
 * cards being written, settling pays the ones that are in. An admin usually
 * does the first well before the second, and doing the second does not imply
 * the first.
 *
 * Re-opening is offered because the switch only overrides the clock — a group
 * whose match has started stays shut whatever this says, so the worst a
 * mistaken close can cost is the minutes until it is undone.
 */
export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const closed = !!body?.closed;

  const { error } = await createAdminClient()
    .from("site_settings")
    .update({ porto_club_closed: closed })
    .eq("id", 1);
  if (error) {
    const missing = error.code === "42703" || error.code === "PGRST204";
    return NextResponse.json(
      { ok: false, error: missing ? "Спершу запусти міграцію 0068" : error.message },
      { status: missing ? 409 : 500 },
    );
  }

  await logAdmin("porto", closed ? "Закрив клуб 0-2 достроково" : "Відкрив клуб 0-2 назад");
  return NextResponse.json({ ok: true, closed });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const groupId = String(body?.group ?? "");
  const advance = Array.isArray(body?.advance) ? (body.advance as string[]) : [];
  const zeroTwo = Array.isArray(body?.zeroTwo) ? (body.zeroTwo as string[]) : [];

  const pool = groupTeams(groupId);
  const valid =
    (groupId === "a" || groupId === "b") &&
    advance.length === PORTO_GROUP_SIZES.advance &&
    zeroTwo.length === PORTO_GROUP_SIZES.zeroTwo &&
    [...advance, ...zeroTwo].every((s) => pool.includes(s)) &&
    new Set([...advance, ...zeroTwo]).size === advance.length + zeroTwo.length;
  if (!valid) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();
  // `score_porto_group` skips any card already settled, so pressing this twice
  // pays nothing the second time.
  const { data, error } = await admin.rpc("score_porto_group", {
    p_group: groupId,
    p_advance: advance,
    p_zero_two: zeroTwo,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const scored = Number(data ?? 0);

  // Only the players who earned something hear about it. A card that called
  // none of the five is not news, and telling it "розраховано" beside a total
  // of zero is the mistake the bracket made at the World Cup.
  const { data: paid } = await admin
    .from("porto_groups")
    .select("user_id, points")
    .eq("group_id", groupId)
    .gt("points", 0);
  const notifs = (paid ?? []).map((r: { user_id: string; points: number }) => ({
    user_id: r.user_id,
    kind: "reward",
    title: `Клуб 0-2 · група ${groupId.toUpperCase()} розрахована — +${r.points}`,
  }));
  if (notifs.length > 0) await admin.from("notifications").insert(notifs);

  await logAdmin("porto", `Розрахував клуб 0-2, група ${groupId.toUpperCase()} — ${scored} карток`);
  return NextResponse.json({ ok: true, scored });
}
