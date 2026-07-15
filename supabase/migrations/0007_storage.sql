-- CS2 UA — public `media` storage bucket for images (admin covers + user avatars).
-- Run in Supabase → SQL Editor. Safe to run more than once.

-- 1. Create (or make public) the `media` bucket.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- 2. Anyone can read files in `media` (public site images + avatars).
drop policy if exists "media public read" on storage.objects;
create policy "media public read"
  on storage.objects for select
  using (bucket_id = 'media');

-- 3. A signed-in user may upload only into their own avatars/<uid>/ folder.
--    (Admin uploads go through the service-role key and bypass RLS entirely.)
drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- 4. A user may replace / remove their own avatar files.
drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
