"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Check, Loader2, Lock, LogIn, Trophy } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { useUser } from "@/lib/supabase/use-user";
import { getTeam } from "@/lib/data";
import {
  BRACKET_MAX,
  BRACKET_SCORING,
  BRACKET_ROUND_SIZES,
  type BracketPicks,
} from "@/lib/bracket-scoring";
import { cn, formatInt } from "@/lib/utils";

type Api = {
  signedIn: boolean;
  open: boolean;
  started: boolean;
  teams: string[];
  mine: { picks: BracketPicks; points: number; scored: boolean } | null;
};

/** The four narrowing steps, in order. Each is chosen out of the one before. */
const STEPS = [
  { key: "qf" as const, size: BRACKET_ROUND_SIZES.qf, label: "Хто вийде в 1/4", per: BRACKET_SCORING.qf },
  { key: "sf" as const, size: BRACKET_ROUND_SIZES.sf, label: "Хто вийде в 1/2", per: BRACKET_SCORING.sf },
  { key: "final" as const, size: BRACKET_ROUND_SIZES.final, label: "Хто вийде у фінал", per: BRACKET_SCORING.final },
  { key: "champion" as const, size: 1, label: "Хто підніме кубок", per: BRACKET_SCORING.champion },
];

/**
 * Impeccable: Crafted Bracket Card — the playoff, called in one sitting.
 *
 * Narrowing, not a grid of dropdowns. A player picks eight of sixteen, then
 * four of those eight, then two, then one — which is both how the tournament
 * actually works and exactly what the scoring measures, so the form never
 * implies a precision the points don't reward. Fifteen separate match slots
 * would have looked more like a bracket and taught the wrong thing about how
 * it's marked.
 */
