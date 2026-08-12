import type { Metadata } from "next";
import { CrownGlyph } from "@/components/layout/NavGlyphs";
import { PageIntro } from "@/components/ui/PageIntro";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { getLeaderboard } from "@/lib/db/leaderboard";

export const metadata: Metadata = { title: "Лідерборд" };

export default async function LeaderboardPage() {
  const rows = await getLeaderboard(1000);

  return (
    <div className="space-y-6">
      <PageIntro
        icon={CrownGlyph}
        title="Сезонний лідерборд"
        subtitle="Сезон 1 · 16 липня – 13 грудня. Рейтинг оновлюється після кожного розрахунку."
      />

      {/* The four summary tiles are gone: every number they held is already on
          the board itself, on the player's own highlighted row, and repeating
          it above the podium just pushed the ranking below the fold. The
          profile is where a player reads their own totals. */}
      <LeaderboardTable rows={rows} podium />
    </div>
  );
}
