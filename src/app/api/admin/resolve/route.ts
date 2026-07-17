import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type OptionRow = { id: string; reward: number };

// Resolve a question: record the winning option and award points to users who
// picked it. Guarded so a question can't be awarded twice.
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { question_id, correct_option_id } = await request.json().catch(() => ({}));
  if (!question_id || !correct_option_id) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: q } = await admin
    .from("questions")
    .select("title, options, match_id")
    .eq("id", question_id)
    .maybeSingle();
  const title = q?.title ? String(q.title) : "Прогноз";
  const options: OptionRow[] = Array.isArray(q?.options) ? q!.options : [];
  const reward = options.find((o) => o.id === correct_option_id)?.reward ?? 0;

  // Predictions on BLAST event matches also count toward bounty points.
  let isEvent = false;
  if (q?.match_id) {
    const { data: match } = await admin
      .from("matches")
      .select("is_event")
      .eq("id", q.match_id)
      .maybeSingle();
    isEvent = !!match?.is_event;
  }

  // Guard: if already resolved, don't award again.
  const { data: existing } = await admin
    .from("question_results")
    .select("question_id")
    .eq("question_id", question_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyResolved: true, awarded: 0 });
  }

  const { data: preds } = await admin
    .from("predictions")
    .select("user_id, option_id")
    .eq("question_id", question_id);

  const userIds = [...new Set((preds ?? []).map((p) => p.user_id))];
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("id, points, bounty_points, correct, streak, bounty_correct, bounty_streak")
    .in("id", userIds);
  // Fail before recording the result so a missing column (migration not applied)
  // stays retryable instead of locking the question with no awards.
  if (profErr) {
    return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
  }
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  let awarded = 0;
  const notifs: { user_id: string; kind: string; title: string }[] = [];
  for (const p of preds ?? []) {
    const prof = byId.get(p.user_id);
    if (!prof) continue;
    const won = p.option_id === correct_option_id;
    // Match predictions drive both the general and (for BLAST) the bounty
    // streak — a miss resets it.
    const next = won
      ? {
          points: prof.points + reward,
          correct: prof.correct + 1,
          streak: prof.streak + 1,
          ...(isEvent
            ? {
                bounty_points: prof.bounty_points + reward,
                bounty_correct: prof.bounty_correct + 1,
                bounty_streak: prof.bounty_streak + 1,
              }
            : {}),
        }
      : { streak: 0, ...(isEvent ? { bounty_streak: 0 } : {}) };
    await admin.from("profiles").update(next).eq("id", p.user_id);
    notifs.push({
      user_id: p.user_id,
      kind: "reward",
      title: won ? `Прогноз «${title}» зіграв — +${reward} поінтів` : `Прогноз «${title}» не зіграв`,
    });
    if (won) awarded++;
  }
  if (notifs.length > 0) await admin.from("notifications").insert(notifs);

  // Record the result only now — awards are done, so this can't lock out a retry.
  await admin.from("question_results").upsert({
    question_id,
    correct_option_id,
    resolved_at: new Date().toISOString(),
  });
  await admin.from("questions").update({ status: "resolved" }).eq("id", question_id);

  return NextResponse.json({ ok: true, awarded, reward });
}
