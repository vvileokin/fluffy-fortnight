import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeam } from "@/lib/data";
import {
  favouritePayout,
  playoffRoundOf,
  roundFromStage,
} from "@/lib/favourite-team";
import type { SupabaseClient } from "@supabase/supabase-js";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/** Readable url part for one side: the custom name if set, else the catalog slug. */
function sidePart(slug: string, customName?: string | null): string {
  return slugify(customName || slug) || "team";
}

type MapScore = { name?: string; a?: number; b?: number };

/** Maps to win the series: 1 for BO1, 2 for BO3, 3 for BO5. */
function winsNeeded(format: string): number {
  return format === "BO5" ? 3 : format === "BO1" ? 1 : 2;
}

/**
 * Series score and status straight from the maps, so neither has to be kept in
 * step by hand: a side that reaches the maps it needs has won, and the match is
 * finished the moment that happens. The site already worked this out when
 * reading, but the stored status stayed whatever the form said — which is what
 * everything else (admin tabs, filters, queries) goes by.
 */
function deriveFromMaps(
  maps: MapScore[],
  format: string,
  fallback: { status: string; a: number; b: number },
): { status: string; score_a: number; score_b: number } {
  // If no maps entered yet, keep fallback status (usually "upcoming").
  if (maps.length === 0) {
    return { status: fallback.status, score_a: fallback.a, score_b: fallback.b };
  }

  // If maps are entered (even without scores), the match is at least "live".
  const played = maps.filter((m) => (Number(m.a) || 0) > 0 || (Number(m.b) || 0) > 0);
  if (played.length === 0) {
    // Maps entered but no scores yet: live, 0-0.
    return { status: "live", score_a: 0, score_b: 0 };
  }

  let a = 0;
  let b = 0;
  for (const m of played) {
    if ((Number(m.a) || 0) > (Number(m.b) || 0)) a++;
    else if ((Number(m.b) || 0) > (Number(m.a) || 0)) b++;
  }

  const need = winsNeeded(format);
  const status = a >= need || b >= need ? "finished" : "live";
  return { status, score_a: a, score_b: b };
}

/** "vitality-vs-spirit", suffixed when that id is already taken. */
async function buildMatchId(
  admin: SupabaseClient,
  base: string,
): Promise<string> {
  const { data } = await admin.from("matches").select("id").like("id", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.id as string));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

