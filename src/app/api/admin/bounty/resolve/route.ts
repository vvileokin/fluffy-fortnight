import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/db/paginate";
import { bountyStages } from "@/lib/data";

// Score a bounty stage: award its reward (to points + bounty_points) to every
// user who correctly guessed a low seed's actual opponent. Guarded against
// double-awarding via the stage's `resolved` flag.
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { stage_id } = await request.json().catch(() => ({}));
  const meta = bountyStages.find((s) => s.id === stage_id);
  if (!meta) {
    return NextResponse.json({ ok: false, error: "invalid stage" }, { status: 400 });
  }
  const reward = meta.reward;

  const admin = createAdminClient();

  const { data: stage } = await admin
    .from("bounty_stages")
    .select("results, resolved")
    .eq("stage_id", stage_id)
    .maybeSingle();
  if (!stage) {
    return NextResponse.json({ ok: false, error: "Стадію не налаштовано" }, { status: 400 });
  }
  if (stage.resolved) {
    return NextResponse.json({ ok: true, alreadyResolved: true, awarded: 0 });
  }
  const results: Record<string, string> = (stage.results as Record<string, string>) ?? {};
  if (Object.keys(results).length === 0) {
    return NextResponse.json(
      { ok: false, error: "Спершу вкажи фактичні пари" },
      { status: 400 },
    );
  }

  // Page through every pick — a stage easily exceeds PostgREST's 1000-row cap,
  // and a truncated read silently leaves late entrants unscored.
  const { rows: preds, error: picksErr } = await fetchAllRows<{
    user_id: string;
    low_slug: string;
    high_slug: string;
  }>((from, to) =>
    admin
      .from("bounty_picks")
      .select("user_id, low_slug, high_slug")
      .eq("stage_id", stage_id)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (picksErr) {
    return NextResponse.json({ ok: false, error: String(picksErr) }, { status: 500 });
  }

  // Count correctly guessed pairs per user.
  const hits = new Map<string, number>();
  for (const p of preds) {
    if (results[p.low_slug] && results[p.low_slug] === p.high_slug) {
      hits.set(p.user_id, (hits.get(p.user_id) ?? 0) + 1);
    }
  }

  let awarded = 0;
  if (hits.size > 0) {
    const ids = [...hits.keys()];
    const { data: profiles, error: profErr } = await admin
      .from("profiles")
      .select("id, points, bounty_points, correct, bounty_correct")
      .in("id", ids);
    // Bail before marking the stage resolved if a column is missing, so the
    // admin can run the migration and re-resolve without losing the awards.
    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
    }
    const notifs: { user_id: string; kind: string; title: string }[] = [];
    for (const prof of profiles ?? []) {
      const n = hits.get(prof.id) ?? 0;
      if (n <= 0) continue;
      const add = n * reward;
      // Correct pairs count toward points (season + bounty) and the correct
      // tally (season + bounty) — but NOT the streak: streaks are match-only.
      await admin
        .from("profiles")
        .update({
          points: prof.points + add,
          bounty_points: prof.bounty_points + add,
          correct: prof.correct + n,
          bounty_correct: prof.bounty_correct + n,
        })
        .eq("id", prof.id);
      notifs.push({
        user_id: prof.id,
        kind: "reward",
        title: `Bounty «${meta.title}»: +${add} поінтів за ${n} вгаданих пар`,
      });
      awarded++;
    }
    if (notifs.length > 0) await admin.from("notifications").insert(notifs);
  }

  await admin.from("bounty_stages").update({ resolved: true }).eq("stage_id", stage_id);

  return NextResponse.json({ ok: true, awarded, reward });
}
