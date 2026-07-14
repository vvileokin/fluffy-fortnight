import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuestion } from "@/lib/data";

// Resolve a question: record the winning option and award points to users who
// picked it. Guarded so a question can't be awarded twice.
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { question_id, correct_option_id } = await request.json().catch(() => ({}));
  const q = getQuestion(String(question_id ?? ""));
  if (!q || !correct_option_id) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const reward = q.options.find((o) => o.id === correct_option_id)?.reward ?? 0;

  const admin = createAdminClient();

  // Guard: if already resolved, don't award again.
  const { data: existing } = await admin
    .from("question_results")
    .select("question_id")
    .eq("question_id", question_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyResolved: true, awarded: 0 });
  }

  await admin.from("question_results").upsert({
    question_id,
    correct_option_id,
    resolved_at: new Date().toISOString(),
  });

  const { data: preds } = await admin
    .from("predictions")
    .select("user_id, option_id")
    .eq("question_id", question_id);
  if (!preds || preds.length === 0) {
    return NextResponse.json({ ok: true, awarded: 0 });
  }

  const userIds = [...new Set(preds.map((p) => p.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, points, correct, streak")
    .in("id", userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  let awarded = 0;
  for (const p of preds) {
    const prof = byId.get(p.user_id);
    if (!prof) continue;
    const won = p.option_id === correct_option_id;
    const next = won
      ? { points: prof.points + reward, correct: prof.correct + 1, streak: prof.streak + 1 }
      : { streak: 0 };
    await admin.from("profiles").update(next).eq("id", p.user_id);
    if (won) awarded++;
  }

  return NextResponse.json({ ok: true, awarded, reward });
}
