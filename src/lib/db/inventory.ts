import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sortByNewest, type InventoryItem, type Rarity } from "@/lib/inventory";

type Row = {
  id: string;
  name: string;
  wear: string | null;
  rarity: string | null;
  image: string | null;
  source: string | null;
  created_at: string;
};

const RARITIES: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "mythical",
  "legendary",
  "covert",
];

function toItem(r: Row): InventoryItem {
  return {
    id: r.id,
    name: r.name,
    wear: r.wear ?? undefined,
    rarity: RARITIES.includes(r.rarity as Rarity) ? (r.rarity as Rarity) : "common",
    image: r.image ?? undefined,
    source: r.source ?? undefined,
    obtainedISO: r.created_at,
  };
}

/**
 * A player's items. Returns an empty list — not an error — when the table
 * hasn't been created yet, so the profile renders its empty state instead of
 * breaking on a deploy that hasn't run the migration.
 */
export async function getInventory(userId: string): Promise<InventoryItem[]> {
  try {
    const sb = await createClient();
    const { data } = await sb
      .from("user_items")
      .select("id, name, wear, rarity, image, source, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return sortByNewest((data ?? []).map((r) => toItem(r as Row)));
  } catch {
    return [];
  }
}
