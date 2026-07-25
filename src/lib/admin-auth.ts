import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminRole = "admin" | "editor";

/** The signed-in visitor's admin role, or null if they have none. */
export async function adminRole(): Promise<AdminRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Read through the service role: the grant must not depend on the reader's
  // own RLS view of the table.
  const { data } = await createAdminClient()
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = data?.role;
  return role === "admin" || role === "editor" ? role : null;
}

/** May use the admin panel at all (admin or editor). */
export async function isAdmin(): Promise<boolean> {
  return (await adminRole()) !== null;
}

/** May manage other people's access. */
export async function isFullAdmin(): Promise<boolean> {
  return (await adminRole()) === "admin";
}

/** True while nobody has been granted access yet — the bootstrap window. */
export async function needsBootstrap(): Promise<boolean> {
  const { count } = await createAdminClient()
    .from("admin_users")
    .select("user_id", { count: "exact", head: true });
  return (count ?? 0) === 0;
}

function passwordMatches(pw: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (expected.length === 0) return false;
  // Compare digests: fixed width, so the check is constant-time and doesn't
  // give the password's length away.
  const a = createHash("sha256").update(pw).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Claim the first admin seat: the signed-in account becomes admin if it gets
 * ADMIN_PASSWORD right *and* no one holds access yet. Once the first grant
 * lands this path is closed for good, so the shared password stops being a way
 * in — it only ever bootstraps an empty table.
 */
export async function claimFirstAdmin(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Спочатку увійди у свій акаунт на сайті." };
  if (!(await needsBootstrap())) return { ok: false, error: "Доступ уже видано — попроси адміністратора." };
  if (!passwordMatches(password)) return { ok: false, error: "Невірний пароль." };

  const { error } = await createAdminClient()
    .from("admin_users")
    .insert({ user_id: user.id, role: "admin", note: "перший адміністратор" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
