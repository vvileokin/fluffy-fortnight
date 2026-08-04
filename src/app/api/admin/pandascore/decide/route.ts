import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { teams, getTeam } from "@/lib/data";
import type { SupabaseClient } from "@supabase/supabase-js";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/** "mouz-vs-spirit", suffixed when that id is already taken. */
async function buildMatchId(admin: SupabaseClient, base: string): Promise<string> {
  const { data } = await admin.from("matches").select("id").like("id", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.id as string));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

/**
 * Approve or reject one imported match.
 *
 * Approving creates the real match from PandaScore's calendar data — teams,
 * kick-off, best-of, stage — and leaves everything editorial (maps, veto,
 * questions) empty for the admin to fill in as the series is played.
 * Rejecting is permanent: a later sync won't offer it again.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const psId = Number(body?.ps_id);
  const decision = body?.decision;
  if (!psId || (decision !== "approved" && decision !== "rejected")) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("ps_matches")
    .select("*")
    .eq("ps_id", psId)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ ok: false, error: "Матч не знайдено" }, { status: 404 });
  }
  if (row.review !== "pending") {
    return NextResponse.json(
      { ok: false, error: "Рішення щодо цього матчу вже ухвалено" },
      { status: 409 },
    );
  }

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const stamp = { decided_at: new Date().toISOString(), decided_by: user?.id ?? null };

  if (decision === "rejected") {
    await admin.from("ps_matches").update({ review: "rejected", ...stamp }).eq("ps_id", psId);
    await logAdmin("import", `Відхилив імпорт матчу ${row.name ?? psId}`);
    return NextResponse.json({ ok: true });
  }

  // Approving needs both sides identified — either from the hardcoded catalog
  // or from a team created during an earlier import.
  const slugA = String(body?.slug_a ?? "");
  const slugB = String(body?.slug_b ?? "");
  const { data: customRows } = await admin
    .from("custom_teams")
    .select("slug, name, tag, logo, brand")
    .in("slug", [slugA, slugB].filter(Boolean));
  const custom = new Map((customRows ?? []).map((t) => [t.slug as string, t]));

  const known = (s: string) => !!teams[s] || custom.has(s);
  if (!known(slugA) || !known(slugB)) {
    return NextResponse.json(
      { ok: false, error: "Спочатку обери обидві команди" },
      { status: 400 },
    );
  }
  if (slugA === slugB) {
    return NextResponse.json(
      { ok: false, error: "Обидві сторони не можуть бути однією командою" },
      { status: 400 },
    );
  }

  // The competition travels with the match as plain name + logo, not a real
  // tournament page — the admin creates those separately, on purpose, when a
  // competition is worth its own listing on the site.
  const tournamentName = String(body?.tournament_name ?? "").trim();
  if (!tournamentName) {
    return NextResponse.json(
      { ok: false, error: "Вкажи назву турніру" },
      { status: 400 },
    );
  }
  const tournamentIcon = body?.tournament_icon ? String(body.tournament_icon) : null;
  // matches.tournament_slug is NOT NULL but doesn't need to resolve to
  // anything public — "ps-" keeps it out of the way of real tournament slugs,
  // so /tournaments/<this> 404s instead of accidentally matching one.
  const tournamentSlug = `ps-${slugify(tournamentName) || psId}`;

  const nameOf = (slug: string) => teams[slug]?.name ?? custom.get(slug)?.name ?? slug;
  const id = await buildMatchId(admin, `${slugify(slugA)}-vs-${slugify(slugB)}`);

  // A team outside the hardcoded catalog travels with the match: its name,
  // logo and colour are copied onto the row, which is how the site renders
  // teams it doesn't know about.
  const sideFields = (slug: string, side: "a" | "b") => {
    const t = custom.get(slug);
    if (!t) return {};
    return {
      [`team_${side}_name`]: t.name,
      [`team_${side}_logo`]: t.logo,
      [`team_${side}_color`]: t.brand,
    };
  };

  const { error } = await admin.from("matches").insert({
    id,
    tournament_slug: tournamentSlug,
    is_event: Boolean(body?.is_event),
    team_a: slugA,
    team_b: slugB,
    // PandaScore's own status isn't ours: ours is derived from the maps we
    // enter, so an imported match starts as upcoming and moves on from there.
    status: "upcoming",
    format: row.number_of_games === 5 ? "BO5" : row.number_of_games === 1 ? "BO1" : "BO3",
    stage: body?.stage ? String(body.stage) : (row.stage_name ?? null),
    start_at: row.begin_at,
    score_a: 0,
    score_b: 0,
    maps: [],
    veto: [],
    tournament_name: tournamentName,
    tournament_icon: tournamentIcon,
    ...sideFields(slugA, "a"),
    ...sideFields(slugB, "b"),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Remember who these teams are, so the next match with them needs no picking.
  const mappings: { ps_team_id: number; slug: string; ps_name: string | null }[] = [];
  if (row.team_a_ps_id) {
    mappings.push({ ps_team_id: row.team_a_ps_id, slug: slugA, ps_name: row.team_a_name });
  }
  if (row.team_b_ps_id) {
    mappings.push({ ps_team_id: row.team_b_ps_id, slug: slugB, ps_name: row.team_b_name });
  }
  if (mappings.length) {
    await admin.from("ps_teams").upsert(mappings, { onConflict: "ps_team_id" });
  }

  await admin
    .from("ps_matches")
    .update({ review: "approved", match_id: id, ...stamp })
    .eq("ps_id", psId);

  await logAdmin(
    "import",
    `Додав матч ${nameOf(slugA)} vs ${nameOf(slugB)} з PandaScore`,
  );

  return NextResponse.json({ ok: true, match_id: id });
}
