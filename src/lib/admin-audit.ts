import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AuditArea =
  | "matches"
  | "questions"
  | "bounty"
  | "resolve"
  | "giveaways"
  | "content"
  | "users"
  | "upload";

/**
 * Record one admin action. Called after the change lands, so the log only shows
 * what actually happened. It never throws: a failure to write history must not
 * fail the change itself (and must not hide it either — that's why it's after).
 */
export async function logAdmin(area: AuditArea, action: string): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const admin = createAdminClient();
    const [{ data: profile }, { data: grant }] = await Promise.all([
      admin.from("profiles").select("handle").eq("id", user.id).maybeSingle(),
      admin.from("admin_users").select("role").eq("user_id", user.id).maybeSingle(),
    ]);

    await admin.from("admin_audit").insert({
      user_id: user.id,
      handle: profile?.handle ?? user.email ?? "—",
      role: grant?.role ?? null,
      area,
      action: action.slice(0, 300),
    });
  } catch {
    // History is best-effort; the action it describes has already happened.
  }
}
