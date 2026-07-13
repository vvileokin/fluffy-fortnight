import { NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Telegram Login Widget redirects here (GET) with the signed user payload.
// We verify the hash with the bot token, then mint a Supabase session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const data: Record<string, string> = {};
  searchParams.forEach((v, k) => (data[k] = v));

  const hash = data.hash;
  delete data.hash;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !hash || !data.id) {
    return NextResponse.redirect(`${origin}/login?error=telegram`);
  }

  // 1. Verify signature: secret = SHA256(bot_token); HMAC-SHA256 over sorted "k=v\n".
  const checkString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest("hex");

  const valid =
    expected.length === hash.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
  if (!valid) {
    return NextResponse.redirect(`${origin}/login?error=telegram`);
  }

  // 2. Reject stale payloads (older than 24h).
  const authDate = Number(data.auth_date ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    return NextResponse.redirect(`${origin}/login?error=telegram_expired`);
  }

  // 3. Upsert a Supabase user keyed by a synthetic (valid-format) email.
  const email = `tg-${data.id}@users.cs2ua.com`;
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ");
  const admin = createAdminClient();

  await admin.auth.admin
    .createUser({
      email,
      email_confirm: true,
      user_metadata: {
        provider: "telegram",
        telegram_id: data.id,
        name: fullName || data.username || `tg${data.id}`,
        user_name: data.username,
        avatar_url: data.photo_url,
      },
    })
    .catch(() => {
      // Already exists — fine, we'll just sign them in below.
    });

  // 4. Mint a magic-link token and verify it to set the session cookies.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=telegram`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=telegram`);
  }

  return NextResponse.redirect(`${origin}/`);
}
