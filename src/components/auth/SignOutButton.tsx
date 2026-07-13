"use client";

import * as React from "react";
import { LogOut, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-ink-muted transition-colors hover:border-danger/50 hover:text-danger disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      Вийти
    </button>
  );
}
