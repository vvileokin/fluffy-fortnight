import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Global rank per team slug, from Valve's Regional Standings. Request-cached. */
export const getWorldRanks = cache(async (): Promise<Record<string, number>> => {
  try {
    const sb = await createClient();
    const { data } = await sb
      .from("team_ranks")
      .select("slug, global_rank")
      .not("global_rank", "is", null);
    return Object.fromEntries((data ?? []).map((r) => [r.slug, r.global_rank as number]));
  } catch {
    return {};
  }
});
