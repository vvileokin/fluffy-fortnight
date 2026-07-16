-- CS2 UA — let players clear their own bounty picks (unpick a team / reset a draft).
-- Without this, deletes are silently blocked by RLS. Run in Supabase → SQL Editor.

drop policy if exists "users delete own bounty picks" on public.bounty_picks;
create policy "users delete own bounty picks"
  on public.bounty_picks for delete using (auth.uid() = user_id);
