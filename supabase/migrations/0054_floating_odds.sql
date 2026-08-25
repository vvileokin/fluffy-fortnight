-- CS2 UA — floating odds on free predictions.
-- Run in Supabase → SQL Editor.
--
-- The rule is one sentence: the fewer people who picked what you picked, the
-- more it pays. Formally the multiplier is
--
--     (1 / number of options) / (share who picked yours)
--
-- anchored so that an evenly split market pays exactly the option's own reward.
-- It says how much rarer than average a pick was, and it generalises without
-- special cases — four outcomes in a BO3, six in a BO5, two in a yes/no.
--
-- Three things make this safe to add to a live site.
--
-- It is a trigger, not a route. Predictions are written straight from the
-- client through RLS, so a value computed in the app could be posted by hand;
-- computed here it sees the real counts, inside the same transaction, and
-- cannot be forged. No client code changes at all.
--
-- `odds` is NULL everywhere it does not apply, and NULL means "pay the flat
-- reward, exactly as before". Every question that already exists, and every
-- tournament that does not opt in, is untouched by construction.
--
-- And it only fires for tournaments listed below. Turning it on everywhere at
-- once would repriced live questions mid-flight.

alter table public.predictions
  add column if not exists odds numeric(4, 2);

comment on column public.predictions.odds is
  'Multiplier locked at the moment the pick was made. NULL means the flat
   reward — the behaviour before floating odds existed.';

-- ---------------------------------------------------------------------------
-- The multiplier
-- ---------------------------------------------------------------------------

create or replace function public.prediction_odds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug     text;
  v_options  integer;
  v_total    integer;
  v_on_pick  integer;
  v_share    numeric;
  v_mult     numeric;
  -- Below this many picks a "share" means nothing: the first person to answer
  -- would make their own share 100% and be paid the floor — the least, for
  -- arriving first, which is the exact opposite of the intent.
  WARMUP     constant integer := 20;
  -- Without a ceiling, one pick in five hundred would pay five hundred times.
  -- Without a floor, the obvious answer would pay nothing and nobody would
  -- bother making the easy call at all.
  MULT_MIN   constant numeric := 0.4;
  MULT_MAX   constant numeric := 4.0;
begin
  select m.tournament_slug, jsonb_array_length(q.options)
    into v_slug, v_options
    from public.questions q
    join public.matches m on m.id = q.match_id
   where q.id = new.question_id;

  -- The opt-in list. Everything not named here keeps flat rewards.
  if v_slug is distinct from 'blast-porto-2026' then
    new.odds := null;
    return new;
  end if;

  if v_options is null or v_options < 2 then
    new.odds := null;
    return new;
  end if;

  -- Counted with this row included, whether it is an insert or a change of
  -- mind: an update moves one pick from one option to another, so excluding it
  -- would price the market as it stood before the player touched it.
  select
      count(*) filter (where p.user_id <> new.user_id) + 1,
      count(*) filter (where p.user_id <> new.user_id and p.option_id = new.option_id) + 1
    into v_total, v_on_pick
    from public.predictions p
   where p.question_id = new.question_id;

  if v_total < WARMUP then
    new.odds := 1.0;
    return new;
  end if;

  v_share := v_on_pick::numeric / v_total::numeric;
  v_mult  := (1.0 / v_options::numeric) / v_share;
  new.odds := round(least(greatest(v_mult, MULT_MIN), MULT_MAX), 2);
  return new;
end;
$$;

drop trigger if exists predictions_odds on public.predictions;
create trigger predictions_odds
  before insert or update of option_id on public.predictions
  for each row execute function public.prediction_odds();

-- ---------------------------------------------------------------------------
-- What a player sees before they press
-- ---------------------------------------------------------------------------
-- The number has to be on the button, or the mechanic is invisible and the
-- timing decision it creates does not exist. Counting is not secret — the
-- shares are the same for everyone — so this is readable by anyone.

create or replace function public.question_odds(p_question text)
returns table (option_id text, picks integer, odds numeric)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select jsonb_array_length(qq.options) as options, m.tournament_slug as slug
      from public.questions qq
      join public.matches m on m.id = qq.match_id
     where qq.id = p_question
  ), tally as (
    select p.option_id, count(*)::integer as picks
      from public.predictions p
     where p.question_id = p_question
     group by p.option_id
  ), total as (
    select coalesce(sum(picks), 0)::integer as n from tally
  )
  select o.value ->> 'id',
         coalesce(t.picks, 0),
         case
           when (select slug from q) is distinct from 'blast-porto-2026' then null
           when (select n from total) < 20 then 1.0
           else round(
             least(greatest(
               (1.0 / (select options from q)::numeric)
                 / (greatest(coalesce(t.picks, 0), 1)::numeric / (select n from total)::numeric),
               0.4), 4.0), 2)
         end
    from public.questions qq
    cross join lateral jsonb_array_elements(qq.options) o
    left join tally t on t.option_id = o.value ->> 'id'
   where qq.id = p_question;
$$;

revoke execute on function public.question_odds(text) from public;
grant execute on function public.question_odds(text) to anon, authenticated, service_role;
