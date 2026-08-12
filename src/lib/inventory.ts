/**
 * Player inventory — items won in giveaways or bought with points.
 *
 * Rarity carries its own colour rather than a design token, for the same
 * reason teams do: it's domain language players already read at a glance, and
 * a CS2 audience knows the blue → purple → pink → red → gold ladder without a
 * legend. Keeping it local to this module means it can't leak into the rest of
 * the palette, where yellow stays the only signal colour.
 */
export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "mythical"
  | "legendary"
  | "covert";

export type InventoryItem = {
  id: string;
  name: string;
  /** e.g. "Field-Tested" — optional, skins have it and stickers don't. */
  wear?: string;
  rarity: Rarity;
  image?: string;
  /** ISO timestamp the item landed in the inventory. */
  obtainedISO: string;
  /** Where it came from, shown as provenance on the card. */
  source?: string;
};

export const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: "Ширвжиток", color: "oklch(0.72 0.03 250)" },
  uncommon: { label: "Промислова", color: "oklch(0.68 0.13 235)" },
  rare: { label: "Армійська", color: "oklch(0.62 0.17 268)" },
  mythical: { label: "Заборонена", color: "oklch(0.6 0.2 300)" },
  legendary: { label: "Засекречена", color: "oklch(0.62 0.22 350)" },
  covert: { label: "Таємна", color: "oklch(0.62 0.23 25)" },
};

/** Newest first — an inventory reads as "what did I just get". */
export function sortByNewest(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => b.obtainedISO.localeCompare(a.obtainedISO));
}
