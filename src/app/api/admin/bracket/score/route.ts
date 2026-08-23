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
  // Which round/team pairs have already been paid. The admin page keeps no
  // draft of its own — the ticks are lost on every reload, which read as "the
  // bracket won't save" — so the record of what was settled is the memory, and
  // it lives here rather than in a browser.
  const { data: brackets } = await admin
    .from("bracket_predictions")
    .select("scored_rounds")
    .eq("tournament_slug", "ewc-2026");
  const scoredTeams = [
    ...new Set(
      ((brackets ?? []) as { scored_rounds: string[] | null }[]).flatMap(
        (b) => b.scored_rounds ?? [],
      ),
    ),
  ];

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
    scoredTeams,
    favourites,
  });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "ewc-2026");
  const round = String(body?.round ?? "");
  const teams = Array.isArray(body?.teams) ? (body.teams as string[]) : [];

  if (!["qf", "sf", "final", "champion"].includes(round) || teams.length === 0) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();
  // One round at a time, so a bracket earns as the playoff goes rather than
  // sitting on nothing until the final is over. `score_bracket_round` records
  // which rounds a bracket has been paid for, so pressing this twice pays
  // nothing the second time — and it hands back only the players it paid.
  const { data, error } = await admin.rpc("score_bracket_round", {
    p_slug: slug,
    p_round: round,
    p_teams: teams,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // 0051 turns the integer return into a row per player paid. A deploy can land
  // before the migration is pasted in, and in that window the old function has
  // already taken the money by the time this line runs — so read the old shape
  // rather than throwing on it, and say plainly why nobody was notified.
  const migrated = Array.isArray(data);
  const wins = migrated ? (data as { user_id: string; gained: number; total: number }[]) : [];
  const scored = migrated ? wins.length : Number(data ?? 0);

  // Naming the round matters now that there are four payouts instead of one:
  // "+120 EWC" arriving with no reason attached is the kind of thing players
  // ask about in chat.
  const label = { qf: "1/4", sf: "1/2", final: "фінал", champion: "чемпіон" }[round];
  // What this round paid, sent to the people it paid.
  //
  // It used to go to every bracket in the tournament and quote the running
  // total, because the round marks a team settled for a player whether they
  // named it or not. Somebody who called none of the semi-finalists was told
  // "1/2 розраховано — разом 275 EWC", went to look at a balance of 100, and
  // read the whole thing as a payout that never arrived.
  const notifs = wins.map((w) => ({
    user_id: w.user_id,
    kind: "reward",
    title: `Сітка плей-офу · ${label} — +${w.gained} EWC, разом ${w.total}`,
  }));
  if (notifs.length > 0) await admin.from("notifications").insert(notifs);

  await logAdmin("bracket", `Розрахував сітки ${slug}, раунд ${round} — ${scored} гравцям`);
  return NextResponse.json({ ok: true, scored, round, migrated });
}
