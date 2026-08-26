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

/**
 * One mark leads the message, or the text carries its own.
 *
 * Most templates want a single glyph in front, which is what the chat list
 * shows before anybody reads a word. A few want a mark per line — a duel result
 * opens with the swords and then answers the money on its own line — and those
 * embed their marks with `E()` and leave `mark` off.
 *
 * `button` is a single link under the message. It exists because the messages
 * that carry one are all invitations to come back and do the thing again, and a
 * bare URL in the body would be the same invitation with worse manners.
 */
type Message = {
  mark?: MarkName;
  text: string;
  button?: { text: string; url: string };
};

const SITE = "https://cs2ua.com";

/** A custom emoji, inline, with the plain glyph as its fallback content. */
const E = (name: MarkName) =>
  `<tg-emoji emoji-id="${MARK[name].id}">${MARK[name].fallback}</tg-emoji>`;

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
      // Named at somebody, so it is the one message in this file that is
      // waiting on the reader rather than telling them what already happened.
      // The button goes to the fixture, not the front page: an invitation you
      // then have to go and find is an invitation with a chore attached.
      return {
        text:
          `${E("duel")} <b>${s(p.from)} кидає тобі дуель на ${n(p.stake)} поінтів.</b>\n` +
          `${E("won")} <b>${s(p.match)}</b>`,
        button: {
          text: "прийняти",
          url: p.matchId ? `${SITE}/matches/${s(p.matchId)}` : SITE,
        },
      };
    case "duel_accepted":
      return {
        mark: "duel",
        text: `<b>${s(p.from)} прийняв твій виклик</b>\n${s(p.match)} · ${n(p.stake)} проти ${n(p.stake)}.`,
      };
    case "duel_won":
      // Two figures on the money line, because they answer different
      // questions: what landed on the balance, and what of it was won. One
      // number alone gets read as the other by half the people who see it.
      return {
        text:
          `${E("duel")} <b>Ти виграв дуель проти ${s(p.from)}.</b>\n` +
          `${E("won")} Забрав ${n(p.payout)} — з них ${n(p.profit)} чистими.`,
        button: { text: "ще одна дуель?", url: SITE },
      };
    case "duel_lost":
      return {
        text:
          `${E("duel")} <b>Ти програв дуель проти ${s(p.from)}.</b>\n` +
          `${E("lost")} Втратив своїх ${n(p.stake)} поінтів`,
        button: { text: "відіграємось?", url: SITE },
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
 * Send one message.
 *
 * The mark is a custom emoji entity, which Telegram only lets a bot use while
 * its owner holds Premium. That can lapse, and a bot that goes silent the day a
 * subscription expires is worse than a bot without decoration — so a refusal
 * that names the entity is retried with every custom emoji collapsed to the
 * plain glyph it already carries as its fallback content. The retry is a string
 * substitution rather than a second template, which is what keeps the two
 * versions from drifting apart.
 */
export async function send(
  token: string,
  chatId: string,
  message: Message,
): Promise<{ ok: boolean; error?: string }> {
  const post = (text: string) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...(message.button
          ? {
              reply_markup: {
                inline_keyboard: [[{ text: message.button.text, url: message.button.url }]],
              },
            }
          : {}),
      }),
    }).then((r) => r.json());

  // The mark leads, then a space, then the message — unless the template has
  // placed its own marks, in which case it knows better than this does where
  // they belong. Written as HTML so the bold survives; the emoji is a tag
  // rather than an entity offset, which is what keeps the two from having to
  // agree about string lengths.
  const text = message.mark
    ? `<tg-emoji emoji-id="${MARK[message.mark].id}">${MARK[message.mark].fallback}</tg-emoji> ${message.text}`
    : message.text;

  let out = await post(text);

  if (!out.ok && /emoji/i.test(String(out.description ?? ""))) {
    out = await post(text.replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/g, "$1"));
  }
  if (!out.ok) {
    return { ok: false, error: String(out.description ?? "unknown") };
  }
  return { ok: true };
}
