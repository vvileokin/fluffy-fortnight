import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { teams } from "@/lib/data";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/** A short tag from a team name: initials for multi-word, else the first letters. */
function tagFrom(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const tag =
    words.length > 1
      ? words.map((w) => w[0]).join("")
      : name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4);
  return (tag || name.slice(0, 3)).toUpperCase().slice(0, 5);
}

/**
 * Add a team we don't have yet, straight from what PandaScore knows about it,
 * and remember which PandaScore id it is. After this the team is recognised on
 * its own and never has to be picked again.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Потрібна назва команди" }, { status: 400 });
  }

  const logo = body?.logo ? String(body.logo) : null;
  const psTeamId = body?.ps_team_id ? Number(body.ps_team_id) : null;
  const tag = String(body?.tag ?? "").trim() || tagFrom(name);
  const brand = /^#[0-9a-f]{6}$/i.test(String(body?.brand ?? "")) ? String(body.brand) : "#1D1D20";

  const admin = createAdminClient();

  // Keep slugs unique across both the hardcoded catalog and earlier creations.
  const base = slugify(name) || "team";
  let slug = base;
  const { data: existing } = await admin
    .from("custom_teams")
    .select("slug")
    .like("slug", `${base}%`);
  const taken = new Set([...(existing ?? []).map((r) => r.slug as string), ...Object.keys(teams)]);
  for (let i = 2; taken.has(slug) && i < 100; i++) slug = `${base}-${i}`;

  const { error } = await admin
    .from("custom_teams")
    .insert({ slug, name, tag, logo, brand });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (psTeamId) {
    await admin
      .from("ps_teams")
      .upsert({ ps_team_id: psTeamId, slug, ps_name: name }, { onConflict: "ps_team_id" });
  }

  await logAdmin("import", `Створив команду ${name} з PandaScore`);
  return NextResponse.json({ ok: true, team: { slug, name, tag, logo: logo ?? "", brand } });
}
