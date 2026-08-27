-- CS2 UA — плаваючі коефіцієнти вмикаються самі, і стартова лінія не зникає.
-- Run in Supabase → SQL Editor. Requires 0064.
--
-- Two ways the feature quietly stopped applying.
--
-- 0064 switched it on for the questions that were open when it ran, and set the
-- column's default to false. Every question written afterwards was born with
-- fixed prices — which is how the whole of group B, four fixtures and a hundred
-- and sixty bets, ended up on a line that could not move. A feature you have to
-- remember to enable is a feature that will be forgotten, so the rule is now
-- stated once here: a question that takes stakes has floating odds. Betting only
-- exists on the running event, so there is nothing else this could catch.
--
-- And the opening line was being erased. `open` lives inside the options array,
-- and the admin form rewrites that array wholesale from its own fields — so
-- saving a question mid-market dropped the anchor, and `recompute_odds` fell
-- back to the *current* price as the opening one. Every live question had lost
-- it that way. The anchor is now carried across an update by id, so an edit can
-- change a label or a reward without silently re-founding the market.

create or replace function public.question_live_odds_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Turning betting on, whether at insert or later, brings floating with it.
  -- Turning betting off leaves the flag alone: the question keeps its history.
  if new.betting is true and (tg_op = 'INSERT' or coalesce(old.betting, false) is false) then
    new.live_odds := true;
  end if;
  return new;
end;
$$;

drop trigger if exists questions_live_odds_default on public.questions;
create trigger questions_live_odds_default
  before insert or update of betting on public.questions
  for each row execute function public.question_live_odds_default();

revoke execute on function public.question_live_odds_default() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Keeping the anchor
-- ---------------------------------------------------------------------------

create or replace function public.question_keep_open_odds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o        jsonb;
  v_open   numeric;
  v_result jsonb := '[]'::jsonb;
begin
  if new.options is null or old.options is null then
    return new;
  end if;

  for o in select * from jsonb_array_elements(new.options) loop
    -- The incoming value wins if it has one; otherwise the option keeps the
    -- opening price it already had, matched by id.
    v_open := coalesce(
      (o ->> 'open')::numeric,
      (select (x ->> 'open')::numeric
         from jsonb_array_elements(old.options) x
        where x ->> 'id' = o ->> 'id')
    );
    v_result := v_result || case
      when v_open is null then o
      else o || jsonb_build_object('open', v_open)
    end;
  end loop;

  new.options := v_result;
  return new;
end;
$$;

drop trigger if exists questions_keep_open_odds on public.questions;
create trigger questions_keep_open_odds
  before update of options on public.questions
  for each row execute function public.question_keep_open_odds();

revoke execute on function public.question_keep_open_odds() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Catching up the ones already written
-- ---------------------------------------------------------------------------
-- Open staking questions only. A resolved one keeps the price it was settled
-- at, and nothing is repriced after the fact.

update public.questions set live_odds = true
 where betting is true and status = 'open' and live_odds is false;

do $$
declare r record;
begin
  for r in select id from public.questions where live_odds is true and status = 'open' loop
    perform public.recompute_odds(r.id);
  end loop;
end $$;
