-- CS2 UA — the one-shot playoff bracket.
-- Run in Supabase → SQL Editor.
--
-- A player fills the whole playoff once, before it starts, and cannot change it
-- afterwards — that irrevocability is the entire game. So the row is written
-- once and never updated: there is a policy for insert and one for select, and
-- deliberately none for update or delete.
--
-- Scoring is by *set of teams per round*, not by match slot. If your Round of 16
-- pick loses, a slot-based bracket scores zero for everything downstream of it
-- even where you read the tournament correctly — one early upset and the card is
-- dead, which is exactly when people stop looking at it. Comparing sets means a
-- team you said would reach the semi-final still pays if it got there by a path
-- you didn't foresee.

create table if not exists public.bracket_predictions (
  user_id         uuid not null references auth.users (id) on delete cascade,
  tournament_slug text not null,
  -- { "qf": [8 slugs], "sf": [4], "final": [2], "champion": "slug" }
  -- Each array is who the player says *reaches* that round.
  picks           jsonb not null,
  points          integer not null default 0,
  scored_at       timestamptz,
  created_at      timestamptz not null default now(),
  primary key (user_id, tournament_slug)
);

alter table public.bracket_predictions enable row level security;

drop policy if exists "players read own bracket" on public.bracket_predictions;
create policy "players read own bracket"
  on public.bracket_predictions for select
  using (auth.uid() = user_id);

-- Insert only, and only your own. No update policy: the bracket is a commitment,
-- and a player who could edit theirs after the first result is not predicting.
drop policy if exists "players submit own bracket" on public.bracket_predictions;
create policy "players submit own bracket"
  on public.bracket_predictions for insert
  with check (auth.uid() = user_id);

create index if not exists bracket_predictions_slug_idx
  on public.bracket_predictions (tournament_slug);

/**
 * Score every submitted bracket against what actually happened.
 *
 * `p_actual` carries the teams that genuinely reached each round:
 *   { "qf": [...], "sf": [...], "final": [...], "champion": "slug" }
 *
 * Per correctly-named team: 25 for the quarter-finals, 50 for the semis, 100
 * for the final, 300 for calling the champion. Each round is worth the same 200
 * in total (8x25, 4x50, 2x100) so no single round decides the board, while the
 * per-team rate doubles each time — reading the tournament deep is worth more
 * than spreading guesses wide. The champion is the one pick weighted above its
 * round, because it is the one everybody argues about.
 *
 * Idempotent: `scored_at is null` means a re-run tops up brackets submitted
 * late without paying anyone twice.
 */
create or replace function public.score_brackets(
  p_slug   text,
  p_actual jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec     record;
  hit     integer;
  total   integer;
  scored  integer := 0;
begin
  if auth.uid() is not null then
    return 0;
  end if;

  for rec in
    select user_id, picks
      from public.bracket_predictions
     where tournament_slug = p_slug
       and scored_at is null
  loop
    total := 0;

    -- Quarter-finalists: 8 teams at 25.
    select count(*) into hit
      from jsonb_array_elements_text(coalesce(rec.picks -> 'qf', '[]'::jsonb)) p
     where p in (select jsonb_array_elements_text(coalesce(p_actual -> 'qf', '[]'::jsonb)));
    total := total + hit * 25;

    -- Semi-finalists: 4 at 50.
    select count(*) into hit
      from jsonb_array_elements_text(coalesce(rec.picks -> 'sf', '[]'::jsonb)) p
     where p in (select jsonb_array_elements_text(coalesce(p_actual -> 'sf', '[]'::jsonb)));
    total := total + hit * 50;

    -- Finalists: 2 at 100.
    select count(*) into hit
      from jsonb_array_elements_text(coalesce(rec.picks -> 'final', '[]'::jsonb)) p
     where p in (select jsonb_array_elements_text(coalesce(p_actual -> 'final', '[]'::jsonb)));
    total := total + hit * 100;

    -- The champion: 300.
    if (rec.picks ->> 'champion') is not null
       and rec.picks ->> 'champion' = p_actual ->> 'champion' then
      total := total + 300;
    end if;

    update public.bracket_predictions
       set points = total, scored_at = now()
     where user_id = rec.user_id and tournament_slug = p_slug;

    -- Straight into the event column, the same currency the playoff pays in.
    if total > 0 then
      update public.profiles
         set ewc_points = ewc_points + total
       where id = rec.user_id;
    end if;

    scored := scored + 1;
  end loop;

  return scored;
end;
$$;

revoke execute on function public.score_brackets(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.score_brackets(text, jsonb) to service_role;
