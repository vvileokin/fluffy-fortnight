import { NextResponse } from "next/server";
import { adminRole } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

// What the panel needs to decide what to show: the visitor's admin role (if
// any) and whether they're signed in at all. There is no POST — access can't be
// obtained here, only read. It is granted by an admin on the users page, or by
// the first row someone inserts into admin_users directly in the database.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = await adminRole();
  return NextResponse.json({
    authed: role !== null,
    role,
    signedIn: !!user,
    handle: user ? (user.user_metadata?.name ?? user.email ?? null) : null,
  });
}
