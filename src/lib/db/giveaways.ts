import "server-only";
import { createClient } from "@/lib/supabase/server";
import { type Giveaway } from "@/lib/data";

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
    description: r.description ?? "",
    conditions: r.conditions ?? [],
  };
}

export async function getGiveaways(): Promise<Giveaway[]> {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("giveaways")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map((r) => toGiveaway(r as Row)); // may be empty (that's fine)
  } catch {
    return [];
  }
}

export async function getGiveawayBySlug(slug: string): Promise<Giveaway | undefined> {
  try {
    const sb = await createClient();
    const { data } = await sb.from("giveaways").select("*").eq("slug", slug).maybeSingle();
    if (data) return toGiveaway(data as Row);
  } catch {
    /* fall through */
  }
  return undefined;
}
