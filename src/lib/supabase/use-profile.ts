"use client";

import * as React from "react";
import { createClient } from "./client";
import { useUser } from "./use-user";

export type Profile = {
  id: string;
  handle: string;
  avatar_url: string | null;
  points: number;
  bounty_points: number;
  /** EWC 2026 event points. Absent until migration 0033 runs. */
  ewc_points?: number;
  correct: number;
  streak: number;
  is_admin: boolean;
};

/** Current user's profile row (points, bounty, etc.), reactive to auth. */
export function useProfile() {
  const user = useUser();
  const [profile, setProfile] = React.useState<Profile | null | undefined>(undefined);

  React.useEffect(() => {
    if (user === undefined) return; // still resolving auth
    if (user === null) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    const BASE = "id, handle, avatar_url, points, bounty_points, correct, streak, is_admin";
    const read = (columns: string) =>
      supabase.from("profiles").select(columns).eq("id", user.id).maybeSingle();

    // `ewc_points` doesn't exist until migration 0033 runs, and PostgREST fails
    // the *whole* select on one unknown column — which would blank the balance
    // and the streak too, not just the event chip. Retry without it rather than
    // let a pending migration empty the top bar.
    read(`${BASE}, ewc_points`).then(({ data, error }) => {
      if (cancelled) return;
      if (!error) {
        setProfile((data as unknown as Profile) ?? null);
        return;
      }
      read(BASE).then(({ data: base }) => {
        if (!cancelled) setProfile((base as unknown as Profile) ?? null);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { user, profile };
}
