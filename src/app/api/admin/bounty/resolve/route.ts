import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const { data: preds } = await admin
    .from("bounty_picks")
    .select("user_id, low_slug, high_slug")
    .eq("stage_id", stage_id);

  // points earned per user = (# correctly guessed pairs) * reward
  const earned = new Map<string, number>();
  for (const p of preds ?? []) {
    if (results[p.low_slug] && results[p.low_slug] === p.high_slug) {
      earned.set(p.user_id, (earned.get(p.user_id) ?? 0) + reward);
    }
  }

  let awarded = 0;
  if (earned.size > 0) {
    const ids = [...earned.keys()];
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, points, bounty_points")
      .in("id", ids);
    const notifs: { user_id: string; kind: string; title: string }[] = [];
    for (const prof of profiles ?? []) {
      const add = earned.get(prof.id) ?? 0;
      if (add <= 0) continue;
      await admin
        .from("profiles")
        .update({ points: prof.points + add, bounty_points: prof.bounty_points + add })
        .eq("id", prof.id);
      notifs.push({
        user_id: prof.id,
        kind: "reward",
        title: `Bounty «${meta.title}»: +${add} поінтів за вгадані пари`,
      });
      awarded++;
    }
    if (notifs.length > 0) await admin.from("notifications").insert(notifs);
  }

  await admin.from("bounty_stages").update({ resolved: true }).eq("stage_id", stage_id);

  return NextResponse.json({ ok: true, awarded, reward });
}
