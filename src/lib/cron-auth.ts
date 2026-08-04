import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";

/**
 * Whether a request carries the right CRON_SECRET. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; there's no admin session on a cron
 * request to check instead, so an unguarded endpoint would be a button for
 * anyone to burn the day's API quota.
 */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const sent = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret) return false;
  // Compare digests: fixed width, so the check is constant-time.
  const a = createHash("sha256").update(sent).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
