"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Send, Mail, Check, CircleAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** What the /auth/telegram/link route sends back in `?telegram=`. */
const OUTCOME: Record<string, { tone: "ok" | "bad"; text: string }> = {
  linked: { tone: "ok", text: "Telegram прив'язано." },
  taken: {
    tone: "bad",
    text:
      "Цей Telegram уже прив'язаний до іншого акаунта з поінтами. " +
      "Вийди і зайди через Telegram, щоб потрапити в нього.",
  },
  already_linked: {
    tone: "bad",
    text: "До цього акаунта вже прив'язаний інший Telegram.",
  },
  telegram: { tone: "bad", text: "Не вдалося підтвердити Telegram. Спробуй ще раз." },
  telegram_expired: { tone: "bad", text: "Час підтвердження минув. Спробуй ще раз." },
};

export function AuthMethods({
  email,
  provider,
  telegramLinked,
  telegramUsername,
}: {
  email?: string;
  provider: "google" | "telegram" | "email";
  telegramLinked: boolean;
  telegramUsername?: string;
}) {
  const params = useSearchParams();
  const [busy, setBusy] = React.useState(false);
  const [unavailable, setUnavailable] = React.useState(false);

  const outcome = OUTCOME[params.get("telegram") ?? ""];

  // Same top-level navigation the login form uses. The widget and popup flows
  // both depend on a cross-origin iframe that iOS refuses to open; a plain
  // redirect can't be blocked. `mode=link` is what makes /auth/tg forward to
  // the linking route instead of the sign-in one.
  function linkTelegram() {
    const botId = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID;
    if (!botId) {
      setUnavailable(true);
      return;
    }
    setBusy(true);
    const origin = window.location.origin;
    const url = new URL("https://oauth.telegram.org/auth");
    url.searchParams.set("bot_id", botId);
    url.searchParams.set("origin", origin);
    url.searchParams.set("request_access", "write");
    url.searchParams.set("return_to", `${origin}/auth/tg?mode=link`);
    window.location.href = url.toString();
  }

  const primary =
    provider === "google"
      ? { icon: Check, label: "Google", detail: email }
      : provider === "telegram"
        ? { icon: Send, label: "Telegram", detail: telegramUsername && `@${telegramUsername}` }
        : { icon: Mail, label: "Пошта", detail: email };

  return (
    <div className="overflow-hidden rounded-xl surface-1">
      <Row
        icon={primary.icon}
        label={primary.label}
        detail={primary.detail}
        state="on"
      />

      {/* Telegram gets its own row unless it *is* the primary method — no
          point offering to link an account to itself. */}
      {provider !== "telegram" && (
        <Row
          icon={Send}
          label="Telegram"
          detail={
            telegramLinked
              ? telegramUsername
                ? `@${telegramUsername}`
                : "прив'язано"
              : undefined
          }
          state={telegramLinked ? "on" : "off"}
          action={
            telegramLinked ? undefined : (
              <button
                onClick={linkTelegram}
                disabled={busy}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                Прив&apos;язати
              </button>
            )
          }
        />
      )}

      {(outcome || unavailable) && (
        <p
          role="alert"
          className={cn(
            "flex items-start gap-2 px-4 py-2.5 text-xs font-medium leading-snug",
            "shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)_inset]",
            outcome?.tone === "ok" ? "text-success" : "text-warning",
          )}
        >
          {outcome?.tone === "ok" ? (
            <Check className="mt-px size-3.5 shrink-0" strokeWidth={3} />
          ) : (
            <CircleAlert className="mt-px size-3.5 shrink-0" />
          )}
          {unavailable
            ? "Вхід через Telegram тимчасово недоступний."
            : outcome?.text}
        </p>
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  detail,
  state,
  action,
}: {
  icon: React.ElementType;
  label: string;
  detail?: string;
  state: "on" | "off";
  action?: React.ReactNode;
}) {
  return (
    /* Impeccable: Crafted Method Row — the connected state is carried by the
       glyph's own colour rather than by a badge sitting beside the name, so
       the row reads at a glance without a second object competing with the
       action button on the right. */
    <div className="flex items-center gap-3 px-4 py-3 not-first:shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)_inset]">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          state === "on" ? "bg-[color-mix(in_oklch,var(--success)_14%,transparent)]" : "bg-fill-1",
        )}
      >
        <Icon
          className={cn("size-4", state === "on" ? "text-success" : "text-ink-subtle")}
          strokeWidth={2.5}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold leading-none text-ink">{label}</span>
        {detail && (
          <span className="truncate text-xs leading-none text-ink-subtle">{detail}</span>
        )}
      </span>
      {action}
    </div>
  );
}
