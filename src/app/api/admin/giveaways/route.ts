import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const g = await request.json().catch(() => null);
  if (!g?.prize) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const slug = g.slug || `${slugify(String(g.prize))}-${Date.now().toString(36).slice(-4)}`;

  const row = {
    slug,
    prize: String(g.prize),
    sponsor: g.sponsor ? String(g.sponsor) : null,
    value_usd: Number(g.value_usd ?? 0),
    end_label: g.end_label ? String(g.end_label) : null,
    entrants: Number(g.entrants ?? 0),
    min_points: Number(g.min_points ?? 0),
    status: String(g.status ?? "open"),
    cover: String(g.cover ?? "oklch(0.64 0.235 24)"),
    image: g.image || null,
    description: g.description ? String(g.description) : null,
    conditions: Array.isArray(g.conditions) ? g.conditions : [],
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { error } = await admin.from("giveaways").upsert(row, { onConflict: "slug" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, slug });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await request.json().catch(() => ({ slug: "" }));
  if (!slug) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("giveaways").delete().eq("slug", String(slug));
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
