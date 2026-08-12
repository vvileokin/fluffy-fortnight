/**
 * Artwork for the active duty maps. Two sizes, two jobs:
 *   `mapIcon`  — the small radar/callout glyph, for chips and inline marks.
 *   `mapArt`   — a wide photo of the map, used only as faint background art
 *                behind a veto row. Never shown full-bleed: it's atmosphere,
 *                not a picture, and the labels always win.
 * Anything outside the pool (a retired map, a Wingman map) simply returns
 * null and the caller falls back to type.
 */
const ICONS: Record<string, string> = {
  ancient: "/maps/icons/ancient.webp",
  anubis: "/maps/icons/anubis.webp",
  cache: "/maps/icons/cache.webp",
  dust2: "/maps/icons/dust2.webp",
  inferno: "/maps/icons/inferno.webp",
  mirage: "/maps/icons/mirage.webp",
  nuke: "/maps/icons/nuke.webp",
};

const ART: Record<string, string> = {
  ancient: "/maps/photos/ancient.webp",
  anubis: "/maps/photos/anubis.webp",
  cache: "/maps/photos/cache.webp",
  dust2: "/maps/photos/dust2.webp",
  inferno: "/maps/photos/inferno.webp",
  mirage: "/maps/photos/mirage.webp",
  nuke: "/maps/photos/nuke.webp",
};

/** "Dust 2" / "de_dust2" / "DUST2" all resolve to the same key. */
export function mapKey(name: string): string {
  return name.toLowerCase().replace(/^de_/, "").replace(/[^a-z0-9]/g, "");
}

export function mapIcon(name: string): string | null {
  return ICONS[mapKey(name)] ?? null;
}

export function mapArt(name: string): string | null {
  return ART[mapKey(name)] ?? null;
}
