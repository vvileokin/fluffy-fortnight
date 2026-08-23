-- CS2 UA — the bracket pays like everything else pays.
-- Run in Supabase → SQL Editor. Requires 0049 and 0050.
--
-- Two faults, one function.
--
-- 1. `ewc_earned_points` was never touched here. 0050 introduced it to close the
--    exchange loop — event winnings sit in gold, so gold earned at the event
--    must not be exchangeable back into EWC — and it wired up bets, favourite
--    teams and questions. The bracket predates it and was missed, so every
--    point the bracket paid arrived in gold unmarked and could be run through
--    the 5:1 exchange. 13 175 points' worth, across 52 brackets.
--
-- 2. The function returned a count of brackets *visited*, which the route then
--    used to decide who to notify. Everyone was visited every round, including
--    the players who named none of the teams that went through, so all 52 were
--    told the round had been scored and shown their running total. A player who
--    earned nothing read "разом 275 EWC" against a balance of 100 and concluded
--    the payout had failed. It returns per-player gains now, so the message can
--    say what the round actually paid and go only to the people it paid.

drop function if exists public.score_bracket_round(text, text, text[]);

create or replace function public.score_bracket_round(
  p_slug  text,
  p_round text,        -- 'qf' | 'sf' | 'final' | 'champion'
  p_teams text[]       -- however many are known so far
)
returns table (user_id uuid, gained integer, total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec     record;
  per     integer;
  slug    text;
  tag     text;
  won     integer;
  fresh   text[];
  after   integer;
begin
  if auth.uid() is not null then
    return;
  end if;

  per := case p_round
           when 'qf'       then 25
           when 'sf'       then 50
           when 'final'    then 100
           when 'champion' then 300
         end;
  if per is null or p_teams is null or array_length(p_teams, 1) is null then
    return;
  end if;

  for rec in
    select bp.user_id, bp.picks, coalesce(bp.points, 0) as points, bp.scored_rounds
      from public.bracket_predictions bp
     where bp.tournament_slug = p_slug
  loop
    won   := 0;
    fresh := '{}';

    foreach slug in array p_teams loop
      tag := p_round || ':' || slug;
      -- Already settled for this player and this team.
      continue when tag = any (rec.scored_rounds);

      -- Did they name this team in this round?
      if p_round = 'champion' then
        if (rec.picks ->> 'champion') = slug then
          won := won + per;
        end if;
      elsif exists (
        select 1
          from jsonb_array_elements_text(coalesce(rec.picks -> p_round, '[]'::jsonb)) p
         where p = slug
      ) then
        won := won + per;
      end if;

      -- Recorded either way: a team the player missed is still settled for
      -- them, or the next press would look at it again.
      fresh := array_append(fresh, tag);
    end loop;

    if array_length(fresh, 1) is null then
      continue;
    end if;

    update public.bracket_predictions bp
       set points = coalesce(bp.points, 0) + won,
           scored_rounds = bp.scored_rounds || fresh,
           scored_at = case when p_round = 'champion' then now() else bp.scored_at end
     where bp.user_id = rec.user_id and bp.tournament_slug = p_slug
    returning bp.points into after;

    -- `ewc_earned_points` rises with the other two, so the exchange sees this
    -- as event money and refuses to sell it back.
    if won > 0 then
      update public.profiles p
         set ewc_points        = p.ewc_points + won,
             points            = p.points + won,
             ewc_earned_points = p.ewc_earned_points + won
       where p.id = rec.user_id;

      user_id := rec.user_id;
      gained  := won;
      total   := after;
      return next;
    end if;
  end loop;
end;
$$;

revoke execute on function public.score_bracket_round(text, text, text[])
  from public, anon, authenticated;
grant execute on function public.score_bracket_round(text, text, text[])
  to service_role;

-- ---------------------------------------------------------------------------
-- Mark what has already been paid
-- ---------------------------------------------------------------------------
-- 0050 seeded `ewc_earned_points` from the bracket totals as they stood, which
-- was the quarter-finals and nothing else. Everything the bracket has paid
-- since is unmarked.
--
-- This recomputes the figure from the four ledgers rather than adding a delta
-- to it. A delta would double if this block were ever pasted twice; the whole
-- sum is the same answer every time, and it repairs any earlier drift on the
-- way past. It is 0050's own seed query with nothing changed but the comment.

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
