import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The draw.
 *
 * Everything here runs on the service role, because the whole security model of
 * a giveaway is that a participant can never write the result. `giveaway_winners`
 * has a public SELECT policy and deliberately no INSERT policy, so this route is
 * the only path that can create one.
 *
 * The shuffle uses `crypto.randomInt`, not `Math.random()`. For a prize with real
 * money on it, "the winner was picked by a PRNG seeded from the clock" is not a
 * sentence you want to have to defend.
 */

/**
 * Who is eligible, one slot per ticket.
 *
 * A player holding five tickets appears five times, which is the whole point
 * of paying for them. `tickets` is absent until migration 0035, so a row
 * without it counts once — the one-entry-per-person giveaway this used to be.
 */
async function eligible(admin: ReturnType<typeof createAdminClient>, slug: string) {
  const rows: { user_id: string; tickets?: number }[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await admin
      .from("giveaway_entries")
      .select("user_id, tickets")
      .eq("giveaway_slug", slug)
      .eq("confirmed", true)
      .order("created_at")
      .range(from, from + step - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as { user_id: string; tickets?: number }[]));
    if (!data || data.length < step) break;
  }

  const pool: string[] = [];
  for (const r of rows) {
    const n = Math.max(1, Number(r.tickets ?? 1));
    for (let i = 0; i < n; i++) pool.push(r.user_id);
  }
  return pool;
}

/**
 * Weighted draw without replacement.
 *
 * Each ticket is a separate chance, but the moment someone wins, every ticket
 * they hold leaves the bag — so seven prizes go to seven different people. The
 * alternative (leaving the tickets in) lets one person with five tickets take
 * two or three of the seven skins, which is not what anybody means by "more
 * tickets, better odds".
 *
 * `randomInt` rather than `Math.random()`: for a prize with real money on it,
 * "the winner was picked by a PRNG seeded from the clock" is not a sentence
 * you want to have to defend.
 */
function draw(pool: string[], count: number): string[] {
  let bag = [...pool];
  const picked: string[] = [];
  while (picked.length < count && bag.length > 0) {
    const winner = bag[randomInt(bag.length)];
    picked.push(winner);
    bag = bag.filter((id) => id !== winner);
  }
  return picked;
}

/**
 * Entries + current result for the admin panel.
 *
 * This has to be a server route: `giveaway_entries` only lets a player read
 * their own row, so an admin reading the full list from the browser would see
 * exactly one entry — their own. The service role is the only thing that can
 * see the whole field.
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!slug) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const admin = createAdminClient();

  const [{ data: entries }, { data: winners }, { data: giveaway }] = await Promise.all([
    admin
      .from("giveaway_entries")
      .select("user_id, confirmed, created_at, tickets, spent")
      .eq("giveaway_slug", slug)
      .order("created_at"),
    admin
      .from("giveaway_winners")
      .select("user_id, place")
      .eq("giveaway_slug", slug)
      .order("place"),
    admin
      .from("giveaways")
      .select("drawn_at, winners_count")
      .eq("slug", slug)
      .maybeSingle(),
  ]);

  const ids = [
    ...new Set([
      ...(entries ?? []).map((e) => e.user_id as string),
      ...(winners ?? []).map((w) => w.user_id as string),
    ]),
  ];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, handle, avatar_url, points").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  return NextResponse.json({
    ok: true,
    drawnAt: giveaway?.drawn_at ?? null,
    winnersCount: giveaway?.winners_count ?? 1,
    entries: (entries ?? []).map((e) => ({
      userId: e.user_id,
      handle: (byId.get(e.user_id as string)?.handle as string) || "гравець",
      avatarUrl: (byId.get(e.user_id as string)?.avatar_url as string) || null,
      points: (byId.get(e.user_id as string)?.points as number) ?? 0,
      confirmed: e.confirmed,
      createdAt: e.created_at,
      tickets: (e.tickets as number) ?? 1,
      spent: (e.spent as number) ?? 0,
    })),
    winners: (winners ?? []).map((w) => ({
      userId: w.user_id,
      handle: (byId.get(w.user_id as string)?.handle as string) || "гравець",
      place: w.place,
    })),
  });
}

/** Disqualify / reinstate a single entry before the draw. */
export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "");
  const userId = String(body?.userId ?? "");
  const confirmed = body?.confirmed === true;
  if (!slug || !userId) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("giveaway_entries")
    .update({ confirmed })
    .eq("giveaway_slug", slug)
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  await logAdmin(
    "giveaways",
    `${confirmed ? "Поновив" : "Дискваліфікував"} заявку в ${slug}`,
  );
  return NextResponse.json({ ok: true });
}

/**
 * Replace one winner, leave the other six alone.
 *
 * `redraw` throws the whole result away, which is the right tool when the draw
 * itself was wrong and the wrong one when a single name is. Seven skins go to
 * seven people; if one of them turns out to be an admin, rerolling all seven
 * takes the prize back off six players who did nothing but win it, and they
 * have already been told they won.
 *
 * The replaced entry is disqualified rather than dropped back in the bag. The
 * reason for pulling a name is almost never "this particular spin" — it is that
 * the person should not have been eligible — so leaving their tickets in would
 * let the next spin hand them the same prize back.
 */
