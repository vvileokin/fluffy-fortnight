import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/db/paginate";
import { recomputeStreaks } from "@/lib/db/streaks";
import { getTeam } from "@/lib/data";

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
  // The match label also goes into the notification so it names the game,
  // not just the question.
  let isEvent = false;
  let matchLabel = "";
  if (q?.match_id) {
    const { data: match } = await admin
      .from("matches")
      .select("is_event, team_a, team_b, team_a_name, team_b_name")
      .eq("id", q.match_id)
      .maybeSingle();
    isEvent = !!match?.is_event;
    if (match) {
      const teamLabel = (slug: string | null, name: string | null) =>
        name || (slug ? getTeam(slug)?.tag ?? getTeam(slug)?.name ?? slug : "");
      const a = teamLabel(match.team_a, match.team_a_name);
      const b = teamLabel(match.team_b, match.team_b_name);
      if (a && b) matchLabel = `${a} vs ${b}`;
    }
  }
  const prefix = matchLabel ? `${matchLabel} · ` : "";

  // Guard: if already resolved, don't award again.
  const { data: existing } = await admin
    .from("question_results")
    .select("question_id")
    .eq("question_id", question_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyResolved: true, awarded: 0 });
  }

  // Page through predictions — a popular question can exceed PostgREST's
  // 1000-row cap, and a truncated read would silently skip awarding people.
  const { rows: preds, error: predsErr } = await fetchAllRows<{
    user_id: string;
    option_id: string;
  }>((from, to) =>
    admin
      .from("predictions")
      .select("user_id, option_id")
      .eq("question_id", question_id)
      .order("user_id", { ascending: true })
      .range(from, to),
  );
  if (predsErr) {
    return NextResponse.json({ ok: false, error: String(predsErr) }, { status: 500 });
  }

  const userIds = [...new Set(preds.map((p) => p.user_id))];
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
    // Points and correct-counts accrue here; streaks are recomputed below,
    // since a match's questions resolve one at a time and the rule looks at
    // the match as a whole.
    if (won) {
      await admin
        .from("profiles")
        .update({
          points: prof.points + reward,
          correct: prof.correct + 1,
          ...(isEvent
            ? {
                bounty_points: prof.bounty_points + reward,
                bounty_correct: prof.bounty_correct + 1,
              }
            : {}),
        })
        .eq("id", p.user_id);
      awarded++;
    }
    notifs.push({
      user_id: p.user_id,
      kind: "reward",
      title: won
        ? `${prefix}прогноз «${title}» зіграв — +${reward} поінтів`
        : `${prefix}прогноз «${title}» не зіграв`,
    });
  }
  if (notifs.length > 0) await admin.from("notifications").insert(notifs);

  // Record the result only now — awards are done, so this can't lock out a retry.
  await admin.from("question_results").upsert({
    question_id,
    correct_option_id,
    resolved_at: new Date().toISOString(),
  });
  await admin.from("questions").update({ status: "resolved" }).eq("id", question_id);

  // Streaks are replayed after the result is recorded so this question counts.
  await recomputeStreaks(admin, userIds);

  return NextResponse.json({ ok: true, awarded, reward });
}
