import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verification of a Telegram Login payload, shared by the two routes that
 * accept one: signing in (`/auth/telegram`) and linking Telegram to an account
 * you are already signed into (`/auth/telegram/link`). Both have to prove the
 * payload really came from Telegram, and neither may be the place that gets it
 * subtly wrong, so the check lives once.
 */

export type TelegramUser = {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
};

export type Verified =
  | { ok: true; user: TelegramUser }
  | { ok: false; error: "telegram" | "telegram_expired" };

/** How long a signed callback stays usable, in seconds. */
const MAX_AGE = 300;

export function verifyTelegramPayload(params: URLSearchParams): Verified {
  const data: Record<string, string> = {};
  params.forEach((v, k) => (data[k] = v));

  const hash = data.hash;
  delete data.hash;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !hash || !data.id) return { ok: false, error: "telegram" };

  // secret = SHA256(bot_token); HMAC-SHA256 over the sorted "k=v\n" string.
  const checkString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest("hex");

  const valid =
    expected.length === hash.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
  if (!valid) return { ok: false, error: "telegram" };

  // Reject stale payloads. Telegram redirects straight back, so a few minutes
  // is plenty — a longer window would leave a signed callback URL (browser
  // history, referrer logs, a shared link) replayable as a login.
  const authDate = Number(data.auth_date ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE) {
    return { ok: false, error: "telegram_expired" };
  }

  return { ok: true, user: data as unknown as TelegramUser };
}

/** Display name from whichever of the optional name fields Telegram sent. */
export function telegramName(u: TelegramUser): string {
  return (
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.username ||
    `tg${u.id}`
  );
}

/** The synthetic address a Telegram-only account is created under. */
export function telegramEmail(id: string): string {
  return `tg-${id}@users.cs2ua.com`;
}
