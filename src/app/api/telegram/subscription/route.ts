import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkChannelMembership, channelUrl, channelHandle } from "@/lib/telegram";

/**
 * "Is this player subscribed right now?" — for the giveaway card, so it can
 * show the real gate instead of making everyone click to find out.
 *
 * The enter route checks this again at purchase time and is the one that
 * decides. This endpoint only shapes the button, so it may be a moment stale
 * without anything going wrong.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const channel = { url: channelUrl(), handle: channelHandle() };

  if (!user) {
    return NextResponse.json({ ok: true, linked: false, member: false, channel });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("telegram_id")
    .eq("id", user.id)
    .maybeSingle();

  const telegramId = (profile?.telegram_id as string | null) ?? null;
  if (!telegramId) {
    return NextResponse.json({ ok: true, linked: false, member: false, channel });
  }

  const sub = await checkChannelMembership(telegramId);
  if (!sub.ok) {
    // Unknown, not negative. The card shows "couldn't check" and still lets
    // the button be pressed — the enter route will settle it properly.
    return NextResponse.json({
      ok: false,
      linked: true,
      reason: sub.reason,
      channel,
    });
  }

  return NextResponse.json({ ok: true, linked: true, member: sub.member, channel });
}
