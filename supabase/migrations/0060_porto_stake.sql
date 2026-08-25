-- CS2 UA — 500 to start Porto with, and the rule that keeps it from being free.
-- Run in Supabase → SQL Editor. Requires 0052.
--
-- Everyone gets the same 500 so the event is a contest of reading the game and
-- not of what anyone brought with them. But a grant that converts to season
-- gold at the end is 277 000 gold minted for logging in, so the grant is
-- **not convertible**: what reaches the season table is what you finished with
-- *above* it.
--
--     season gold += greatest(event_points - 500, 0)
--
-- Do nothing and it pays nothing. Turn 500 into 1 200 and 700 is yours. Lose it
-- and you are where you started, which is the point of a stake.
--
-- The board follows the same logic. Listing 556 accounts holding an identical
-- 500 is not a leaderboard, it is a register — so a player appears on it when
-- they first do something, and `event_joined_at` is what records that.

alter table public.profiles
  add column if not exists event_joined_at timestamptz;

comment on column public.profiles.event_joined_at is
  'First real action at the running event — a bet, a duel, or a scored
   prediction. Absent means the starting stake is untouched and the player is
   not on the board.';

-- The starting stake, once, to everyone who exists.
update public.profiles set event_points = 500 where event_points = 0;

-- And to anyone who signs up while the event runs. Reset to 0 when it ends.
alter table public.profiles alter column event_points set default 500;

-- ---------------------------------------------------------------------------
-- Turning up
-- ---------------------------------------------------------------------------
-- Called from every path that spends or earns. Idempotent by construction: it
-- only writes when the column is still empty, so the first action stamps it and
-- the hundredth costs a no-op.

create or replace function public.event_join(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set event_joined_at = now()
   where id = p_user and event_joined_at is null;
$$;

revoke execute on function public.event_join(uuid) from public, anon, authenticated;
grant execute on function public.event_join(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Wiring it into the paths that count as turning up
-- ---------------------------------------------------------------------------

create or replace function public.place_bet(
  p_user uuid, p_question text, p_option text, p_stake integer
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_odds    numeric;
  v_balance integer;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_stake is null or p_stake < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_stake');
  end if;

  select (o ->> 'odds')::numeric into v_odds
    from public.questions q,
         lateral jsonb_array_elements(q.options) o
   where q.id = p_question and o ->> 'id' = p_option;
  if v_odds is null or v_odds < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_odds');
  end if;

  select event_points into v_balance
    from public.profiles where id = p_user for update;
  if v_balance is null or v_balance < p_stake then
    return jsonb_build_object('ok', false, 'error', 'insufficient');
  end if;

  begin
    insert into public.bets (user_id, question_id, option_id, stake, odds)
    values (p_user, p_question, p_option, p_stake, v_odds);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'already_placed');
  end;

  update public.profiles
     set event_points = event_points - p_stake,
         event_joined_at = coalesce(event_joined_at, now())
   where id = p_user;

  return jsonb_build_object('ok', true, 'odds', v_odds,
                            'balance', v_balance - p_stake);
end;
$$;

revoke execute on function public.place_bet(uuid, text, text, integer) from public, anon;
grant execute on function public.place_bet(uuid, text, text, integer) to authenticated, service_role;

-- A duel is the other way to put the stake at risk.
create or replace function public.duel_join_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set event_joined_at = coalesce(event_joined_at, now())
   where id in (new.challenger, new.opponent);
  return new;
end;
$$;

drop trigger if exists duels_join on public.duels;
create trigger duels_join
  after insert or update of opponent on public.duels
  for each row execute function public.duel_join_stamp();

revoke execute on function public.duel_join_stamp() from public, anon, authenticated;

-- Earning counts too. Excluding it would drop the sharpest predictors off the
-- board for not gambling, which is the opposite of what the board is for.
create or replace function public.award_predictions(
  p_users uuid[], p_reward integer, p_columns text default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare touched integer;
begin
  if auth.uid() is not null then return 0; end if;

  update public.profiles
     set points            = points  + p_reward,
         correct           = correct + 1,
         bounty_points     = bounty_points  + case when p_columns = 'bounty' then p_reward else 0 end,
         bounty_correct    = bounty_correct + case when p_columns = 'bounty' then 1 else 0 end,
         ewc_points        = ewc_points     + case when p_columns = 'ewc' then p_reward else 0 end,
         ewc_correct       = ewc_correct    + case when p_columns = 'ewc' then 1 else 0 end,
         event_points      = event_points   + case when p_columns = 'event' then p_reward else 0 end,
         event_joined_at   = case when p_columns = 'event'
                                  then coalesce(event_joined_at, now())
                                  else event_joined_at end,
         ewc_earned_points = ewc_earned_points
                             + case when p_columns in ('ewc', 'event') then p_reward else 0 end
   where id = any (p_users);

  get diagnostics touched = row_count;
  return touched;
end;
$$;

revoke execute on function public.award_predictions(uuid[], integer, text)
  from public, anon, authenticated;
grant execute on function public.award_predictions(uuid[], integer, text) to service_role;

-- ---------------------------------------------------------------------------
-- Closing the event out
-- ---------------------------------------------------------------------------
-- Run once, when the tournament ends. Everything above the stake becomes season
-- gold; the stake itself does not, and neither does a balance that never moved.
-- Idempotent: it only pays accounts that turned up, and it clears the event
-- columns as it goes, so a second run finds nothing left to pay.

create or replace function public.settle_event_to_season(p_grant integer default 500)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare touched integer;
begin
  if auth.uid() is not null then return 0; end if;

  with paid as (
    update public.profiles p
       set points = p.points + greatest(p.event_points - p_grant, 0),
           event_points = 0,
           event_joined_at = null
     where p.event_joined_at is not null
    returning 1
  )
  select count(*) into touched from paid;

  -- Anyone who never played simply loses the untouched stake. It was never
  -- theirs to keep — it was a table stake for a game they did not sit down to.
  update public.profiles set event_points = 0 where event_joined_at is null;

  return touched;
end;
$$;

revoke execute on function public.settle_event_to_season(integer)
  from public, anon, authenticated;
grant execute on function public.settle_event_to_season(integer) to service_role;
