-- CS2 UA — backfill profile rows for accounts created before the signup trigger.
-- Safe to run repeatedly. Run in Supabase → SQL Editor.

insert into public.profiles (id, handle, avatar_url)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'name',
    u.raw_user_meta_data ->> 'user_name',
    split_part(u.email, '@', 1),
    'гравець'
  ),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
