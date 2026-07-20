"use client";

import * as React from "react";
import { Send, Mail, Lock, Loader2, CircleAlert, CircleCheck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-surface-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-subtle " +
  "transition-colors focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

/** Supabase returns raw English — translate the ones players actually hit. */
function humanError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Невірна пошта або пароль. Якщо ти реєструвався через Google чи Telegram — заходь тим самим способом.";
  if (m.includes("email not confirmed"))
    return "Пошта не підтверджена. Перевір лист і підтверди адресу.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Такий акаунт уже існує. Спробуй увійти.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Забагато спроб. Зачекай хвилину і спробуй ще раз.";
  return msg;
}

export function AuthForm({
  mode,
  initialError,
}: {
  mode: "login" | "register";
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState<null | "google" | "email">(null);
  const [error, setError] = React.useState<string | null>(initialError ?? null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  // Telegram login as a plain top-level navigation: our button → Telegram →
  // back to /auth/tg, which forwards the signed payload to /auth/telegram.
  // The widget/popup flows both depend on a cross-origin iframe and JS hop
  // that iOS breaks ("can't open this page"); a normal redirect can't.
  function signInWithTelegram() {
    setError(null);
    setNotice(null);
    const botId = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID;
    if (!botId) {
      setNotice("Вхід через Telegram тимчасово недоступний.");
      return;
    }
    const origin = window.location.origin;
    const url = new URL("https://oauth.telegram.org/auth");
    url.searchParams.set("bot_id", botId);
    url.searchParams.set("origin", origin);
    url.searchParams.set("request_access", "write");
    url.searchParams.set("return_to", `${origin}/auth/tg`);
    window.location.href = url.toString();
  }

  async function signInWithGoogle() {
    setError(null);
    setLoading("google");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setError(humanError(error.message));
      setLoading(null);
    }
    // On success the browser is redirected to Google — no further work here.
  }

  /** Our own checks — the form is noValidate so the browser's grey bubbles
   *  (which can't be styled) never appear. */
  function validate(): string | null {
    if (!email.trim()) return "Вкажи пошту.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Перевір адресу пошти — схоже, у ній помилка.";
    if (password.length < 6) return "Пароль має бути щонайменше 6 символів.";
    if (mode === "register" && password !== confirm) return "Паролі не збігаються.";
    return null;
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }

    setLoading("email");
    const supabase = createClient();

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) setError(humanError(error.message));
      else setNotice("Перевір пошту — ми надіслали лист для підтвердження.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(humanError(error.message));
      else {
        router.push("/");
        router.refresh();
        return;
      }
    }
    setLoading(null);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading !== null}
          className="flex h-11 items-center justify-center gap-2.5 rounded-lg border border-border-strong bg-surface-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-3 disabled:opacity-60"
        >
          {loading === "google" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <GoogleGlyph />
          )}
          Продовжити з Google
        </button>
        <button
          type="button"
          onClick={signInWithTelegram}
          disabled={loading !== null}
          className="flex h-11 items-center justify-center gap-2.5 rounded-lg border border-border-strong bg-surface-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-3 disabled:opacity-60"
        >
          <Send className="size-4 text-info" />
          Продовжити з Telegram
        </button>
      </div>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-ink-subtle">або пошта</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form className="space-y-2.5" onSubmit={submitEmail} noValidate>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="email"
            required
            placeholder="you@email.com"
            className={inputCls}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Пароль"
            className={inputCls}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {mode === "register" && (
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Повторіть пароль"
              className={inputCls}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium leading-snug text-danger"
          >
            <CircleAlert className="mt-px size-3.5 shrink-0" />
            {error}
          </p>
        )}
        {notice && (
          <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs font-medium leading-snug text-success">
            <CircleCheck className="mt-px size-3.5 shrink-0" />
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={loading !== null}
          className={cn(
            "flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60",
          )}
        >
          {loading === "email" && <Loader2 className="size-4 animate-spin" />}
          {mode === "register" ? "Зареєструватися" : "Увійти"}
        </button>
      </form>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.67 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
