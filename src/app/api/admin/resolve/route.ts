import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/db/paginate";
import { recomputeStreaks } from "@/lib/db/streaks";
import { applyStreak } from "@/lib/streak";
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

  // Paged and chunked, for the same reason `predictions` is paged above.
  // `predictions` could already exceed PostgREST's 1000-row cap — that is why
  // it pages — but this read did not, so on a question that popular the map
  // came back truncated and every player past the cap was dropped from both
  // the award and the notification, with nothing to show for it.
  const PROFILE_COLUMNS =
    "id, points, bounty_points, correct, streak, bounty_correct, bounty_streak, ewc_points, ewc_correct";
  type ProfileRow = {
    id: string;
    points: number;
    bounty_points: number;
    correct: number;
    /** The run they came in on — this is what sets their multiplier. */
    streak: number;
    bounty_correct: number;
    ewc_points: number | null;
    ewc_correct: number | null;
  };
  const profiles: ProfileRow[] = [];
  const CHUNK = 500;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const slice = userIds.slice(i, i + CHUNK);
    const { rows, error } = await fetchAllRows<ProfileRow>((from, to) =>
      admin
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .in("id", slice)
        .order("id", { ascending: true })
        .range(from, to),
    );
    // Fail before recording the result so a missing column (migration not
    // applied) stays retryable instead of locking the question with no awards.
    if (error) {
      return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
    profiles.push(...rows);
  }
  const byId = new Map(profiles.map((p) => [p.id, p]));

  // Winners are paid in one atomic statement rather than a read-add-write per
  // player. The old shape read every profile up front and wrote back
  // `read value + reward`, so two questions resolved moments apart both
  // started from the same totals and the second write erased the first —
  // players who won both were credited once. `award_predictions` increments
  // the columns in place, under Postgres' own row locks.
  const winners = (preds ?? [])
    .filter((p) => p.option_id === correct_option_id && byId.has(p.user_id))
    .map((p) => p.user_id);

  // Winners are bucketed by the multiplier they carry, so each bucket is still
  // one atomic statement. `award_predictions` pays a single figure to a whole
  // list, and a streak bonus is per-player — grouping is what lets both be true
  // at once, and there are only ever three or four distinct rates.
  const byRate = new Map<number, string[]>();
  for (const id of winners) {
    const paid = applyStreak(reward, byId.get(id)?.streak ?? 0);
    const list = byRate.get(paid);
    if (list) list.push(id);
    else byRate.set(paid, [id]);
  }

  let awarded = 0;
  for (const [paid, group] of byRate) {
    const { data: touched, error: awardErr } = await admin.rpc("award_predictions", {
      p_users: group,
      p_reward: paid,
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
      for (const id of group) {
        const prof = byId.get(id)!;
        await admin
          .from("profiles")
          .update({
            points: prof.points + paid,
            correct: prof.correct + 1,
            ...(eventColumns === "bounty"
              ? {
                  bounty_points: prof.bounty_points + paid,
                  bounty_correct: prof.bounty_correct + 1,
                }
              : {}),
            ...(eventColumns === "ewc"
              ? {
                  ewc_points: (prof.ewc_points ?? 0) + paid,
                  ewc_correct: (prof.ewc_correct ?? 0) + 1,
                }
              : {}),
          })
          .eq("id", id);
      }
      awarded += group.length;
    } else {
      awarded += Number(touched ?? 0);
    }
  }
  if (winners.length > 0 && awarded !== winners.length) {
    console.error(`[resolve] ${question_id}: paid ${awarded} of ${winners.length} winners`);
  }

  // Bets settle alongside the flat awards. `settle_bets` pays stake × the odds
  // the slip was accepted at, and skips anything already settled — so a
  // re-resolved question tops up what it missed rather than paying twice. A
  // question with no bets on it simply touches nothing.
  const { error: betErr } = await admin.rpc("settle_bets", {
    p_question: question_id,
    p_correct: correct_option_id,
  });
  if (betErr) {
    // Migration 0040 may not have run yet, and that must not block settling the
    // ordinary predictions this route exists for.
    const missing = betErr.code === "PGRST202" || betErr.code === "42883";
    if (!missing) {
      return NextResponse.json({ ok: false, error: betErr.message }, { status: 500 });
    }
    console.error("[resolve] settle_bets missing — run migration 0040");
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

  // Bets get their own line, and it names the stake. A player who put 300 on a
  // 3.40 wants to read back what they risked and what came of it — "не зіграла"
  // on its own tells them nothing they didn't already fear, and the balance
  // moved by an amount no other message accounts for.
  const { data: settled } = await admin
    .from("bets")
    .select("user_id, stake, payout")
    .eq("question_id", question_id);
  for (const b of (settled ?? []) as { user_id: string; stake: number; payout: number | null }[]) {
    const won = (b.payout ?? 0) > 0;
    notifs.push({
      user_id: b.user_id,
      kind: "reward",
      title: won
        ? `${prefix}ставка ${b.stake} на «${title}» зіграла — +${b.payout} EWC`
        : `${prefix}ставка ${b.stake} на «${title}» не зіграла`,
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

  await logAdmin("resolve", `Розрахував питання ${question_id}: нараховано ${awarded} гравцям (+${reward})`);
  return NextResponse.json({ ok: true, awarded, reward });
}
