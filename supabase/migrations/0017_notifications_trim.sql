-- CS2 UA — keep the notifications list short.
-- Once a user reaches 10 notifications, drop their 5 oldest so the bell
-- doesn't pile up. Runs automatically after each insert.
-- Run in Supabase → SQL Editor.

create or replace function public.trim_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.notifications where user_id = new.user_id) >= 10 then
    delete from public.notifications
    where id in (
      select id from public.notifications
      where user_id = new.user_id
      order by created_at asc
      limit 5
    );
  end if;
  return null;
end;
$$;

drop trigger if exists notifications_trim on public.notifications;
create trigger notifications_trim
  after insert on public.notifications
  for each row execute function public.trim_notifications();
