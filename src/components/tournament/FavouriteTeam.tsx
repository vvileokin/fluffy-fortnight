"use client";

import * as React from "react";
import { Check, Loader2, Lock } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { useUser } from "@/lib/supabase/use-user";
import { getTeam } from "@/lib/data";
import { EWC_PLAYOFF_TEAMS } from "@/lib/ewc-bracket";
import {
  FAVOURITE_MAX,
  FAVOURITE_PAYOUT,
  underdogTier,
} from "@/lib/favourite-team";
import { cn, formatInt } from "@/lib/utils";

type Api = {
  signedIn: boolean;
  open: boolean;
  started: boolean;
  team: string | null;
  earned: number;
};

/**
 * Impeccable: Crafted Favourite — one team, backed all the way.
 *
 * The multiplier is printed on every single card rather than explained once in
 * a paragraph above them. It is the whole decision: at ×1 the world number one
 * is obviously correct and nobody thinks twice, and it's only when the reader
 * can see ×2 sitting on the fourteenth seed that backing them becomes a
 * position worth taking. A rule you have to remember while scanning sixteen
 * cards is a rule most people will not apply.
 */
export function FavouriteTeam() {
  const user = useUser();
  const [data, setData] = React.useState<Api | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/favourite", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok) setData(d);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  if (failed) return <Failed onRetry={() => { setFailed(false); setNonce((n) => n + 1); }} />;
  if (!data) return <Skeleton rows={4} />;

  async function choose(team: string) {
    setBusy(team);
    setError(null);
    const res = await fetch("/api/favourite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(null);
    if (!out.ok) setError(out.error === "closed" ? "Вибір закрито." : "Не вдалося зберегти.");
    setNonce((n) => n + 1);
  }

  const picked = data.team;
  const t = picked ? getTeam(picked) : undefined;
  const band = picked ? underdogTier(picked) : null;

  return (
    <div className="skin-aura-card space-y-2.5 rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold tracking-tight text-white">Улюблена команда</p>
        <span className="tnum flex shrink-0 items-center gap-1 text-xs font-bold text-[rgb(var(--skin-ring))]">
          до {formatInt(FAVOURITE_MAX * 2)}
          <BrandIcon name="points-ewc" className="size-3.5" />
        </span>
      </div>

      <p className="text-xs leading-relaxed text-white/55">
        Капає за кожну перемогу твоєї команди в плей-офі: {FAVOURITE_PAYOUT.ro16} за
        1/8, {FAVOURITE_PAYOUT.qf} за 1/4, {FAVOURITE_PAYOUT.sf} за 1/2,{" "}
        {FAVOURITE_PAYOUT.gf} за фінал — і все це множиться на коефіцієнт команди.
      </p>

      {data.earned > 0 && (
        <p className="tnum flex items-center gap-1 text-xs font-bold text-success">
          Уже нараховано +{formatInt(data.earned)}
          <BrandIcon name="points-ewc" className="size-3.5" />
        </p>
      )}

      {!data.signedIn ? (
        <p className="text-xs text-ink-subtle">Увійди, щоб обрати команду.</p>
      ) : !data.open ? (
        picked && t ? (
          /* The locked pick is the only thing on this card that is still true,
             so it gets the crest and the team's own colour rather than a grey
             line of prose. It reads as a badge you are wearing for the rest of
             the playoff, which is what it is. */
          <div
            className="flex items-center gap-3 rounded-lg p-2.5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]"
            style={{
              backgroundImage: `linear-gradient(90deg, color-mix(in oklch, ${t.brand} 30%, transparent), transparent 70%)`,
            }}
          >
            <TeamLogo team={t} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold leading-tight text-white">
                {t.name}
              </p>
              <p className="flex items-center gap-1 text-[0.6875rem] leading-tight text-white/50">
                <Lock className="size-3 shrink-0" />
                вибір зафіксовано
              </p>
            </div>
            {band && band.multiplier > 1 && (
              <span className="tnum shrink-0 rounded-md bg-black/35 px-1.5 py-1 font-mono text-xs font-bold text-[rgb(var(--skin-hot))]">
                ×{band.multiplier}
              </span>
            )}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <Lock className="size-3.5 shrink-0 text-ink-subtle" />
            Вибір закрито.
          </p>
        )
      ) : (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {EWC_PLAYOFF_TEAMS.map((slug) => {
              const t = getTeam(slug);
              const band = underdogTier(slug);
              const on = picked === slug;
              return (
                <button
                  key={slug}
                  onClick={() => choose(slug)}
                  disabled={!!busy}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-2 text-left transition-colors",
                    on
                      ? "bg-[rgb(198_96_40)] text-[#1a0a0d]"
                      : "bg-black/30 text-white hover:bg-white/[0.08]",
                    busy && !on && "opacity-50",
                  )}
                >
                  {busy === slug ? (
                    <Loader2 className="size-5 shrink-0 animate-spin" />
                  ) : t ? (
                    <TeamLogo team={t} size="xs" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                    {t?.name ?? slug}
                  </span>
                  {/* The band, on every card. See the note above the component. */}
                  <span
                    className={cn(
                      "tnum shrink-0 rounded px-1 py-px font-mono text-[0.625rem] font-bold",
                      on
                        ? "bg-black/20 text-[#1a0a0d]"
                        : band && band.multiplier > 1
                          ? "bg-[rgb(var(--skin-ring)/0.18)] text-[rgb(var(--skin-hot))]"
                          : "bg-white/[0.07] text-white/45",
                    )}
                  >
                    ×{band?.multiplier ?? 1}
                  </span>
                  {on && <Check className="size-3.5 shrink-0" strokeWidth={3} />}
                </button>
              );
            })}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Something is always on screen.
 *
 * Both cards used to render `null` until their fetch landed and swallow any
 * failure, so a slow reply showed an empty tab and a failed one showed an empty
 * tab for good — indistinguishable from the feature not existing. A shape while
 * loading, and a reason when it breaks, is the difference between "wait" and
 * "this is broken".
 */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="skin-aura-card space-y-2.5 rounded-xl p-3 sm:p-4">{children}</div>;
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <Shell>
      <div className="h-4 w-40 animate-pulse rounded bg-white/[0.07]" />
      <div className="grid gap-1.5" style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-white/[0.05]" />
        ))}
      </div>
    </Shell>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <Shell>
      <p className="text-xs text-white/60">Не вдалося завантажити.</p>
      <button
        onClick={onRetry}
        className="h-9 w-full rounded-lg bg-white/[0.06] text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.12]"
      >
        Спробувати ще раз
      </button>
    </Shell>
  );
}
