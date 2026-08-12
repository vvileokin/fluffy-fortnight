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

/** Who is eligible: an entry that hasn't been disqualified. */
async function eligible(admin: ReturnType<typeof createAdminClient>, slug: string) {
  const rows: { user_id: string }[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await admin
      .from("giveaway_entries")
      .select("user_id")
      .eq("giveaway_slug", slug)
      .eq("confirmed", true)
      .order("created_at")
      .range(from, from + step - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as { user_id: string }[]));
    if (!data || data.length < step) break;
  }
  return rows.map((r) => r.user_id);
}

/** Fisher–Yates over a CSPRNG. */
function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
      .select("user_id, confirmed, created_at")
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

  const count = Math.max(1, Math.min(Number(giveaway.winners_count ?? 1), pool.length));
  const picked = shuffle(pool).slice(0, count);

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
    `${redraw ? "Перерозіграв" : "Розіграв"} ${slug} — ${picked.length} переможц(ів) із ${pool.length} заявок`,
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
