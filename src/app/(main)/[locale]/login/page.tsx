import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { ChevronLeft } from "lucide-react";
import { Brand } from "@/components/layout/Brand";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Вхід" };

/** Auth routes bounce back here with ?error=… — say what actually went wrong. */
const authErrors: Record<string, string> = {
  telegram: "Не вдалося увійти через Telegram. Спробуй ще раз або обери інший спосіб.",
  telegram_expired: "Сесія Telegram застаріла. Натисни «Продовжити з Telegram» ще раз.",
  auth: "Не вдалося завершити вхід. Спробуй ще раз.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError = error ? (authErrors[error] ?? authErrors.auth) : undefined;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 aura-accent" />
      <Link
        href="/"
        className="absolute left-4 top-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-4" />
        На головну
      </Link>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Brand />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">
            Вхід у спільноту
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Відповідай на прогнози, збирай поінти та змагайся в лідерборді.
          </p>
        </div>

        <AuthForm mode="login" initialError={initialError} />

        <p className="mt-4 text-center text-sm text-ink-muted">
          Немає акаунта?{" "}
          <Link href="/register" className="font-semibold text-accent hover:underline">
            Зареєструватися
          </Link>
        </p>
      </div>
    </main>
  );
}
