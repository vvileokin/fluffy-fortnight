import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { ChevronLeft } from "lucide-react";
import { Brand } from "@/components/layout/Brand";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Реєстрація" };

export default function RegisterPage() {
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
            Створити акаунт
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Приєднуйся до спільноти та починай прогнозувати.
          </p>
        </div>

        <AuthForm mode="register" />

        <p className="mt-4 text-center text-sm text-ink-muted">
          Вже є акаунт?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Увійти
          </Link>
        </p>
      </div>
    </main>
  );
}
