-- CS2 UA — buy EWC points with season points, five for one.
-- Run in Supabase → SQL Editor. Requires 0048.
--
-- Season points already contain event winnings: since 0048 every EWC payout
-- credits both columns. That makes a naive exchange a printing press — earn EWC,
-- watch it land in gold, spend the gold on more EWC, repeat.
--
-- `ewc_earned_points` closes it. It records how much of the gold a player holds
-- came out of the event, and only the remainder may be exchanged:
--
--     exchangeable = points - ewc_earned_points
--
-- Winning at the event raises both sides of that subtraction by the same
-- amount, so the exchangeable figure cannot be grown by playing the event at
-- all. It grows only from season matches, which is the point: the exchange
-- turns *season* standing into event currency, never event currency into more
-- of itself.

alter table public.profiles
  add column if not exists ewc_earned_points integer not null default 0;

-- ---------------------------------------------------------------------------
-- Seed it from history
-- ---------------------------------------------------------------------------
-- The same four sources that credit gold today: correct EWC answers, bet
-- profit, favourite-team payouts, bracket points.

with q as (
  select q.id, q.match_id, q.options
    from public.questions q
    join public.matches m on m.id = q.match_id
   where m.tournament_slug = 'ewc-2026' or m.is_event
), from_questions as (
  select p.user_id,
         sum(coalesce((o.value ->> 'reward')::integer, 0)) as n
    from public.predictions p
    join q on q.id = p.question_id
    join public.question_results r
      on r.question_id = p.question_id and r.correct_option_id = p.option_id
    cross join lateral jsonb_array_elements(q.options) o
   where o.value ->> 'id' = p.option_id
   group by p.user_id
), from_bets as (
  select user_id, sum(greatest(coalesce(payout, 0) - stake, 0)) as n
    from public.bets where settled_at is not null group by user_id
), from_fav as (
  select user_id, sum(amount) as n from public.favourite_payouts group by user_id
), from_bracket as (
  select user_id, sum(coalesce(points, 0)) as n
    from public.bracket_predictions group by user_id
), total as (
  select user_id, sum(n) as n from (
    select * from from_questions union all
    select * from from_bets      union all
    select * from from_fav       union all
    select * from from_bracket
  ) x group by user_id
)
update public.profiles p
   set ewc_earned_points = least(t.n, p.points)   -- never more gold than exists
  from total t
 where p.id = t.user_id;

-- ---------------------------------------------------------------------------
-- Keep it current
-- ---------------------------------------------------------------------------

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
    update public.profiles p
       set ewc_points        = p.ewc_points + paid.payout,
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

create or replace function public.pay_favourite_team(
  p_match text, p_slug text, p_team text, p_amount integer
)
returns setof uuid
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then return; end if;
  if p_amount is null or p_amount <= 0 then return; end if;

  return query
  with winners as (
    insert into public.favourite_payouts (user_id, match_id, amount)
    select f.user_id, p_match, p_amount
      from public.favourite_teams f
     where f.tournament_slug = p_slug and f.team_slug = p_team
    on conflict (user_id, match_id) do nothing
    returning user_id
  ), credited as (
    update public.profiles p
       set ewc_points        = p.ewc_points + p_amount,
           points            = p.points + p_amount,
           ewc_earned_points = p.ewc_earned_points + p_amount
      from winners w
     where p.id = w.user_id
    returning p.id
  )
  select id from credited;
end;
$$;

revoke execute on function public.pay_favourite_team(text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.pay_favourite_team(text, text, text, integer) to service_role;

-- `award_predictions` credits gold for every tournament, so only its EWC branch
-- counts toward the subtraction.
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
         ewc_earned_points = ewc_earned_points + case when p_columns = 'ewc' then p_reward else 0 end
   where id = any (p_users);

  get diagnostics touched = row_count;
  return touched;
end;
$$;

revoke execute on function public.award_predictions(uuid[], integer, text)
  from public, anon, authenticated;
grant execute on function public.award_predictions(uuid[], integer, text) to service_role;

-- ---------------------------------------------------------------------------
-- The exchange itself
-- ---------------------------------------------------------------------------

create or replace function public.convert_points(p_user uuid, p_gold integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_points integer;
  v_from   integer;
  v_limit  integer;
  v_gain   integer;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  -- Whole EWC points only, so nothing is lost to rounding in either direction.
  if p_gold is null or p_gold < 5 or p_gold % 5 <> 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_amount');
  end if;

  select points, ewc_earned_points into v_points, v_from
    from public.profiles where id = p_user for update;
  if v_points is null then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  v_limit := greatest(v_points - v_from, 0);
  if p_gold > v_limit then
    return jsonb_build_object('ok', false, 'error', 'over_limit', 'limit', v_limit);
  end if;

  v_gain := p_gold / 5;
  update public.profiles
     set points     = points - p_gold,
         ewc_points = ewc_points + v_gain
   where id = p_user;

  return jsonb_build_object('ok', true, 'spent', p_gold, 'gained', v_gain,
                            'limit', v_limit - p_gold);
end;
$$;

revoke execute on function public.convert_points(uuid, integer) from public, anon;
grant execute on function public.convert_points(uuid, integer) to authenticated, service_role;
