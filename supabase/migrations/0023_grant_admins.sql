-- CS2 UA — who holds admin access.
-- Grants exactly leloosh and vvileokin, and drops anyone else who might hold a
-- row. Safe to re-run: it always leaves those two and only those two.
-- Run in Supabase → SQL Editor, after 0020_admin_users.sql.

insert into public.admin_users (user_id, role)
select id, 'admin' from public.profiles where handle in ('leloosh', 'vvileokin')
on conflict (user_id) do update set role = 'admin';

delete from public.admin_users
where user_id not in (
  select id from public.profiles where handle in ('leloosh', 'vvileokin')
);

-- Check the result:
--   select p.handle, a.role from public.admin_users a
--   join public.profiles p on p.id = a.user_id;