export function PlayoffBracketEntry() {
  const user = useUser();
  const [data, setData] = React.useState<Api | null>(null);
  const [step, setStep] = React.useState(0);
  const [sel, setSel] = React.useState<Record<string, string[]>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/bracket", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  if (!data) return null;

  /* ---- already submitted ---- */
  if (data.mine) {
    return (
      <Panel>
        <div className="flex items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--success)_12%,transparent)] px-3.5 py-3 text-sm font-semibold text-success">
          <Check className="size-4 shrink-0" strokeWidth={3} />
          Сітку заповнено
        </div>
        <Filled picks={data.mine.picks} />
        <p className="text-xs leading-relaxed text-ink-subtle">
          {data.mine.scored ? (
            <>
              Нараховано{" "}
              <span className="tnum font-bold text-[rgb(255_154_64)]">
                +{formatInt(data.mine.points)}
              </span>{" "}
              EWC поінтів.
            </>
          ) : (
            "Бали нарахуємо після завершення плей-офу."
          )}
        </p>
      </Panel>
    );
  }

  /* ---- gates ---- */
  if (!data.signedIn) {
    return (
      <Panel>
        <Intro />
        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[rgb(255_122_44)] text-sm font-bold text-[#1a0a0d] transition-colors hover:bg-[rgb(255_146_72)]"
        >
          <LogIn className="size-4" strokeWidth={2.5} />
          Увійти, щоб заповнити
        </Link>
      </Panel>
    );
  }

  if (!data.open) {
    return (
      <Panel>
        <Intro />
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" />
          {data.started
            ? "Плей-оф уже почався — заповнити сітку більше не можна."
            : "Відкриється, щойно визначаться всі 16 учасників плей-офу."}
        </p>
      </Panel>
    );
  }

  /* ---- the form ---- */
  const current = STEPS[step];
  const pool = step === 0 ? data.teams : sel[STEPS[step - 1].key] ?? [];
  const chosen = sel[current.key] ?? [];
  const done = chosen.length === current.size;

  const toggle = (slug: string) => {
    setError(null);
    setSel((prev) => {
      const at = prev[current.key] ?? [];
      if (at.includes(slug)) return { ...prev, [current.key]: at.filter((s) => s !== slug) };
      if (at.length >= current.size) return prev;
      return { ...prev, [current.key]: [...at, slug] };
    });
  };

  async function submit() {
    setBusy(true);
    setError(null);
    const picks = {
      qf: sel.qf,
      sf: sel.sf,
      final: sel.final,
      champion: (sel.champion ?? [])[0],
    };
    const res = await fetch("/api/bracket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!out.ok) {
      setError(
        out.error === "already_submitted"
          ? "Ти вже заповнив сітку."
          : out.error === "closed"
            ? "Плей-оф уже почався."
            : "Не вдалося зберегти. Спробуй ще раз.",
      );
      setNonce((n) => n + 1);
      return;
    }
    setNonce((n) => n + 1);
  }

  return (
    <Panel>
      <Intro />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-ink">{current.label}</p>
        <span className="tnum shrink-0 font-mono text-xs font-bold text-ink-muted">
          {chosen.length}/{current.size}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {pool.map((slug) => {
          const t = getTeam(slug);
          const on = chosen.includes(slug);
          return (
            <button
              key={slug}
              onClick={() => toggle(slug)}
              aria-pressed={on}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                on
                  ? "bg-[rgb(255_122_44/0.18)] shadow-[inset_0_0_0_1px_rgb(255_122_44/0.6)]"
                  : "bg-black/30 shadow-[inset_0_0_0_1px_rgb(255_120_50/0.14)] hover:bg-black/45",
              )}
            >
              {t ? (
                <TeamLogo team={t} size="xs" />
              ) : (
                <span className="size-5 shrink-0 rounded bg-white/5" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
                {t?.name ?? slug}
              </span>
              {on && <Check className="size-3.5 shrink-0 text-[rgb(255_154_64)]" strokeWidth={3} />}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="h-11 shrink-0 rounded-lg px-4 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Назад
          </button>
        )}
        <button
          onClick={() => (step === STEPS.length - 1 ? submit() : setStep((s) => s + 1))}
          disabled={!done || busy}
          className={cn(
            "flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors",
            "bg-[rgb(255_122_44)] text-[#1a0a0d] hover:bg-[rgb(255_146_72)]",
            "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[rgb(255_122_44)]",
          )}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {step === STEPS.length - 1 ? "Заповнити остаточно" : "Далі"}
        </button>
      </div>

      {step === STEPS.length - 1 && (
        <p className="text-center text-xs text-ink-subtle">
          Змінити сітку після збереження не можна.
        </p>
      )}
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="ewc-aura-card space-y-3 rounded-xl p-4">{children}</div>;
}

function Intro() {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-white">
        <Trophy className="size-4 text-[rgb(255_154_64)]" />
        Заповни сітку плей-офу
      </p>
      <p className="text-xs leading-relaxed text-white/55">
        Один раз, до старту плей-офу. Бали йдуть за кожну команду, яка справді
        дійшла до названого раунду — навіть якщо шлях склався інакше, ніж ти
        передбачив. Максимум{" "}
        <span className="tnum font-bold text-[rgb(255_154_64)]">
          {formatInt(BRACKET_MAX)}
        </span>{" "}
        <BrandIcon name="points-ewc" className="inline-block size-3.5 align-[-2px]" /> EWC.
      </p>
    </div>
  );
}

/** A submitted bracket, read-only — the champion first, then the rounds. */
function Filled({ picks }: { picks: BracketPicks }) {
  const rows = [
    { label: "Чемпіон", teams: [picks.champion] },
    { label: "Фінал", teams: picks.final },
    { label: "1/2", teams: picks.sf },
    { label: "1/4", teams: picks.qf },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start gap-2.5">
          <span className="w-14 shrink-0 pt-1 text-[0.6875rem] font-bold uppercase tracking-wide text-white/40">
            {r.label}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {r.teams.map((slug) => {
              const t = getTeam(slug);
              return (
                <span
                  key={slug}
                  className="flex items-center gap-1.5 rounded-md bg-black/35 px-2 py-1 text-xs font-semibold text-white"
                >
                  {t && <TeamLogo team={t} size="xs" />}
                  {t?.name ?? slug}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
