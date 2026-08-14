import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
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

  // Event matches also count toward that event's own points column. Which
  // column is decided by the tournament, not by the `is_event` flag alone:
  // BLAST Bounty is finished and its table is a historical record, so EWC
  // results must not land in `bounty_points` and quietly inflate it.
  // The match label also goes into the notification so it names the game,
  // not just the question.
  let eventColumns: "bounty" | "ewc" | null = null;
  let matchLabel = "";
  if (q?.match_id) {
    const { data: match } = await admin
      .from("matches")
      .select("is_event, tournament_slug, team_a, team_b, team_a_name, team_b_name")
      .eq("id", q.match_id)
      .maybeSingle();
    // The tournament decides the column, not the `is_event` checkbox.
    //
    // This used to read the flag first and only then look at the slug, so an
    // EWC match whose box wasn't ticked scored as an ordinary match: yellow
    // points and streak went out, `ewc_points` silently didn't. The flag is a
    // display hint that an admin sets by hand and forgets; the slug is a fact
    // about which tournament the match belongs to. Read the fact.
    if (match?.tournament_slug === "ewc-2026") {
      eventColumns = "ewc";
    } else if (match?.is_event) {
      eventColumns = "bounty";
    }
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
    .select(
      "id, points, bounty_points, correct, streak, bounty_correct, bounty_streak, ewc_points, ewc_correct",
    )
    .in("id", userIds);
  // Fail before recording the result so a missing column (migration not applied)
  // stays retryable instead of locking the question with no awards.
  if (profErr) {
    return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
  }
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Winners are paid in one atomic statement rather than a read-add-write per
  // player. The old shape read every profile up front and wrote back
  // `read value + reward`, so two questions resolved moments apart both
  // started from the same totals and the second write erased the first —
  // players who won both were credited once. `award_predictions` increments
  // the columns in place, under Postgres' own row locks.
  const winners = (preds ?? [])
    .filter((p) => p.option_id === correct_option_id && byId.has(p.user_id))
    .map((p) => p.user_id);

  let awarded = 0;
  if (winners.length > 0) {
    const { data: touched, error: awardErr } = await admin.rpc("award_predictions", {
      p_users: winners,
      p_reward: reward,
      p_columns: eventColumns,
    });
    if (awardErr) {
      // The deploy can land before migration 0036 is run, and resolving a match
      // must not be blocked in that window. Fall back to the old per-player
      // write — it is what shipped before, races and all, and one match settled
      // slightly wrong beats a settle button that errors. Anything else is a
      // real failure: return before recording, so the question stays retryable.
      const missing = awardErr.code === "PGRST202" || awardErr.code === "42883";
      if (!missing) {
        return NextResponse.json({ ok: false, error: awardErr.message }, { status: 500 });
      }
      console.error("[resolve] award_predictions missing — run migration 0036");
      for (const id of winners) {
        const prof = byId.get(id)!;
        await admin
          .from("profiles")
          .update({
            points: prof.points + reward,
            correct: prof.correct + 1,
            ...(eventColumns === "bounty"
              ? {
                  bounty_points: prof.bounty_points + reward,
                  bounty_correct: prof.bounty_correct + 1,
                }
              : {}),
            ...(eventColumns === "ewc"
              ? {
                  ewc_points: (prof.ewc_points ?? 0) + reward,
                  ewc_correct: (prof.ewc_correct ?? 0) + 1,
                }
              : {}),
          })
          .eq("id", id);
      }
      awarded = winners.length;
    } else {
      awarded = Number(touched ?? 0);
    }
    if (awarded !== winners.length) {
      console.error(
        `[resolve] ${question_id}: paid ${awarded} of ${winners.length} winners`,
      );
    }
  }

  const notifs = (preds ?? [])
    .filter((p) => byId.has(p.user_id))
    .map((p) => {
      const won = p.option_id === correct_option_id;
      return {
        user_id: p.user_id,
        kind: "reward",
        title: won
          ? `${prefix}прогноз «${title}» зіграв — +${reward} поінтів`
          : `${prefix}прогноз «${title}» не зіграв`,
      };
    });
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

  await logAdmin("resolve", `Розрахував питання ${question_id}: нараховано ${awarded} гравцям (+${reward})`);
  return NextResponse.json({ ok: true, awarded, reward });
}
