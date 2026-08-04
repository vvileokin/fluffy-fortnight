import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { allTournaments } from "@/lib/data";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** "ESL Pro League Season 23" → "ESL Pro League S23" when it's long. */
function shorten(name: string): string {
  if (name.length <= 24) return name;
  return name.replace(/\bSeason\s+(\d+)/i, "S$1").slice(0, 32).trim();
}

/**
 * Add a competition we don't have. PandaScore brings matches from tournaments
 * the site has never listed, and a match has to belong to one — so rather than
 * filing it under something unrelated, the tournament is created here.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Потрібна назва турніру" }, { status: 400 });
  }

  const admin = createAdminClient();
  const base = slugify(name) || "tournament";
  let slug = base;
  const { data: existing } = await admin
    .from("custom_tournaments")
    .select("slug")
    .like("slug", `${base}%`);
  const taken = new Set([
    ...(existing ?? []).map((r) => r.slug as string),
    ...allTournaments.map((t) => t.slug),
  ]);
  for (let i = 2; taken.has(slug) && i < 100; i++) slug = `${base}-${i}`;

  const row = {
    slug,
    name,
    short_name: String(body?.short_name ?? "").trim() || shorten(name),
    tier: Number(body?.tier) === 1 ? 1 : 2,
    status: ["live", "upcoming", "finished"].includes(body?.status) ? body.status : "upcoming",
    start_at: body?.start_at || null,
    end_at: body?.end_at || null,
    location: String(body?.location ?? "").trim() || "Онлайн",
    online: body?.online !== false,
    prize_usd: Number(body?.prize_usd) || 0,
    format: String(body?.format ?? "").trim(),
    accent: /^#[0-9a-f]{6}$/i.test(String(body?.accent ?? "")) ? String(body.accent) : "#3B4C6B",
    cover_image: body?.cover_image || null,
  };

  const { error } = await admin.from("custom_tournaments").insert(row);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await logAdmin("import", `Створив турнір ${name}`);
  return NextResponse.json({ ok: true, tournament: { slug, name, shortName: row.short_name } });
}
