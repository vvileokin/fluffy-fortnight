-- CS2 UA — award prediction points atomically.
-- Run in Supabase → SQL Editor.
--
-- The resolve route read every winner's profile, added the reward in JavaScript
-- and wrote the total back. Two resolutions running close together — an admin
-- settling a match's questions one after another, or two admins at once — both
-- read the same starting totals and each wrote `start + its own reward`. The
-- later write erased the earlier one, so a player who won both questions was
-- credited for only one of them.
--
-- It presented as "some matches don't count", and it was never the same
-- players twice, which is what made it look intermittent: only those who won
-- two questions resolved within the same moment lost anything. Fourteen
-- players were short 1160 EWC points from two questions when this was found.
--
-- `column = column + value` inside one UPDATE is evaluated by Postgres against
-- the current row under a row lock, so concurrent statements queue instead of
-- overwriting. One statement for the whole winner list also removes the
-- per-user round trip the route used to make.

create or replace function public.award_predictions(
  p_users   uuid[],
  p_reward  integer,
  p_columns text default null      -- 'ewc' | 'bounty' | null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  -- Service role only. Inside a user session `freeze_profile_admin_flag`
  -- reverts every column written here, so the update would silently no-op
  -- while the caller counted it as paid.
  if auth.uid() is not null then
    return 0;
  end if;

  update public.profiles
     set points         = points  + p_reward,
         correct        = correct + 1,
         bounty_points  = bounty_points  + case when p_columns = 'bounty' then p_reward else 0 end,
         bounty_correct = bounty_correct + case when p_columns = 'bounty' then 1 else 0 end,
         ewc_points     = ewc_points     + case when p_columns = 'ewc' then p_reward else 0 end,
         ewc_correct    = ewc_correct    + case when p_columns = 'ewc' then 1 else 0 end
   where id = any (p_users);

  get diagnostics touched = row_count;
  return touched;
end;
$$;

revoke execute on function public.award_predictions(uuid[], integer, text)
  from public, anon, authenticated;
grant execute on function public.award_predictions(uuid[], integer, text)
  to service_role;
