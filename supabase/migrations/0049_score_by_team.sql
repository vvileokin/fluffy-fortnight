-- CS2 UA — score the bracket team by team, not round by round.
-- Run in Supabase → SQL Editor. Replaces `score_bracket_round` from 0048.
--
-- 0048 paid a whole round at once and then marked the round done, which meant
-- waiting for all eight quarter-finalists before anyone saw a point — and the
-- eight are decided across four separate evenings. Marking a partly-filled
-- round as paid would also have locked out the teams that qualified later.
--
-- The ledger is per team instead: `scored_rounds` holds entries like `qf:g2`.
-- An admin can tick the two teams that just went through, press the button, and
-- come back tomorrow for the next two. Teams already paid for are skipped, so
-- pressing it again with the same names pays nothing, and the same call is safe
-- to repeat with a longer list.

create or replace function public.score_bracket_round(
  p_slug  text,
  p_round text,        -- 'qf' | 'sf' | 'final' | 'champion'
  p_teams text[]       -- however many are known so far
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec     record;
  per     integer;
  slug    text;
  tag     text;
  gained  integer;
  fresh   text[];
  paid    integer := 0;
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
  if per is null or p_teams is null or array_length(p_teams, 1) is null then
    return 0;
  end if;

  for rec in
    select user_id, picks, coalesce(points, 0) as points, scored_rounds
      from public.bracket_predictions
     where tournament_slug = p_slug
  loop
    gained := 0;
    fresh  := '{}';

    foreach slug in array p_teams loop
      tag := p_round || ':' || slug;
      -- Already settled for this player and this team.
      continue when tag = any (rec.scored_rounds);

      -- Did they name this team in this round?
      if p_round = 'champion' then
        if (rec.picks ->> 'champion') = slug then
          gained := gained + per;
        end if;
      elsif exists (
        select 1
          from jsonb_array_elements_text(coalesce(rec.picks -> p_round, '[]'::jsonb)) p
         where p = slug
      ) then
        gained := gained + per;
      end if;

      -- Recorded either way: a team the player missed is still settled for
      -- them, or the next press would look at it again.
      fresh := array_append(fresh, tag);
    end loop;

    if array_length(fresh, 1) is null then
      continue;
    end if;

    update public.bracket_predictions
       set points = coalesce(points, 0) + gained,
           scored_rounds = scored_rounds || fresh,
           scored_at = case when p_round = 'champion' then now() else scored_at end
     where user_id = rec.user_id and tournament_slug = p_slug;

    if gained > 0 then
      update public.profiles
         set ewc_points = ewc_points + gained,
             points     = points + gained
       where id = rec.user_id;
    end if;

    paid := paid + 1;
  end loop;

  return paid;
end;
$$;

revoke execute on function public.score_bracket_round(text, text, text[])
  from public, anon, authenticated;
grant execute on function public.score_bracket_round(text, text, text[])
  to service_role;
