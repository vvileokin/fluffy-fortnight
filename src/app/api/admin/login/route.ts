import { NextResponse } from "next/server";
import { checkPassword, setAdminCookie, clearAdminCookie } from "@/lib/admin-auth";

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
