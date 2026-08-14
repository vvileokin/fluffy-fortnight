import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkChannelMembership } from "@/lib/telegram";

/**
 * Buying tickets for a giveaway.
 *
 * This is the only path to a paid entry: the RLS policy on `giveaway_entries`
 * accepts a direct browser insert only when the giveaway is free and ungated,
 * and `buy_giveaway_ticket` is revoked from `authenticated`. Both gates that
 * make an entry legitimate — the balance and the channel subscription — are
 * enforced here and nowhere else, so there is no second door to keep in step.
 *
 * The subscription check has to live in a route rather than in the database
 * function, because it is an HTTP call to Telegram. The charge has to live in
 * the database function, because it is a read-then-write of a balance and two
 * clicks must not both pass. Hence the split.
 */

const MAX_QTY = 25;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = String(body?.slug ?? "");
  const qty = Math.floor(Number(body?.qty ?? 1));
  if (!slug || !Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: giveaway } = await admin
    .from("giveaways")
    .select("slug, require_telegram, entry_cost, entry_currency, max_tickets")
    .eq("slug", slug)
    .maybeSingle();
  if (!giveaway) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (giveaway.require_telegram) {
    const { data: profile } = await admin
      .from("profiles")
      .select("telegram_id")
      .eq("id", user.id)
      .maybeSingle();

    const telegramId = (profile?.telegram_id as string | null) ?? null;
    if (!telegramId) {
      return NextResponse.json(
        { ok: false, error: "telegram_required" },
        { status: 409 },
      );
    }

    const sub = await checkChannelMembership(telegramId);
    if (!sub.ok) {
      // We could not reach Telegram, or the bot is no longer an admin of the
      // channel. Saying "you aren't subscribed" here would be a lie aimed at
      // someone who did nothing wrong, so this is a 503 and reads as ours.
      return NextResponse.json(
        { ok: false, error: "check_failed", reason: sub.reason },
        { status: 503 },
      );
    }
    if (!sub.member) {
      return NextResponse.json(
        { ok: false, error: "not_subscribed" },
        { status: 409 },
      );
    }
  }

  // Service role, so `auth.uid()` is null inside the function — which is both
  // what lets it write the frozen balance columns and what the function itself
  // insists on before touching them.
  const { data, error } = await admin.rpc("buy_giveaway_ticket", {
    p_user: user.id,
    p_slug: slug,
    p_qty: qty,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    tickets?: number;
    spent?: number;
    balance?: number;
    maxTickets?: number;
    needed?: number;
  };

  if (!result.ok) {
    // The function's refusals are all things the player can act on (not enough
    // points, ticket cap reached, giveaway closed), so they carry their own
    // code and the UI turns each into a sentence.
    return NextResponse.json({ ok: false, ...result }, { status: 409 });
  }

  return NextResponse.json(result);
}
