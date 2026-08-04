import "server-only";
import { teams } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";

export type CatalogTeam = { slug: string; name: string; tag: string; logo: string; brand: string };

export const normTeamName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Teams indexed by every spelling we might recognise one by. */
export function buildTeamIndex(list: CatalogTeam[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const t of list) {
    for (const key of [t.name, t.tag, t.slug]) {
      const k = normTeamName(key);
      if (k && !index.has(k)) index.set(k, t.slug);
    }
  }
  return index;
}

/** Best-guess slug for a name, checking the given candidates in order. */
export function resolveTeamSlug(
  index: Map<string, string>,
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const c of candidates) {
    const hit = c ? index.get(normTeamName(c)) : null;
    if (hit) return hit;
  }
  return null;
}

/** The hardcoded catalog plus every team created from an earlier import. */
export async function fullTeamCatalog(
  admin: ReturnType<typeof createAdminClient>,
): Promise<CatalogTeam[]> {
  const base: CatalogTeam[] = Object.values(teams).map((t) => ({
    slug: t.slug,
    name: t.name,
    tag: t.tag,
    logo: t.logo,
    brand: t.brand,
  }));
  const { data } = await admin.from("custom_teams").select("slug, name, tag, logo, brand");
  const known = new Set(base.map((t) => t.slug));
  for (const t of data ?? []) {
    if (!known.has(t.slug)) {
      base.push({ slug: t.slug, name: t.name, tag: t.tag, logo: t.logo ?? "", brand: t.brand });
    }
  }
  return base;
}
