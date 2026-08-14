import "server-only";

/**
 * Channel membership, asked of the Bot API.
 *
 * The distinction that matters here is between "this person is not subscribed"
 * and "we could not find out". They look the same from the outside and mean
 * opposite things to the person clicking the button: one is a thing they can
 * fix by subscribing, the other is our problem. Folding them together — the
 * obvious `catch { return false }` — tells someone who *is* subscribed that
 * they aren't, and leaves them re-subscribing to a channel they're already in.
 * So a failure is its own result and the UI says so.
 */
export type SubCheck =
  | { ok: true; member: boolean }
  | { ok: false; reason: "unconfigured" | "api" };

/** Statuses the Bot API can return for a chat member. */
type MemberStatus =
  | "creator"
  | "administrator"
  | "member"
  | "restricted"
  | "left"
  | "kicked";

/** Public channel link for the "subscribe" button, or "" when unset. */
export function channelUrl(): string {
  return process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL ?? "";
}

/** `@handle` for prose, derived from whichever env var is set. */
export function channelHandle(): string {
  const id = process.env.TELEGRAM_CHANNEL_ID ?? "";
  if (id.startsWith("@")) return id;
  const url = channelUrl();
  const tail = url.replace(/\/+$/, "").split("/").pop();
  return tail ? `@${tail}` : "";
}

export async function checkChannelMembership(
  telegramId: string,
): Promise<SubCheck> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId || !telegramId) {
    return { ok: false, reason: "unconfigured" };
  }

  let payload: {
    ok?: boolean;
    description?: string;
    result?: { status?: MemberStatus; is_member?: boolean };
  };

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: Number(telegramId) }),
        // Membership changes the moment someone hits Subscribe, and this is
        // only ever called on a deliberate action, so a cached answer would
        // only ever be a wrong one.
        cache: "no-store",
      },
    );
    payload = await res.json();
  } catch {
    return { ok: false, reason: "api" };
  }

  if (!payload.ok) {
    // "user not found" is Telegram's answer for someone who has never been in
    // the channel — a real negative, not a fault on our side. Everything else
    // (bot not an admin, bot removed, chat not found, rate limit) is ours, and
    // must not be reported to the player as "you aren't subscribed".
    const why = (payload.description ?? "").toLowerCase();
    if (why.includes("user not found")) return { ok: true, member: false };
    console.error("[telegram] getChatMember failed:", payload.description);
    return { ok: false, reason: "api" };
  }

  const status = payload.result?.status;
  if (status === "creator" || status === "administrator" || status === "member") {
    return { ok: true, member: true };
  }
  // `restricted` covers both a muted member and someone who was restricted on
  // the way out; only the flag separates them.
  if (status === "restricted") {
    return { ok: true, member: payload.result?.is_member === true };
  }
  return { ok: true, member: false };
}
