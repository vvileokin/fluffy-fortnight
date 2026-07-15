import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Save editable site content (promo banner + tournament covers). Admin only.
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const row = {
    id: 1,
    promo_enabled: Boolean(body.promo_enabled),
    promo_image: body.promo_image ? String(body.promo_image) : null,
    promo_link_type: body.promo_link_type === "match" ? "match" : "tournament",
    promo_target: body.promo_target ? String(body.promo_target) : null,
    covers:
      body.covers && typeof body.covers === "object" && !Array.isArray(body.covers)
        ? body.covers
        : {},
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { error } = await admin.from("site_settings").upsert(row, { onConflict: "id" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
