import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyTelegramPayload, telegramEmail } from "@/lib/telegram-auth";

/**
 * Attach a Telegram account to the account you are already signed into.
 *
 * Same signed payload as the login route, but this one requires a session and
 * writes `profiles.telegram_id` instead of minting one. It exists because the
 * EWC giveaway is gated on a verified Telegram, and a player who signed up
 * with email had no way to prove which Telegram is theirs — their points sat
 * on an account that could never enter.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const back = (status: string) =>
    NextResponse.redirect(`${origin}/profile?telegram=${status}`);

  const check = verifyTelegramPayload(searchParams);
  if (!check.ok) return back(check.error);
  const tg = check.user;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Linking is an operation on an account, so there has to be one. Someone
  // whose session expired mid-flow gets sent to log in rather than silently
  // having nothing happen.
  if (!user) return NextResponse.redirect(`${origin}/login?error=session`);

  const admin = createAdminClient();

  const { data: mine } = await admin
    .from("profiles")
    .select("telegram_id")
    .eq("id", user.id)
    .maybeSingle();

  const already = (mine?.telegram_id as string | null) ?? null;
  if (already) {
    // Re-linking the same account is a no-op, not an error — someone who
    // double-taps the button should see success, not a scary message.
    return back(already === String(tg.id) ? "linked" : "already_linked");
  }

  // ---- Is this Telegram spoken for? --------------------------------------
  const { data: holder } = await admin
    .from("profiles")
    .select("id, handle, points, bounty_points, ewc_points, correct")
    .eq("telegram_id", String(tg.id))
    .maybeSingle();

  if (holder && holder.id !== user.id) {
    // The common case by far: a player signed up by email, once tapped
    // "continue with Telegram" out of curiosity, and has had a stray empty
    // account sitting there ever since. Refusing outright would leave them
    // unable to enter a Telegram-gated giveaway with the account holding all
    // their points. So an untouched stray is released rather than defended —
    // there is nothing in it to lose. An account with any history is a real
    // account and keeps its Telegram.
    const stray = await isStray(admin, holder as StrayCandidate, tg.id);
    if (!stray) return back("taken");

    await admin
      .from("profiles")
      .update({ telegram_id: null })
      .eq("id", holder.id as string);
    // Delete the emptied account outright. Leaving it would keep a signed-in
    // session alive for a profile nobody can ever reach again by Telegram.
    await admin.auth.admin.deleteUser(holder.id as string).catch(() => {});
  }

  const { error } = await admin
    .from("profiles")
    .update({ telegram_id: String(tg.id) })
    .eq("id", user.id);
  if (error) {
    // The partial unique index is the last word on ownership: if two link
    // attempts raced, the loser lands here rather than overwriting.
    return back("taken");
  }

  // Keep auth metadata in step so the profile page can show @username without
  // a second lookup.
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      telegram_id: tg.id,
      telegram_username: tg.username ?? null,
    },
  });

  return back("linked");
}

type StrayCandidate = {
  id: string;
  points: number | null;
  bounty_points: number | null;
  ewc_points: number | null;
  correct: number | null;
};

/**
 * A stray is a Telegram-only account that was never used: created under the
 * synthetic address, no score of any kind, and nothing written against it.
 * Every one of those has to hold for it to be released — this deletes an
 * account, so the test errs toward saying no.
 */
async function isStray(
  admin: ReturnType<typeof createAdminClient>,
  profile: StrayCandidate,
  telegramId: string,
): Promise<boolean> {
  if (
    (profile.points ?? 0) !== 0 ||
    (profile.bounty_points ?? 0) !== 0 ||
    (profile.ewc_points ?? 0) !== 0 ||
    (profile.correct ?? 0) !== 0
  ) {
    return false;
  }

  // Only an account the Telegram login route made is a candidate. A real
  // account that happens to be at zero points is not up for deletion.
  const { data: owner } = await admin.auth.admin.getUserById(profile.id);
  if (owner?.user?.email !== telegramEmail(telegramId)) return false;

  for (const table of ["predictions", "user_items", "giveaway_entries"] as const) {
    const { count, error } = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id);
    // A table that can't be read is an unknown, and an unknown is not empty.
    if (error) return false;
    if ((count ?? 0) > 0) return false;
  }

  return true;
}
