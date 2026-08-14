import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { type Giveaway, type GiveawayWinner } from "@/lib/data";

type Row = {
  slug: string;
  prize: string;
  sponsor: string | null;
  value_usd: number;
  end_label: string | null;
  end_iso: string | null;
  entrants: number;
  min_points: number;
  status: Giveaway["status"];
  cover: string;
  image: string | null;
  description: string | null;
  conditions: string[] | null;
  winners_count: number | null;
  drawn_at: string | null;
  skin: Giveaway["skin"] | null;
  entry_cost: number | null;
  entry_currency: Giveaway["entryCurrency"] | null;
  max_tickets: number | null;
  require_telegram: boolean | null;
};

function toGiveaway(r: Row): Giveaway {
  return {
    slug: r.slug,
    prize: r.prize,
    sponsor: r.sponsor ?? "",
    valueUSD: r.value_usd,
    endISO: r.end_iso ?? "",
    endLabel: r.end_label ?? "",
    entrants: r.entrants,
    minPoints: r.min_points,
    status: r.status,
    cover: r.cover,
    image: r.image ?? undefined,
    // Absent until migration 0034; a giveaway with no skin is the normal case.
    skin: r.skin ?? undefined,
    description: r.description ?? "",
    conditions: r.conditions ?? [],
    // `?? 1` rather than `?? 0`: these columns are absent until migration 0032
    // runs, and a giveaway with zero winners would render as already-decided.
    winnersCount: r.winners_count ?? 1,
    drawnAt: r.drawn_at ?? undefined,
    winners: [],
    // All absent until migration 0035. The fallbacks are the behaviour the
    // site had before it: free to enter, one entry each, no Telegram gate —
    // so a pending migration degrades to the old giveaway rather than to a
    // card that charges an undefined number of points.
    entryCost: r.entry_cost ?? 0,
    entryCurrency: r.entry_currency ?? "points",
    maxTickets: r.max_tickets ?? 1,
    requireTelegram: r.require_telegram ?? false,
    myTickets: 0,
  };
}

/** Winners for a set of giveaways, resolved to handles. Empty pre-migration. */
async function loadWinners(
  sb: Awaited<ReturnType<typeof createClient>>,
  slugs: string[],
): Promise<Map<string, GiveawayWinner[]>> {
  const out = new Map<string, GiveawayWinner[]>();
  if (slugs.length === 0) return out;
  try {
    const { data } = await sb
      .from("giveaway_winners")
      .select("giveaway_slug, user_id, place")
      .in("giveaway_slug", slugs)
      .order("place");
    if (!data?.length) return out;

    const ids = [...new Set(data.map((w) => w.user_id as string))];
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, handle, avatar_url")
      .in("id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

    for (const w of data) {
      const slug = w.giveaway_slug as string;
      const p = byId.get(w.user_id as string);
      const list = out.get(slug) ?? [];
      list.push({
        userId: w.user_id as string,
        handle: (p?.handle as string) || "гравець",
        avatarUrl: (p?.avatar_url as string) || undefined,
        place: (w.place as number) ?? 1,
      });
      out.set(slug, list);
    }
  } catch {
    /* table not there yet — a giveaway with no winners is a valid state */
  }
  return out;
}

export async function getGiveaways(): Promise<Giveaway[]> {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("giveaways")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    const list = data.map((r) => toGiveaway(r as Row)); // may be empty (that's fine)
    const winners = await loadWinners(sb, list.map((g) => g.slug));
    return list.map((g) => ({ ...g, winners: winners.get(g.slug) ?? [] }));
  } catch {
    return [];
  }
}

/** Cached per request: generateMetadata and the page itself both ask for the same giveaway. */
export const getGiveawayBySlug = cache(async function getGiveawayBySlug(
  slug: string,
): Promise<Giveaway | undefined> {
  try {
    const sb = await createClient();
    const { data } = await sb.from("giveaways").select("*").eq("slug", slug).maybeSingle();
    if (!data) return undefined;

    const g = toGiveaway(data as Row);
    const winners = await loadWinners(sb, [slug]);
    g.winners = winners.get(slug) ?? [];

    // RLS lets a player read only their own entry, so this doubles as the
    // "have I entered?" check without exposing anyone else's.
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (user) {
      const mineFor = (columns: string) =>
        sb
          .from("giveaway_entries")
          .select(columns)
          .eq("giveaway_slug", slug)
          .eq("user_id", user.id)
          .maybeSingle();

      // `tickets` arrives with migration 0035, and PostgREST fails the whole
      // select on one unknown column — which would hide the fact that this
      // player has entered at all. Same retry the profile hook uses.
      const full = await mineFor("user_id, tickets");
      const mine = full.error ? (await mineFor("user_id")).data : full.data;

      const row = mine as { user_id?: string; tickets?: number } | null;
      g.entered = !!row;
      g.myTickets = row?.tickets ?? (row ? 1 : 0);
    }
    return g;
  } catch {
    /* fall through */
  }
  return undefined;
});
