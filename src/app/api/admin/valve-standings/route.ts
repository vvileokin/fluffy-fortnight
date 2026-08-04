import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { runValveStandingsSync } from "@/lib/valve-standings-sync";

/** How many teams currently carry a rank, and when it was last refreshed. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { count } = await admin
    .from("team_ranks")
    .select("slug", { count: "exact", head: true });
  const { data: latest } = await admin
    .from("team_ranks")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ ok: true, count: count ?? 0, updatedAt: latest?.updated_at ?? null });
}

/** Pull Valve's latest Regional Standings and stamp ranks onto matched teams. */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await runValveStandingsSync();
    if (!r.found) {
      return NextResponse.json(
        { ok: false, error: "Не вдалося знайти таблицю рейтингу Valve" },
        { status: 502 },
      );
    }
    await logAdmin(
      "import",
      `Синхронізував рейтинг Valve: ${r.globalMatched}/${r.globalTotal} команд у світовому, ${r.regionMatched}/${r.regionTotal} у регіональних`,
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Помилка синхронізації" },
      { status: 502 },
    );
  }
}

export const dynamic = "force-dynamic";
