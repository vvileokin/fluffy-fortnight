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
    supabase
      .from("profiles")
      .select("id, handle, avatar_url, points, bounty_points, correct, streak, is_admin")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile((data as Profile) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { user, profile };
}
