-- CS2 UA — stop players from editing their own score.
-- The "users update own profile" policy allows a signed-in user to update their
-- whole row, and nothing limited which columns — so anyone could call the public
-- API and set their own points, streak or admin flag. Scores are awarded by the
-- resolve routes (service role) only. Run in Supabase → SQL Editor.

create or replace function public.freeze_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nobody flips the legacy admin flag; admin_users is the source of truth.
  new.is_admin := old.is_admin;

  -- auth.uid() is null when the service role writes (the resolve routes), and
  -- set when the update comes from a signed-in user editing their own row.
  -- Users may change their handle and avatar; the scoring columns are ours.
  if auth.uid() is not null then
    new.points        := old.points;
    new.bounty_points := old.bounty_points;
    new.correct       := old.correct;
    new.streak        := old.streak;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_freeze_admin on public.profiles;
create trigger profiles_freeze_admin
  before update on public.profiles
  for each row execute function public.freeze_profile_admin_flag();
