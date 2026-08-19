-- CS2 UA — EWC winnings reach the season balance, and the bracket pays by round.
-- Run in Supabase → SQL Editor. Requires 0038, 0042, 0046.

-- ---------------------------------------------------------------------------
-- 1. Why the yellow total stopped moving
-- ---------------------------------------------------------------------------
-- `award_predictions` has always credited both columns: an EWC question paid
-- season points *and* event points. The three mechanics added since — bets, the
-- favourite team, the bracket — only ever touched `ewc_points`. So answering a
-- question moved the leaderboard and winning a bet did not, which is not a rule
-- anybody was told and not one that makes sense.
--
-- `points` is a lifetime score: everything that writes it adds, nothing
-- subtracts. That is why a losing bet must not take season points away, and why
-- a winning one adds only what it made *above* the stake. Crediting the gross
-- payout would mint season points out of a player's own event balance, and
-- subtracting on a loss would make the one column that has only ever gone up
-- start going down.

create or replace function public.settle_bets(
  p_question text,
  p_correct  text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  if auth.uid() is not null then
    return 0;
  end if;

  with paid as (
    update public.bets b
       set payout = case
                      when b.option_id = p_correct then
                        floor(
                          b.stake * b.odds *
                          case
                            when pr.streak >= 10 then 2.0
                            when pr.streak >= 5  then 1.5
                            when pr.streak >= 3  then 1.25
                            else 1.0
                          end
                        )::integer
                      else 0
                    end,
           settled_at = now()
      from public.profiles pr
     where b.question_id = p_question
       and b.settled_at is null
       and pr.id = b.user_id
    returning b.user_id, b.payout, b.stake
  ), credited as (
    update public.profiles p
       set ewc_points = p.ewc_points + paid.payout,
           -- Profit only, and never below zero: the season total is a lifetime
           -- score that has never gone down.
           points = p.points + greatest(paid.payout - paid.stake, 0)
      from paid
     where p.id = paid.user_id and paid.payout > 0
    returning 1
  )
  select count(*) into touched from paid;

  return touched;
end;
$$;

revoke execute on function public.settle_bets(text, text)
  from public, anon, authenticated;
grant execute on function public.settle_bets(text, text) to service_role;

-- The favourite team and the bracket carry no stake, so the whole payout is
-- winnings and the whole payout counts.

create or replace function public.pay_favourite_team(
  p_match   text,
  p_slug    text,
  p_team    text,
  p_amount  integer
)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    return;
  end if;
  if p_amount is null or p_amount <= 0 then
    return;
  end if;

  return query
  with winners as (
    insert into public.favourite_payouts (user_id, match_id, amount)
    select f.user_id, p_match, p_amount
      from public.favourite_teams f
     where f.tournament_slug = p_slug
       and f.team_slug = p_team
    on conflict (user_id, match_id) do nothing
    returning user_id
  ), credited as (
    update public.profiles p
       set ewc_points = p.ewc_points + p_amount,
           points     = p.points + p_amount
      from winners w
     where p.id = w.user_id
    returning p.id
  )
  select id from credited;
end;
$$;

revoke execute on function public.pay_favourite_team(text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.pay_favourite_team(text, text, text, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. Scoring the bracket one round at a time
-- ---------------------------------------------------------------------------
-- `score_brackets` demanded the whole tournament at once and stamped
-- `scored_at`, so nothing could be paid until the final was over — a card
-- filled in on day one went eleven days without a single point, which is a long
-- time to remember you entered.
--
-- Rounds are now paid as they finish. `scored_rounds` records which ones a
-- bracket has already been paid for, so pressing the same round twice pays
-- nothing the second time, and the rounds can be settled in any order.

alter table public.bracket_predictions
  add column if not exists scored_rounds text[] not null default '{}';

create or replace function public.score_bracket_round(
  p_slug  text,
  p_round text,        -- 'qf' | 'sf' | 'final' | 'champion'
  p_teams text[]       -- who actually reached it; one element for 'champion'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec     record;
  hit     integer;
  per     integer;
  gained  integer;
  scored  integer := 0;
begin
  if auth.uid() is not null then
    return 0;
  end if;

  per := case p_round
           when 'qf'       then 25
           when 'sf'       then 50
           when 'final'    then 100
           when 'champion' then 300
         end;
  if per is null then
    return 0;
  end if;

  for rec in
    select user_id, picks, points, scored_rounds
      from public.bracket_predictions
     where tournament_slug = p_slug
       and not (p_round = any (scored_rounds))
  loop
    if p_round = 'champion' then
      hit := case
               when (rec.picks ->> 'champion') is not null
                    and (rec.picks ->> 'champion') = any (p_teams) then 1
               else 0
             end;
    else
      select count(*) into hit
        from jsonb_array_elements_text(coalesce(rec.picks -> p_round, '[]'::jsonb)) p
       where p = any (p_teams);
    end if;

    gained := hit * per;

    update public.bracket_predictions
       set points = coalesce(points, 0) + gained,
           scored_rounds = array_append(scored_rounds, p_round),
           -- `scored_at` now means "the last round was paid", which is what the
           -- card reads to stop offering edits.
           scored_at = case when p_round = 'champion' then now() else scored_at end
     where user_id = rec.user_id and tournament_slug = p_slug;

    if gained > 0 then
      update public.profiles
         set ewc_points = ewc_points + gained,
             points     = points + gained
       where id = rec.user_id;
    end if;

    scored := scored + 1;
  end loop;

  return scored;
end;
$$;

revoke execute on function public.score_bracket_round(text, text, text[])
  from public, anon, authenticated;
grant execute on function public.score_bracket_round(text, text, text[])
  to service_role;
