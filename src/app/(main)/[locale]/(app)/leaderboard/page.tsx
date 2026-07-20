import type { Metadata } from "next";
import { Crown, TrendingUp, Target, Flame } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { LeaderboardTable, STREAK_HINT } from "@/components/leaderboard/LeaderboardTable";
import { Tooltip } from "@/components/ui/Tooltip";
import { getLeaderboard } from "@/lib/db/leaderboard";
import { cn, formatInt } from "@/lib/utils";

export const metadata: Metadata = { title: "Лідерборд" };

export default async function LeaderboardPage() {
  const rows = await getLeaderboard(1000);
  const me = rows.find((r) => r.isYou);

  const stats = [
    { icon: Crown, label: "Твоє місце", value: me ? `#${me.rank}` : "—" },
    { icon: Target, label: "Поінтів у сезоні", value: me ? formatInt(me.points) : "0" },
    {
      icon: TrendingUp,
      label: "Вірних прогнозів",
      value: me ? String(me.correct) : "0",
      hint: "Вірні відповіді разом: прогнози на матчі та вгадані пари в bounty-драфті.",
    },
    { icon: Flame, label: "Серія", value: me ? String(me.streak) : "0", hint: STREAK_HINT },
  ];

  return (
    <div className="space-y-6">
      <PageIntro
        icon={Crown}
        title="Сезонний лідерборд"
        subtitle="Сезон 3 · 16 липня – 13 грудня. Рейтинг оновлюється після кожного розрахунку."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => {
          const card = (
            <>
              <s.icon className="size-4 text-accent" />
              <p className="tnum mt-2 font-mono text-xl font-bold text-ink">{s.value}</p>
              <p className="mt-0.5 text-xs text-ink-subtle">{s.label}</p>
            </>
          );
          const base = "block rounded-lg border border-border bg-surface p-3.5";
          return s.hint ? (
            <Tooltip key={s.label} as="div" label={s.hint} className={cn(base, "cursor-help")}>
              {card}
            </Tooltip>
          ) : (
            <div key={s.label} className={base}>
              {card}
            </div>
          );
        })}
      </div>

      {/* Full season board — this is the "see everything" destination, so no collapsing. */}
      <LeaderboardTable rows={rows} />
    </div>
  );
}
