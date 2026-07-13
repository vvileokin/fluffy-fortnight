"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./client";

/**
 * Current Supabase user, reactive to sign-in / sign-out.
 * `undefined` = still loading, `null` = signed out, `User` = signed in.
 */
export function useUser() {
  const [user, setUser] = React.useState<User | null | undefined>(undefined);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return user;
}

/** Best-effort display name from a Supabase user. */
export function displayName(user: User): string {
  const m = user.user_metadata ?? {};
  return (
    m.name ||
    m.full_name ||
    m.user_name ||
    m.preferred_username ||
    user.email?.split("@")[0] ||
    "гравець"
  );
}
