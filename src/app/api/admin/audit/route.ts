import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** The audit trail. Readable in the panel only — the table has no client policy. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await createAdminClient()
    .from("admin_audit")
    .select("id, handle, role, area, action, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entries: data ?? [] });
}
