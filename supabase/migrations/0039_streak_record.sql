-- CS2 UA — the streak record, and the multiplier it feeds.
-- Run in Supabase → SQL Editor.
--
-- Two things land here.
--
-- 1. `best_streak` — the longest run a player has ever put together. The live
--    `streak` column only ever shows the current run, so the moment it breaks
--    the achievement is gone with no trace that it happened. A record is the
--    part worth keeping.
--
--    No separate backfill is needed: `recomputeStreaks` replays a player's
--    whole resolved history from scratch every time it runs, so it derives the
--    record from the same replay that produces the current streak. The
--    /api/admin/streaks/backfill route runs it for everybody once.
--
-- 2. The multiplier ladder is documented here because this is the file that
--    explains the columns it reads. It is applied in the resolve route, not in
--    SQL: rewards are already awarded there per question, and splitting the
--    arithmetic across two languages is how the two drift apart.
--
--      streak >= 3   ×1.25
--      streak >= 5   ×1.5
--      streak >= 10  ×2
--
--    Read from the streak the player *entered* the match on, so the payout is
--    knowable while the match is still open. Mirrored in src/lib/streak.ts.

alter table public.profiles
  add column if not exists best_streak integer not null default 0;

-- A record can never be behind the run that is currently going.
update public.profiles
   set best_streak = streak
 where streak > best_streak;

-- ---------------------------------------------------------------------------
-- The freeze trigger has to cover the new column
-- ---------------------------------------------------------------------------
-- Without this a signed-in user could PATCH their own row and write whatever
-- record they liked — every other score column is already held down here, and
-- an unlisted column is simply writable.

create or replace function public.freeze_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nobody flips the legacy admin flag; admin_users is the source of truth.
  new.is_admin := old.is_admin;

  -- auth.uid() is null when the service role writes (resolve routes, the
  -- giveaway purchase), and set when a signed-in user edits their own row.
  -- Users may change their handle and avatar; everything else is ours.
  if auth.uid() is not null then
    new.points        := old.points;
    new.bounty_points := old.bounty_points;
    new.correct       := old.correct;
    new.streak        := old.streak;
    new.best_streak   := old.best_streak;
    new.ewc_points    := old.ewc_points;
    new.ewc_correct   := old.ewc_correct;
    new.telegram_id   := old.telegram_id;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_freeze_admin on public.profiles;
create trigger profiles_freeze_admin
  before update on public.profiles
  for each row execute function public.freeze_profile_admin_flag();
