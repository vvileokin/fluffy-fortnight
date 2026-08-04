import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { tournaments as builtIn, allTournaments, type Tournament } from "@/lib/data";

type Row = {
  slug: string;
  name: string;
  short_name: string;
  tier: number;
  status: string;
  start_at: string | null;
  end_at: string | null;
  location: string;
  online: boolean;
  prize_usd: number;
  format: string;
  accent: string;
  cover_image: string | null;
};

const MONTHS = [
  "січ", "лют", "бер", "кві", "тра", "чер",
  "лип", "сер", "вер", "жов", "лис", "гру",
];

/** "21 лип – 2 сер", the same shape the hardcoded tournaments use. */
function dateLabel(startISO: string, endISO: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  };
  const from = fmt(startISO);
  const to = fmt(endISO);
  if (from && to && from !== to) return `${from} – ${to}`;
  return from || to || "дати уточнюються";
}

function toTournament(r: Row): Tournament {
  const startISO = r.start_at ?? "";
  const endISO = r.end_at ?? r.start_at ?? "";
  return {
    slug: r.slug,
    name: r.name,
    shortName: r.short_name,
    tier: (r.tier === 1 ? 1 : 2) as Tournament["tier"],
    status: r.status as Tournament["status"],
    startISO,
    endISO,
    dateLabel: dateLabel(startISO, endISO),
    location: r.location,
    online: r.online,
    prizeUSD: r.prize_usd,
    teamSlugs: [],
    format: r.format,
    accent: r.accent,
    coverImage: r.cover_image ?? undefined,
  };
}

/** Tournaments created from the import. Empty if the table isn't there yet. */
const listCustom = cache(async (): Promise<Tournament[]> => {
  try {
    const sb = await createClient();
    const { data } = await sb
      .from("custom_tournaments")
      .select(
        "slug, name, short_name, tier, status, start_at, end_at, location, online, prize_usd, format, accent, cover_image",
      )
      .order("start_at", { ascending: false });
    return (data ?? []).map((r) => toTournament(r as Row));
  } catch {
    return [];
  }
});

/** The public catalog: our own events plus everything imported. */
export const listTournaments = cache(async (): Promise<Tournament[]> => {
  const custom = await listCustom();
  const known = new Set(builtIn.map((t) => t.slug));
  return [...builtIn, ...custom.filter((t) => !known.has(t.slug))];
});

/** One tournament by slug, from anywhere it might be defined. */
export async function findTournament(slug: string): Promise<Tournament | undefined> {
  const hardcoded = allTournaments.find((t) => t.slug === slug);
  if (hardcoded) return hardcoded;
  return (await listCustom()).find((t) => t.slug === slug);
}
