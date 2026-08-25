import "server-only";

/**
 * What the bot says, and how it says it.
 *
 * Two rules shape every line here.
 *
 * Never report a zero. "Розраховано — ти отримав 0" is the worst message this
 * system can send, and the World Cup bracket sent it to fifty-two people. A
 * template that has nothing to report should not have been queued.
 *
 * The mark comes before the words. In a chat list a person sees the emoji
 * before they read anything, so it has to answer "what happened" on its own —
 * which is why each category has one and only one.
 */

/** The event's custom emoji, from the BLASTWEB pack. */
const MARK = {
  duel: { id: "5220098840627030028", fallback: "⚔️" },
  relay: { id: "5219976614447723017", fallback: "🤝" },
  won: { id: "5220233547981303626", fallback: "🟢" },
  lost: { id: "5219999609702625675", fallback: "⚪️" },
  club: { id: "5220208327933339000", fallback: "🎯" },
  digest: { id: "5220213761066971759", fallback: "📊" },
  giveaway: { id: "5219915419753688086", fallback: "🎁" },
  event: { id: "5219696951947208550", fallback: "🟥" },
} as const;

type MarkName = keyof typeof MARK;

export type Outbox = {
  id: number;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
};

type Message = { mark: MarkName; text: string };

/**
 * A figure, set in monospace.
 *
 * Telegram renders `<code>` in a fixed-width face, which is the same thing the
 * site does with `tnum font-mono` on every number it prints: digits that line
 * up read as a quantity, digits in the body face read as part of a sentence. It
 * also sets the number apart from the words without spending bold, which is
 * already carrying the subject of each message.
 */
const n = (v: unknown) => `<code>${Number(v ?? 0).toLocaleString("uk-UA")}</code>`;
const raw = (v: unknown) => Number(v ?? 0).toLocaleString("uk-UA");
const s = (v: unknown) => String(v ?? "");

/**
 * One template per kind. Returns null when there is nothing worth saying —
 * the drain then marks the row sent without troubling anybody.
 */
