import type { Metadata } from "next";
import { Crown, TrendingUp, Target, Flame } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { getLeaderboard } from "@/lib/db/leaderboard";
import { formatInt } from "@/lib/utils";

export const metadata: Metadata = { title: "Лідерборд" };

export default async function LeaderboardPage() {
  const rows = await getLeaderboard(100);
  const me = rows.find((r) => r.isYou);

  const stats = [
    { icon: Crown, label: "Твоє місце", value: me ? `#${me.rank}` : "—" },
    { icon: Target, label: "Поінтів у сезоні", value: me ? formatInt(me.points) : "0" },
    { icon: TrendingUp, label: "Вірних прогнозів", value: me ? String(me.correct) : "0" },
    { icon: Flame, label: "Серія", value: me ? String(me.streak) : "0" },
  ];

  return (
    <div className="space-y-6">
      <PageIntro
        icon={Crown}
        title="Сезонний лідерборд"
        subtitle="Сезон 3 · 16 липня – 13 грудня. Рейтинг оновлюється після кожного розрахунку."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface p-3.5">
            <s.icon className="size-4 text-accent" />
            <p className="tnum mt-2 font-mono text-xl font-bold text-ink">{s.value}</p>
            <p className="mt-0.5 text-xs text-ink-subtle">{s.label}</p>
          </div>
        ))}
      </div>

      <LeaderboardTable rows={rows} />
    </div>
  );
}
