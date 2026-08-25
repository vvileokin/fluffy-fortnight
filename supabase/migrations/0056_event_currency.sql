-- CS2 UA — make the event currency the one the event actually uses.
-- Run in Supabase → SQL Editor. Requires 0052.
--
-- `event_points` was added for Porto and then nothing filled it. The top bar
-- reads it, the Porto leaderboard ranks by it — and every path that pays or
-- takes points was still writing `ewc_points`:
--
--   place_bet / cancel_bet / settle_bets   spent and paid the World Cup wallet
--   award_predictions                      knew only 'ewc' and 'bounty', so a
--                                          correct Porto prediction credited
--                                          season gold and nothing else
--
-- A player would have seen 0 in the bar, been refused a bet they could afford,
-- and watched an event leaderboard that could never fill.
--
-- So: bets move to `event_points`, and `award_predictions` learns 'event'.
-- What is left of `ewc_points` stays exactly where it is — 218 755 across 166
-- accounts — because that is now the giveaway wallet and nothing else.

-- ---------------------------------------------------------------------------
-- Betting spends the running event's balance
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
     set event_points = event_points - p_stake
   where id = p_user;

  return jsonb_build_object('ok', true, 'odds', v_odds,
                            'balance', v_balance - p_stake);
end;
$$;

revoke execute on function public.place_bet(uuid, text, text, integer) from public, anon;
grant execute on function public.place_bet(uuid, text, text, integer) to authenticated, service_role;

create or replace function public.cancel_bet(p_user uuid, p_question text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_stake  integer;
  v_status text;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select m.status into v_status
    from public.questions q join public.matches m on m.id = q.match_id
   where q.id = p_question;
  if v_status is distinct from 'upcoming' then
    return jsonb_build_object('ok', false, 'error', 'started');
  end if;

  delete from public.bets
   where user_id = p_user and question_id = p_question and settled_at is null
  returning stake into v_stake;
  if v_stake is null then
    return jsonb_build_object('ok', false, 'error', 'no_bet');
  end if;

  update public.profiles
     set event_points = event_points + v_stake
   where id = p_user;

  return jsonb_build_object('ok', true, 'refunded', v_stake);
end;
$$;

revoke execute on function public.cancel_bet(uuid, text) from public, anon;
grant execute on function public.cancel_bet(uuid, text) to authenticated, service_role;

create or replace function public.settle_bets(p_question text, p_correct text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare touched integer;
begin
  if auth.uid() is not null then return 0; end if;

  with paid as (
    update public.bets b
       set payout = case when b.option_id = p_correct
                         then floor(b.stake * b.odds *
                                case when pr.streak >= 10 then 2.0
                                     when pr.streak >= 5  then 1.5
                                     when pr.streak >= 3  then 1.25
                                     else 1.0 end)::integer
                         else 0 end,
           settled_at = now()
      from public.profiles pr
     where b.question_id = p_question and b.settled_at is null and pr.id = b.user_id
    returning b.user_id, b.payout, b.stake
  ), credited as (
    -- The stake left `event_points` when the bet was placed, so the whole
    -- payout comes back to it. Season gold takes the profit only, which is the
    -- part that was actually earned rather than returned.
    update public.profiles p
       set event_points      = p.event_points + paid.payout,
           points            = p.points + greatest(paid.payout - paid.stake, 0),
           ewc_earned_points = p.ewc_earned_points + greatest(paid.payout - paid.stake, 0)
      from paid
     where p.id = paid.user_id and paid.payout > 0
    returning 1
  )
  select count(*) into touched from paid;
  return touched;
end;
$$;

revoke execute on function public.settle_bets(text, text) from public, anon, authenticated;
grant execute on function public.settle_bets(text, text) to service_role;

create or replace function public.refund_bets(p_question text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare touched integer;
begin
  if auth.uid() is not null then return 0; end if;
  with back as (
    delete from public.bets b
     where b.question_id = p_question and b.settled_at is null
    returning b.user_id, b.stake
  ), credited as (
    update public.profiles p
       set event_points = p.event_points + back.stake
      from back where p.id = back.user_id
    returning 1
  )
  select count(*) into touched from back;
  return touched;
end;
$$;

revoke execute on function public.refund_bets(text) from public, anon, authenticated;
grant execute on function public.refund_bets(text) to service_role;

-- ---------------------------------------------------------------------------
-- Correct predictions pay the event
-- ---------------------------------------------------------------------------
-- A fourth branch, not a replacement: 'ewc' and 'bounty' still write the
-- columns their finished events are ranked on, so those boards stay the
-- historical records they are.

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
