import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const SLUG = "ewc-2026";
const PLAYOFF_STAGE = /playoff|плей|1\/8|1\/4|1\/2|фінал/i;

export type PlayoffWindow = {
  /** Picks are being accepted. */
  open: boolean;
  /** A playoff fixture is no longer upcoming. Closes it unless overridden. */
  started: boolean;
  /** An admin shut it by hand. Beats everything. */
  closed: boolean;
  /** An admin re-opened it knowing the playoff has begun. */
  forceOpen: boolean;
};

/**
 * Is the playoff still open to predictions?
 *
 * Both the bracket and the favourite team hang on this one fact, and both used
 * to answer it by loading `getMatches()` — every match, every column, with the
 * open-question stats overlaid on top. That is 82 rows and two round trips
 * (~440ms measured) to discover whether a single fixture has kicked off, and it
 * happened twice per visit because the two cards ask independently.
 *
 * This asks the narrow question instead: of the event's matches that are no
 * longer upcoming, is any of them a playoff one? Only `stage` comes back, and
 * the admin switch is fetched alongside rather than after it.
 */
export async function playoffWindow(): Promise<PlayoffWindow> {
  const admin = createAdminClient();
  const [live, settings] = await Promise.all([
    admin
      .from("matches")
      .select("stage")
      .eq("tournament_slug", SLUG)
      .neq("status", "upcoming"),
    admin
      .from("site_settings")
      .select("bracket_closed, bracket_force_open")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const started = (live.data ?? []).some((m) => PLAYOFF_STAGE.test(m.stage ?? ""));
  const closed = !!settings.data?.bracket_closed;
  const forceOpen = !!settings.data?.bracket_force_open;

  // Closing by hand beats everything; after that an explicit re-open beats the
  // automatic close, and only then does the first live fixture decide.
  const open = closed ? false : forceOpen ? true : !started;
  return { open, started, closed, forceOpen };
}
