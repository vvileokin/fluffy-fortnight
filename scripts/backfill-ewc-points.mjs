#!/usr/bin/env node
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const URL = get("NEXT_PUBLIC_SUPABASE_URL");
const KEY = get("SUPABASE_SERVICE_ROLE_KEY");

const fetch_api = async (endpoint, opts = {}) => {
  const r = await fetch(`${URL}/rest/v1/${endpoint}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  return r.status === 204 ? { ok: true } : r.json();
};

(async () => {
  // 1. Get all EWC match IDs
  const matches = await fetch_api("matches?tournament_slug=eq.ewc-2026&select=id");
  const ewcMatchIds = new Set(matches.map((m) => m.id));
  console.log(`Found ${ewcMatchIds.size} EWC matches`);

  // 2. Get all resolved questions (with match_id and options)
  const allQuestions = await fetch_api(
    "questions?select=id,match_id,options&status=eq.resolved&limit=1000"
  );
  const ewcQuestions = allQuestions.filter((q) => q.match_id && ewcMatchIds.has(q.match_id));
  console.log(`Found ${ewcQuestions.length} resolved EWC questions`);

  if (ewcQuestions.length === 0) {
    console.log("No resolved EWC questions found");
    process.exit(0);
  }

  // 3. Get correct answers
  const results = await fetch_api(
    `question_results?question_id=in.(${ewcQuestions
      .map((q) => `"${q.id}"`)
      .join(",")})`
  );
  const correctAnswers = new Map(
    results.map((r) => [r.question_id, r.correct_option_id])
  );

  // 4. For each question, award points to correct predictors
  const awards = new Map(); // user_id -> { count, points }

  for (const q of ewcQuestions) {
    const correctId = correctAnswers.get(q.id);
    const opt = Array.isArray(q.options) ? q.options.find((o) => o.id === correctId) : null;
    if (!opt) continue;

    const reward = opt.reward || 0;

    // Get users who predicted this option
    const preds = await fetch_api(
      `predictions?question_id=eq.${q.id}&option_id=eq.${correctId}&select=user_id`
    );
    console.log(
      `  Q ${q.id}: ${preds.length} users awarded +${reward} (${opt.label})`
    );

    for (const p of preds) {
      const key = p.user_id;
      awards.set(key, {
        count: (awards.get(key)?.count || 0) + 1,
        points: (awards.get(key)?.points || 0) + reward,
      });
    }
  }

  console.log(`\nAwarding EWC points to ${awards.size} users`);

  // 5. Update profiles
  let updated = 0;
  for (const [userId, { count, points }] of awards) {
    const res = await fetch_api(`profiles?id=eq.${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ewc_correct: count,
        ewc_points: points,
      }),
    });
    if (res.error) {
      console.error(`  Failed for ${userId}:`, res.error);
    } else {
      updated++;
      console.log(`  ${userId}: +${points} points, +${count} correct`);
    }
  }

  console.log(`\n✓ Updated ${updated} profiles`);
})();
