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

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/favourite", { cache: "no-store" })
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
  const tier = picked ? underdogTier(picked) : null;

  return (
    <div className="ewc-aura-card space-y-2.5 rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold tracking-tight text-white">Улюблена команда</p>
        <span className="tnum flex shrink-0 items-center gap-1 text-xs font-bold text-[rgb(255_154_64)]">
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
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" />
          {picked ? (
            <>
              Твій вибір: <span className="font-bold text-white">{getTeam(picked)?.name}</span>
              {tier && tier.multiplier > 1 && ` (×${tier.multiplier})`}
            </>
          ) : (
            "Вибір закрито."
          )}
        </p>
      ) : (
        <>
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
                          ? "bg-[rgb(255_154_64/0.18)] text-[rgb(255_178_112)]"
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
          <p className="text-[0.6875rem] text-white/40">
            Що нижчий сід — то більший множник. Змінити можна, доки прийом відкритий.
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