// Create / update a match (admin only, service-role write).
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const m = await request.json().catch(() => null);
  if (!m?.team_a || !m.team_b) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();

  // New matches get a readable id from the team names; edits keep their id so
  // existing links and question references stay valid.
  const id = m.id
    ? String(m.id)
    : await buildMatchId(
        admin,
        `${sidePart(m.team_a, m.team_a_name)}-vs-${sidePart(m.team_b, m.team_b_name)}`,
      );

  const format = String(m.format ?? "BO3");
  const maps: MapScore[] = Array.isArray(m.maps) ? m.maps : [];
  const derived = deriveFromMaps(maps, format, {
    status: String(m.status ?? "upcoming"),
    a: Number(m.score_a ?? 0),
    b: Number(m.score_b ?? 0),
  });

  const tournamentSlug = String(m.tournament_slug ?? "blast-bounty-s2");
  const isEventTournament = tournamentSlug === "ewc-2026";

  const row = {
    id,
    tournament_slug: tournamentSlug,
    is_event: isEventTournament || Boolean(m.is_event),
    team_a: String(m.team_a),
    team_b: String(m.team_b),
    status: derived.status,
    format,
    stage: m.stage ? String(m.stage) : null,
    time_label: m.time_label ? String(m.time_label) : null,
    start_at: m.start_at || null,
    score_a: derived.score_a,
    score_b: derived.score_b,
    live_map_label: m.live_map_label ? String(m.live_map_label) : null,
    live_round_a: Number(m.live_round_a ?? 0),
    live_round_b: Number(m.live_round_b ?? 0),
    maps: Array.isArray(m.maps) ? m.maps : [],
    veto: Array.isArray(m.veto) ? m.veto : [],
    h2h: m.h2h ?? null,
    open_questions: Number(m.open_questions ?? 0),
    max_reward: Number(m.max_reward ?? 0),
    team_a_name: m.team_a_name || null,
    team_a_logo: m.team_a_logo || null,
    team_a_color: m.team_a_color || null,
    team_a_rank: Number(m.team_a_rank ?? 0),
    team_b_name: m.team_b_name || null,
    team_b_logo: m.team_b_logo || null,
    team_b_color: m.team_b_color || null,
    team_b_rank: Number(m.team_b_rank ?? 0),
    tournament_name: m.tournament_name || null,
    tournament_icon: m.tournament_icon || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("matches").upsert(row, { onConflict: "id" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Duels close on the match, not on a question, and both halves happen at the
  // same moment: anything still unanswered never found a pair and is refunded,
  // anything matched is decided. It runs the moment a match stops being
  // upcoming — including a cancellation, which refunds both sides rather than
  // handing the pot to whoever happened to be side A of a 0-0.
  //
  // Idempotent by status, so every re-save of a finished match settles nothing
  // twice. It is fired for any tournament: the function itself refuses
  // anything that is not Porto, and duels only exist there.
  let duels = { settled: 0, refunded: 0 };
  if (derived.status !== "upcoming") {
    const { data: duelOut, error: duelErr } = await admin.rpc("duel_close_match", {
      p_match: id,
    });
    // Migration 0058 may not have run yet, and saving a match must not fail
    // because a feature that is not deployed cannot answer.
    if (duelErr && duelErr.code !== "PGRST202" && duelErr.code !== "42883") {
      console.error("[matches] duel_close_match:", duelErr.message);
    } else if (duelOut && typeof duelOut === "object") {
      const o = duelOut as { settled?: number; refunded?: number };
      duels = { settled: o.settled ?? 0, refunded: o.refunded ?? 0 };
    }
  }

  // Favourite-team payouts ride the match finishing, not a question resolving —
  // backing a team is a bet on the team, and it pays whether or not anyone
  // wrote a question about that fixture. `pay_favourite_team` is idempotent per
  // player per match, which matters because every re-save of a finished match
  // runs this again.
  let favourites = 0;
  if (isEventTournament && derived.status === "finished" && derived.score_a !== derived.score_b) {
    const winner = derived.score_a > derived.score_b ? row.team_a : row.team_b;
    const round = playoffRoundOf(row.team_a, row.team_b) ?? roundFromStage(row.stage);
    const amount = round ? favouritePayout(round, winner) : 0;
    if (amount > 0) {
      const { data, error: payErr } = await admin.rpc("pay_favourite_team", {
        p_match: id,
        p_slug: tournamentSlug,
        p_team: winner,
        p_amount: amount,
      });
      // Migration 0042 may not have run yet, and saving a match must not fail
      // because a bonus feature isn't deployed.
      if (payErr && payErr.code !== "PGRST202" && payErr.code !== "42883") {
        console.error("[matches] pay_favourite_team:", payErr.message);
      }
      // The RPC returns only the players it actually credited, so a re-save
      // that pays nobody notifies nobody.
      const paidIds = ((data ?? []) as { id?: string }[] | string[])
        .map((r) => (typeof r === "string" ? r : r.id))
        .filter(Boolean) as string[];
      favourites = paidIds.length;
      if (favourites > 0) {
        const name = getTeam(winner)?.name ?? winner;
        await admin.from("notifications").insert(
          paidIds.map((uid) => ({
            user_id: uid,
            kind: "reward",
            title: `${name} виграли — +${amount} EWC за улюблену команду`,
          })),
        );
      }
    }
  }

  await logAdmin(
    "matches",
    favourites > 0 || duels.settled > 0 || duels.refunded > 0
      ? `Зберіг матч ${id} — улюблена команда: ${favourites} виплат, дуелі: ${duels.settled} розрахунків, ${duels.refunded} повернень`
      : `Зберіг матч ${id}`,
  );
  return NextResponse.json({ ok: true, id, favourites, duels });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await request.json().catch(() => ({ id: "" }));
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("matches").delete().eq("id", String(id));
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  await logAdmin("matches", `Видалив матч ${id}`);
  return NextResponse.json({ ok: true });
}
