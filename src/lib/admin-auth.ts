import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "cs2ua_admin";

function token(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-secret";
  return createHmac("sha256", secret).update("cs2ua-admin-v1").digest("hex");
}

export function checkPassword(pw: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  return expected.length > 0 && pw === expected;
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(token());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setAdminCookie() {
  (await cookies()).set(COOKIE, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days — avoids the UI/cookie desync that made uploads 401
  });
}

export async function clearAdminCookie() {
  (await cookies()).delete(COOKIE);
}
