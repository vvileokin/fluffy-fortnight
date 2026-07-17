"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

/**
 * Telegram returns here after a login. It hands the signed payload back either
 * in the fragment (#tgAuthResult=<base64url json>) or as plain query params —
 * the fragment never reaches the server, so we decode it client-side and pass
 * it on to /auth/telegram, which verifies the hash and mints the session.
 */
function decodeAuthResult(raw: string): Record<string, unknown> | null {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

export default function TelegramReturnPage() {
  React.useEffect(() => {
    const go = (qs: string) => window.location.replace(`/auth/telegram?${qs}`);

    const hash = window.location.hash.replace(/^#/, "");
    const raw = new URLSearchParams(hash).get("tgAuthResult");
    if (raw) {
      const user = decodeAuthResult(raw);
      if (user) {
        const out = new URLSearchParams();
        for (const [k, v] of Object.entries(user)) {
          if (v !== null && v !== undefined) out.set(k, String(v));
        }
        go(out.toString());
        return;
      }
    }

    const query = window.location.search.replace(/^\?/, "");
    if (query) {
      go(query);
      return;
    }

    window.location.replace("/login?error=telegram");
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 className="size-4 animate-spin" />
        Завершуємо вхід через Telegram…
      </p>
    </main>
  );
}
