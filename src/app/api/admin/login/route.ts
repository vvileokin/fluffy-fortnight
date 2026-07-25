import { NextResponse } from "next/server";
import { adminRole, needsBootstrap, claimFirstAdmin } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

// What the panel needs to decide what to show: the visitor's admin role (if
// any), whether they're signed in at all, and whether the first admin seat is
// still up for grabs.
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
    canBootstrap: !!user && role === null && (await needsBootstrap()),
  });
}

// Claim the first admin seat. Only works while nobody has access yet.
export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({ password: "" }));
  const result = await claimFirstAdmin(String(password ?? ""));
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
