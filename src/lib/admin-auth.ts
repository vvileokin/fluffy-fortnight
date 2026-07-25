import "server-only";
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

// There is deliberately no password path in here. Access exists only as a row
// in admin_users, which only the service role can write — so the sole ways to
// gain it are an existing admin granting it, or someone with database access
// inserting the very first row by hand.
