-- CS2 UA — refuse a prediction once the match is under way.
-- Run in Supabase → SQL Editor.
--
-- The RLS policies on `predictions` only ever asked "is this your row". Nothing
-- asked "is it still your turn". The interface disables the buttons after a
-- match starts, but the write itself was never guarded, so a question an admin
-- hadn't manually closed kept accepting answers — during the match, and in
-- eighteen recorded cases after the result was already in the database.
--
-- That was not one person exploiting it: 167 predictions across a dozen
-- accounts landed after their match had started, simply because the site let
-- them. No points are being taken back for it. This closes the door.
--
-- A trigger rather than a policy: the rule spans three tables, and a failed
-- policy is an invisible no-op while a raised exception tells the client
-- exactly why it was refused.

create or replace function public.guard_prediction_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status   text;
  v_start    timestamptz;
  v_resolved boolean;
begin
  -- Service role writes (backfills, admin tooling) are not player answers and
  -- are deliberately exempt.
  if auth.uid() is null then
    return new;
  end if;

  select q.status, m.start_at, exists (
           select 1 from public.question_results r where r.question_id = q.id
         )
    into v_status, v_start, v_resolved
    from public.questions q
    left join public.matches m on m.id = q.match_id
   where q.id = new.question_id;

  if not found then
    raise exception 'question not found' using errcode = 'P0002';
  end if;

  if v_resolved then
    raise exception 'Питання вже розраховане' using errcode = 'P0001';
  end if;

  if v_status is distinct from 'open' then
    raise exception 'Прийом прогнозів закрито' using errcode = 'P0001';
  end if;

  -- `start_at` is the deadline everyone already understands. Null means the
  -- fixture has no time set yet, and then the status above is the only gate
  -- there is to apply.
  if v_start is not null and v_start <= now() then
    raise exception 'Матч уже почався' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists predictions_window on public.predictions;
create trigger predictions_window
  before insert or update on public.predictions
  for each row execute function public.guard_prediction_window();

-- ---------------------------------------------------------------------------
-- Bounty picks have the same hole
-- ---------------------------------------------------------------------------
-- Same shape of policy, same omission: a stage that is locked or already
-- resolved still accepted picks.

create or replace function public.guard_bounty_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked   boolean;
  v_resolved boolean;
  v_deadline timestamptz;
begin
  if auth.uid() is null then
    return new;
  end if;

  select locked, resolved, deadline
    into v_locked, v_resolved, v_deadline
    from public.bounty_stages
   where stage_id = new.stage_id;

  if coalesce(v_resolved, false) or coalesce(v_locked, false) then
    raise exception 'Стадію закрито' using errcode = 'P0001';
  end if;

  if v_deadline is not null and v_deadline <= now() then
    raise exception 'Дедлайн стадії минув' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists bounty_picks_window on public.bounty_picks;
create trigger bounty_picks_window
  before insert or update on public.bounty_picks
  for each row execute function public.guard_bounty_window();
