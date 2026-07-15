import { NextResponse } from "next/server";
import { checkPassword, setAdminCookie, clearAdminCookie, isAdmin } from "@/lib/admin-auth";

// Whether the current request carries a valid admin cookie. The admin UI uses
// this so the panel unlocks only when the server-side session is actually valid
// (prevents the "panel looks logged in but every action is unauthorized" desync).
export async function GET() {
  return NextResponse.json({ authed: await isAdmin() });
}

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({ password: "" }));
  if (!checkPassword(String(password ?? ""))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