export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "");
  const target = String(body?.userId ?? "");
  if (!slug || !target) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: giveaway } = await admin
    .from("giveaways")
    .select("slug, prize")
    .eq("slug", slug)
    .maybeSingle();
  if (!giveaway) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const { data: winners } = await admin
    .from("giveaway_winners")
    .select("user_id, place")
    .eq("giveaway_slug", slug);
  const row = (winners ?? []).find((w) => w.user_id === target);
  if (!row) {
    return NextResponse.json({ ok: false, error: "not_a_winner" }, { status: 400 });
  }

  // Out of the bag for good, before the pool is read.
  await admin
    .from("giveaway_entries")
    .update({ confirmed: false })
    .eq("giveaway_slug", slug)
    .eq("user_id", target);

  let pool: string[];
  try {
    pool = await eligible(admin, slug);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "entries_failed" },
      { status: 500 },
    );
  }

  // Everybody already holding a place is out of contention too, or the reroll
  // could hand one person two of the seven.
  const held = new Set((winners ?? []).map((w) => w.user_id as string));
  const bag = pool.filter((id) => !held.has(id));
  if (bag.length === 0) {
    return NextResponse.json({ ok: false, error: "no_candidates" }, { status: 400 });
  }

  const replacement = bag[randomInt(bag.length)];

  await admin
    .from("giveaway_winners")
    .delete()
    .eq("giveaway_slug", slug)
    .eq("user_id", target);
  const { error: wErr } = await admin
    .from("giveaway_winners")
    .insert({ giveaway_slug: slug, user_id: replacement, place: row.place });
  if (wErr) {
    return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });
  }

  await admin.from("notifications").insert({
    user_id: replacement,
    kind: "giveaway",
    title: `Ти виграв: ${giveaway.prize}`,
  });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, handle")
    .in("id", [target, replacement]);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p.handle as string]));

  await logAdmin(
    "giveaways",
    `Перекрутив місце ${row.place} в ${slug}: ${byId.get(target) ?? target} → ${byId.get(replacement) ?? replacement}`,
  );

  return NextResponse.json({
    ok: true,
    place: row.place,
    replaced: { userId: target, handle: byId.get(target) || "гравець" },
    winner: { userId: replacement, handle: byId.get(replacement) || "гравець", place: row.place },
  });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "");
  const redraw = body?.redraw === true;
  if (!slug) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: giveaway, error: gErr } = await admin
    .from("giveaways")
    .select("slug, prize, winners_count, drawn_at")
    .eq("slug", slug)
    .maybeSingle();
  if (gErr) return NextResponse.json({ ok: false, error: gErr.message }, { status: 500 });
  if (!giveaway) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // A second draw silently replacing the first is how a giveaway loses its
  // credibility. It takes an explicit redraw flag, and it is written to the
  // audit log as a redraw, not as a draw.
  if (giveaway.drawn_at && !redraw) {
    return NextResponse.json(
      { ok: false, error: "already_drawn" },
      { status: 409 },
    );
  }

  let pool: string[];
  try {
    pool = await eligible(admin, slug);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "entries_failed" },
      { status: 500 },
    );
  }

  if (pool.length === 0) {
    return NextResponse.json({ ok: false, error: "no_entries" }, { status: 400 });
  }

  // Capped by *people*, not tickets: five tickets in one pair of hands can
  // still only produce one winner.
  const people = new Set(pool).size;
  const count = Math.max(1, Math.min(Number(giveaway.winners_count ?? 1), people));
  const picked = draw(pool, count);

  // Replace any previous result wholesale so a redraw can't leave stale winners.
  await admin.from("giveaway_winners").delete().eq("giveaway_slug", slug);

  const { error: wErr } = await admin.from("giveaway_winners").insert(
    picked.map((user_id, i) => ({
      giveaway_slug: slug,
      user_id,
      place: i + 1,
    })),
  );
  if (wErr) {
    return NextResponse.json({ ok: false, error: wErr.message }, { status: 500 });
  }

  const drawnAt = new Date().toISOString();
  await admin
    .from("giveaways")
    .update({ drawn_at: drawnAt, status: "finished", updated_at: drawnAt })
    .eq("slug", slug);

  // Tell the winners. Everyone else finds out on the giveaway page.
  await admin.from("notifications").insert(
    picked.map((user_id) => ({
      user_id,
      kind: "giveaway",
      title: `Ти виграв: ${giveaway.prize}`,
    })),
  );

  await logAdmin(
    "giveaways",
    `${redraw ? "Перерозіграв" : "Розіграв"} ${slug} — ${picked.length} переможц(ів) із ${people} учасників (${pool.length} квитків)`,
  );

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, handle")
    .in("id", picked);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p.handle as string]));

  return NextResponse.json({
    ok: true,
    entries: pool.length,
    winners: picked.map((id, i) => ({
      userId: id,
      handle: byId.get(id) || "гравець",
      place: i + 1,
    })),
  });
}
