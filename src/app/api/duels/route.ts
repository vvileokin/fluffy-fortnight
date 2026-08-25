import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SLUG = "blast-porto-2026";
/** The open board speaks in tiers so challenges can find a pair. */
export const DUEL_TIERS = [50, 100, 250, 500];

type DuelRow = {
  id: string;
  match_id: string;
  challenger: string;
  side: "a" | "b";
  opponent: string | null;
  stake: number;
  status: string;
  winner: string | null;
};

/** Handles for a set of ids, in one read. */
async function handles(ids: string[]) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (clean.length === 0) return new Map<string, { handle: string; avatarUrl: string | null }>();
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, handle, avatar_url")
    .in("id", clean);
  return new Map(
    (data ?? []).map((p) => [
      p.id as string,
      { handle: (p.handle as string) || "гравець", avatarUrl: (p.avatar_url as string) ?? null },
    ]),
  );
}

/**
 * `?match=` — the board for one fixture, plus your own duel on it.
 * `?mine=1`  — everything you are in, newest first.
 *
 * Read through the service role rather than the browser's client. A duel has
 * two people in it and both need naming, and `profiles` is not the caller's to
 * read in bulk — the RLS policy on `duels` decides what may be *seen*, and this
 * route only ever returns what it allows.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = new URL(request.url);
  const matchId = url.searchParams.get("match");
  const mine = url.searchParams.get("mine") === "1";
  const admin = createAdminClient();

  let query = admin
    .from("duels")
    .select("id, match_id, challenger, side, opponent, stake, status, winner")
    .order("created_at", { ascending: false });

  if (matchId) {
    query = query.eq("match_id", matchId);
  } else if (mine) {
    if (!user) return NextResponse.json({ ok: true, duels: [], signedIn: false });
    query = query.or(`challenger.eq.${user.id},opponent.eq.${user.id}`).limit(40);
  } else {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // The same rule the RLS policy states, applied here because this read runs
  // as the service role: the board is open challenges with nobody named, and
  // everything else belongs to the two people in it.
  const rows = ((data ?? []) as DuelRow[]).filter(
    (d) =>
      (d.status === "open" && d.opponent === null) ||
      (!!user && (d.challenger === user.id || d.opponent === user.id)),
  );

  const by = await handles(rows.flatMap((d) => [d.challenger, d.opponent ?? ""]));
  return NextResponse.json({
    ok: true,
    signedIn: !!user,
    me: user?.id ?? null,
    duels: rows.map((d) => ({
      id: d.id,
      matchId: d.match_id,
      side: d.side,
      stake: d.stake,
      status: d.status,
      winner: d.winner,
      challenger: { id: d.challenger, ...(by.get(d.challenger) ?? { handle: "гравець", avatarUrl: null }) },
      opponent: d.opponent
        ? { id: d.opponent, ...(by.get(d.opponent) ?? { handle: "гравець", avatarUrl: null }) }
        : null,
    })),
  });
}

/** Post a challenge — open to the board, or straight at one person. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const matchId = String(body?.match ?? "");
  const side = String(body?.side ?? "");
  const stake = Math.floor(Number(body?.stake ?? 0));
  const opponent = body?.opponent ? String(body.opponent) : null;

  if (!matchId || (side !== "a" && side !== "b") || !Number.isFinite(stake) || stake < 1) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  // Checked here as well as in the function: a refusal that arrives as a
  // readable error beats one that arrives as a database code.
  if (!opponent && !DUEL_TIERS.includes(stake)) {
    return NextResponse.json({ ok: false, error: "bad_tier" }, { status: 400 });
  }

  const { data, error } = await createAdminClient().rpc("duel_create", {
    p_user: user.id,
    p_match: matchId,
    p_side: side,
    p_stake: stake,
    p_opponent: opponent,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

/** Take a challenge. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const { data, error } = await createAdminClient().rpc("duel_accept", {
    p_user: user.id,
    p_duel: id,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

/**
 * Pull your own untaken challenge, or turn down one aimed at you.
 *
 * Both refund the challenger in full and neither is offered once somebody has
 * staked against the duel — at that point the points are two people's, and one
 * of them cannot hand back what the other has committed.
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
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const { data, error } = await createAdminClient().rpc("duel_withdraw", {
    p_user: user.id,
    p_duel: id,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export { SLUG };
