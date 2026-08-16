-- CS2 UA — daily login reward, a ten-day ladder.
-- Run in Supabase → SQL Editor.
--
-- Two columns and one function. The columns live on `profiles` rather than in a
-- claims table because only the current streak matters — nothing reads the
-- history of who claimed what on which day, and a row per user per day would be
-- ~450 rows a day for a number we already have.
--
-- Every existing player joins on day 1 the first time they claim: `daily_day`
-- defaults to 0 and `daily_claimed_on` to null, which the function reads as
-- "never claimed" and starts the ladder. Nobody is behind for having signed up
-- before this shipped.

alter table public.profiles
  add column if not exists daily_day        smallint    not null default 0,
  add column if not exists daily_claimed_on date;

-- Same lockdown as every other balance column. A player who could write these
-- could hand themselves day 10 every morning.
create or replace function public.freeze_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_admin := old.is_admin;

  if auth.uid() is not null then
    new.points           := old.points;
    new.bounty_points    := old.bounty_points;
    new.correct          := old.correct;
    new.streak           := old.streak;
    new.ewc_points       := old.ewc_points;
    new.ewc_correct      := old.ewc_correct;
    new.telegram_id      := old.telegram_id;
    new.daily_day        := old.daily_day;
    new.daily_claimed_on := old.daily_claimed_on;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_freeze_admin on public.profiles;
create trigger profiles_freeze_admin
  before update on public.profiles
  for each row execute function public.freeze_profile_admin_flag();

/**
 * Claim today's reward.
 *
 * The ladder is 50, 100, 150, 200, 300, 400, 500, 600, 700, 800 and then wraps
 * back to day 1, so there is always a next day worth returning for.
 *
 * "Today" is Europe/Kyiv, not UTC and not the browser's clock. On UTC the day
 * would roll at 3am local, which is inside the evening a player is actually
 * using the site — someone claiming at 00:30 and again at 03:30 would get two
 * days out of one night. Reading the clock server-side also means a device with
 * its date moved forward gains nothing.
 */
create or replace function public.claim_daily_reward(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rewards constant integer[] := array[50, 100, 150, 200, 300, 400, 500, 600, 700, 800];
  today   date;
  last    date;
  prev    smallint;
  nextday smallint;
  amount  integer;
begin
  -- Service role only. In a user session the freeze trigger above reverts
  -- every column this writes, so the claim would look successful, hand out
  -- nothing, and still burn the day.
  if auth.uid() is not null then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  today := (now() at time zone 'Europe/Kyiv')::date;

  -- The lock. Without it two taps land together, both read the same
  -- `daily_claimed_on`, and both pay out.
  select daily_claimed_on, daily_day into last, prev
    from public.profiles
   where id = p_user
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  if last = today then
    return jsonb_build_object(
      'ok', false, 'error', 'already_claimed', 'day', prev
    );
  end if;

  -- Consecutive day continues the ladder; any gap starts it over. Day 10 wraps
  -- to 1 rather than stalling, so the reward never runs out.
  if last = today - 1 and prev >= 1 and prev < 10 then
    nextday := prev + 1;
  else
    nextday := 1;
  end if;

  amount := rewards[nextday];

  update public.profiles
     set points           = points + amount,
         daily_day        = nextday,
         daily_claimed_on = today
   where id = p_user;

  return jsonb_build_object(
    'ok', true, 'day', nextday, 'amount', amount
  );
end;
$$;

revoke execute on function public.claim_daily_reward(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_daily_reward(uuid) to service_role;
