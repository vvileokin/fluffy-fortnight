import "server-only";
import { createClient } from "@/lib/supabase/server";
import { promoBanner, type PromoBanner, type Tournament } from "@/lib/data";

export type SiteSettings = {
  promo: PromoBanner;
  covers: Record<string, string>; // tournament slug -> cover image url
};

const defaults: SiteSettings = {
  promo: { ...promoBanner },
  covers: {},
};

/** Editable site content (promo banner + tournament covers). Falls back to the
 * built-in defaults when the row/table is absent. */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const sb = await createClient();
    const { data } = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
    if (!data) return defaults;
    return {
      promo: {
        enabled: data.promo_enabled ?? defaults.promo.enabled,
        image: data.promo_image || defaults.promo.image,
        linkType: (data.promo_link_type as PromoBanner["linkType"]) || defaults.promo.linkType,
        target: data.promo_target || defaults.promo.target,
      },
      covers: (data.covers as Record<string, string>) ?? {},
    };
  } catch {
    return defaults;
  }
}

/** Overlay admin cover overrides on top of the static tournament covers. */
export function applyCovers<T extends Tournament>(
  list: T[],
  covers: Record<string, string>,
): T[] {
  return list.map((t) => (covers[t.slug] ? { ...t, coverImage: covers[t.slug] } : t));
}