export function render(kind: string, p: Record<string, unknown>): Message | null {
  switch (kind) {
    /* ---- duels ---- */
    case "duel_challenge":
      return {
        mark: "duel",
        text: `<b>${s(p.from)} викликав тебе</b>\n${s(p.match)} · <i>${s(p.when)}</i>\nВін на <b>${s(p.side)}</b>, ставка ${n(p.stake)}.`,
      };
    case "duel_accepted":
      return {
        mark: "duel",
        text: `<b>${s(p.from)} прийняв твій виклик</b>\n${s(p.match)} · ${n(p.stake)} проти ${n(p.stake)}.`,
      };
    case "duel_won":
      return {
        mark: "duel",
        text: `<b>Ти виграв дуель проти ${s(p.from)}</b>\n${s(p.match)} · +${n(p.payout)}\n<i>Рахунок у дуелях</i> <code>${s(p.record)}</code>`,
      };
    case "duel_lost":
      return {
        mark: "duel",
        text: `Дуель проти ${s(p.from)} програна. ${s(p.match)}.\n<i>Рахунок</i> <code>${s(p.record)}</code> — реванш?`,
      };
    case "duel_declined":
      return {
        mark: "duel",
        text: `<b>${s(p.from)} відхилив твій виклик</b>\n${n(p.stake)} повернуто на баланс.`,
      };
    case "duel_expired":
      return {
        mark: "duel",
        text: `Твій виклик на ${s(p.match)} ніхто не взяв.\n${n(p.stake)} повернуто.`,
      };
    case "duel_void":
      return {
        mark: "duel",
        text: `${s(p.match)} не відбувся — дуель скасовано.\n${n(p.stake)} повернуто.`,
      };

    /* ---- relay ---- */
    case "relay_invite":
      return {
        mark: "relay",
        text: `<b>${s(p.from)} кличе тебе в естафету</b>\nСпільний рахунок на двох до кінця Porto. Напарника потім не змінити.`,
      };
    case "relay_formed":
      return {
        mark: "relay",
        text: `<b>Ви з ${s(p.from)} у парі.</b> Рахунок пішов із цієї хвилини.`,
      };
    case "relay_daily":
      return {
        mark: "relay",
        text: `${s(p.from)} узяв сьогодні +${n(p.points)}.\nВаша пара: ${n(p.total)}, ${s(p.rank)} місце.`,
      };

    /* ---- bets ---- */
    case "bet_won":
      return {
        mark: "won",
        text: `<b>${s(p.match)}</b>\nСтавка ${n(p.stake)} × <code>${s(p.odds)}</code> зіграла.\n+${n(p.payout)} <i>· баланс</i> ${n(p.balance)}`,
      };
    case "bet_lost":
      return {
        mark: "lost",
        text: `<b>${s(p.match)}</b>\n<s>Ставка ${raw(p.stake)}</s> не зіграла.`,
      };
    case "bet_refund":
      return {
        mark: "lost",
        text: `<b>${s(p.match)}</b> скасовано.\nСтавку ${n(p.stake)} повернуто.`,
      };

    /* ---- predictions ---- */
    case "pick_reminder":
      return {
        mark: "event",
        text: `<b>${s(p.match)}</b> через 15 хвилин, а прогнозу ще немає.`,
      };
    case "perfect_day":
      return {
        mark: "digest",
        text: `<b>${s(p.done)} з ${s(p.total)}.</b> Лишився ${s(p.match)} <i>${s(p.when)}</i> — і день піде <b>×2</b>.`,
      };

    /* ---- the 0-2 club ---- */
    case "club_scored":
      return {
        mark: "club",
        text: `<b>Клуб 0-2 · група ${s(p.group)}</b>\n${s(p.advance)} на вихід, ${s(p.zeroTwo)} на виліт.\n+${n(p.points)}`,
      };

    /* ---- giveaways ---- */
    case "giveaway_won":
      return {
        mark: "giveaway",
        text: `<b>Ти виграв: ${s(p.prize)}</b>\nНапишемо щодо видачі найближчим часом.`,
      };

    /* ---- the day, and the event ---- */
    case "daily_digest":
      return {
        mark: "digest",
        text: `<b>${s(p.title)}</b>\nВгадав <b>${s(p.correct)} з ${s(p.total)}</b>, заробив +${n(p.points)}.\n<i>Місце</i> <b>${s(p.rank)}</b> із ${n(p.of)}`,
      };
    case "event_start":
      return {
        mark: "event",
        text: `<b>${s(p.title)} починається</b>\nПерший матч — ${s(p.match)} <i>${s(p.when)}</i>`,
      };
    case "event_end":
      return {
        mark: "event",
        text: `<b>${s(p.title)} завершено.</b> Ти на <b>${s(p.rank)} місці</b> з ${n(p.of)}.\n${n(p.points)} <i>пішли в сезонні золоті</i>`,
      };

    default:
      return null;
  }
}

/**
 * Send one message, marked.
 *
 * The mark is a custom emoji entity, which Telegram only lets a bot use while
 * its owner holds Premium. That can lapse, and a bot that goes silent the day a
 * subscription expires is worse than a bot without decoration — so a refusal
 * that names the entity is retried immediately as plain text.
 */
export async function send(
  token: string,
  chatId: string,
  message: Message,
): Promise<{ ok: boolean; error?: string }> {
  const { id, fallback } = MARK[message.mark];

  const post = (text: string, entities?: unknown[]) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...(entities ? { entities } : {}),
      }),
    }).then((r) => r.json());

  // The mark leads, then a space, then the message. Written as HTML so the
  // bold in the templates survives; the emoji itself is a tag, not an entity
  // offset, which is what keeps the two from having to agree about lengths.
  const marked = `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji> ${message.text}`;
  let out = await post(marked);

  if (!out.ok && /emoji/i.test(String(out.description ?? ""))) {
    out = await post(`${fallback} ${message.text}`);
  }
  if (!out.ok) {
    return { ok: false, error: String(out.description ?? "unknown") };
  }
  return { ok: true };
}
