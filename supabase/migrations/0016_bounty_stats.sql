-- CS2 UA — bounty-only stats so the event leaderboard can show correct/streak
-- for bounty activity alone. Run in Supabase → SQL Editor.
--   bounty_correct: correct BLAST match predictions + correct draft pairs
--   bounty_streak : streak from BLAST match predictions only (pairs never count)

alter table public.profiles
  add column if not exists bounty_correct integer not null default 0,
  add column if not exists bounty_streak  integer not null default 0;

-- Backfill bounty_correct from pairs already guessed in resolved stages, so the
-- board is right immediately (pairs never feed the streak, so bounty_streak
-- stays at its default). Only touches rows still at 0 to avoid clobbering any
-- manual fix. Safe to run more than once.
with pair_hits as (
  select bp.user_id, count(*)::int as n
  from public.bounty_picks bp
  join public.bounty_stages bs
    on bs.stage_id = bp.stage_id
   and bs.resolved = true
   and bs.results ->> bp.low_slug = bp.high_slug
  group by bp.user_id
)
update public.profiles p
   set bounty_correct = ph.n
  from pair_hits ph
 where ph.user_id = p.id
   and p.bounty_correct = 0;
