import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  verifyTelegramPayload,
  telegramName,
  telegramEmail,
} from "@/lib/telegram-auth";

/**
 * Telegram Login Widget redirects here (GET) with the signed user payload.
 * We verify the hash with the bot token, then mint a Supabase session.
 *
 * The order below matters. A Telegram account can now be *linked* to an
 * account someone made with email or Google, so before creating anything we
 * ask whether this Telegram already belongs to a profile. If it does, that is
 * the account to sign into — otherwise a player who linked their Telegram
 * would still land in a second, empty account every time they used the
 * Telegram button, which is the whole problem linking exists to solve.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const check = verifyTelegramPayload(searchParams);
  if (!check.ok) {
    return NextResponse.redirect(`${origin}/login?error=${check.error}`);
  }
  const tg = check.user;

  const admin = createAdminClient();

  // ---- 1. Already linked to an account? Sign into that one. --------------
  // `profiles.telegram_id` is frozen against self-service writes (migration
  // 0035), and only ever written after a payload like this one verified, so
  // it is safe to treat as proof of ownership.
  const { data: linked } = await admin
    .from("profiles")
    .select("id")
    .eq("telegram_id", String(tg.id))
    .maybeSingle();

  if (linked?.id) {
    const { data: owner } = await admin.auth.admin.getUserById(linked.id as string);
    const email = owner?.user?.email;
    if (email) {
      return signIn(admin, origin, email);
    }
    // Linked to a profile whose auth user has no address to send a link to.
    // Nothing sensible left to do but refuse — falling through would create a
    // second account for a Telegram that is already spoken for.
    return NextResponse.redirect(`${origin}/login?error=telegram`);
  }

  // ---- 2. First time: the Telegram-only account. --------------------------
  const email = telegramEmail(tg.id);

  await admin.auth.admin
    .createUser({
      email,
      email_confirm: true,
      user_metadata: {
        provider: "telegram",
        telegram_id: tg.id,
        name: telegramName(tg),
        user_name: tg.username,
        avatar_url: tg.photo_url,
      },
    })
    .catch(() => {
      // Already exists — fine, we'll just sign them in below.
    });

  return signIn(admin, origin, email, tg.id);
}

/**
 * Mint and redeem a magic link for `email`, which sets the session cookies.
 *
 * `expectTelegramId` guards the synthetic-address path only. The site also has
 * email/password signup, so someone could have registered
 * tg-<id>@users.cs2ua.com themselves and waited for the real owner to sign in
 * — which would drop them into the stranger's account. A Telegram account
 * always carries its id in metadata; anything else is refused. Accounts found
 * by the link lookup above skip this: their address is a real one that happens
 * to belong to a linked profile, and it carries no Telegram metadata at all.
 */
async function signIn(
  admin: ReturnType<typeof createAdminClient>,
  origin: string,
  email: string,
  expectTelegramId?: string,
) {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=telegram`);
  }

  if (expectTelegramId !== undefined) {
    const claimed = link?.user?.user_metadata?.telegram_id;
    if (String(claimed ?? "") !== String(expectTelegramId)) {
      return NextResponse.redirect(`${origin}/login?error=telegram_conflict`);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=telegram`);
  }

  // Mirror the id onto the profile so the lookup above finds this account next
  // time. Written here rather than left to the signup trigger because the
  // trigger predates the column, and because an account created before this
  // migration has to pick it up on its next sign-in.
  if (expectTelegramId !== undefined && link?.user?.id) {
    await admin
      .from("profiles")
      .update({ telegram_id: String(expectTelegramId) })
      .eq("id", link.user.id)
      .is("telegram_id", null);
  }

  return NextResponse.redirect(`${origin}/`);
}
