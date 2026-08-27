"use client";

import * as React from "react";
import { createClient } from "./client";
import { useUser } from "./use-user";

/**
 * How many people are on the site right now.
 *
 * Realtime presence rather than a heartbeat table: presence is held in the
 * connection itself, so a reader who closes the tab is gone the moment the
 * socket drops instead of lingering until some "last seen" window expires. It
 * also writes nothing — no rows, no migration, and no anonymous visitor needing
 * permission to record that they exist.
 *
 * Keyed by user id where there is one, so a person with the site open in three
 * tabs counts once. Anonymous readers get a per-tab id, which is the closest
 * honest answer available: without an account there is nothing to tell two tabs
 * and two people apart.
 *
 * Returns null until the first sync. A count that starts at 1 and jumps is
 * worse than one that arrives a beat late, because the 1 is a number the reader
 * will believe.
 */
export function useOnlineCount(): number | null {
  const user = useUser();
  const [count, setCount] = React.useState<number | null>(null);
  const [wide, setWide] = React.useState(false);

  /**
   * Only where the count is actually shown.
   *
   * The rail is `hidden lg:flex`, which hides it in CSS — React still mounts
   * this hook on a phone and still opens the socket. That put a live connection
   * on every mobile visitor for a number none of them can see, and on a match
   * day that is hundreds of sockets held for nothing.
   */
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    if (!wide) return;
    if (user === undefined) return; // auth still resolving; don't join twice
    const key = user?.id ?? `guest:${crypto.randomUUID()}`;
    const supabase = createClient();
    const channel = supabase.channel("online", { config: { presence: { key } } });

    channel
      .on("presence", { event: "sync" }, () => {
        setCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ at: Date.now() });
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, wide]);

  return count;
}
