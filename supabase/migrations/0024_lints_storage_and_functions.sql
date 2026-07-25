-- CS2 UA — close the Supabase security lints.
-- Run in Supabase → SQL Editor. Supersedes the policies from 0007_storage.sql.

-- ── 1. Storage: no client access to the bucket at all ────────────────────────
-- Every upload in this app goes through the server (service role), which checks
-- the file is an image under 5MB: admin covers via /api/admin/upload, avatars
-- via /api/profile. Nothing in the browser reads or writes storage directly —
-- images are shown from the bucket's public URLs, which don't consult RLS.
--
-- So these policies bought nothing and cost two things: the broad SELECT let
-- anyone LIST the whole bucket (every filename, and every user's id from the
-- avatars/<uid>/ paths), and the avatar write policies let any signed-in user
-- upload arbitrary files straight to the bucket, skipping the size and type
-- checks the server does.
--
-- (If browser-side uploads are ever wanted, add a narrow policy back — but keep
-- the listing one off.)
drop policy if exists "media public read"       on storage.objects;
drop policy if exists "users upload own avatar" on storage.objects;
drop policy if exists "users update own avatar" on storage.objects;
drop policy if exists "users delete own avatar" on storage.objects;

-- ── 2. Trigger functions shouldn't be callable over the API ──────────────────
-- Postgres grants EXECUTE on functions to PUBLIC by default, which exposed
-- these as /rest/v1/rpc/<name>. They are trigger functions and only ever run
-- from their triggers. Revoking is safe: EXECUTE is checked when a trigger is
-- created, not each time it fires, so the existing triggers keep working.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.handle_new_user()',
    'public.trim_notifications()',
    'public.freeze_profile_admin_flag()'
  ] loop
    begin
      execute format('revoke all on function %s from public, anon, authenticated', fn);
    exception
      when undefined_function then
        raise notice 'skipped % (not created yet)', fn;
    end;
  end loop;
end $$;

-- ── 3. Leaked password protection ────────────────────────────────────────────
-- Not settable from SQL. Turn it on in the dashboard:
--   Authentication → Policies (Passwords) → "Prevent use of leaked passwords".
-- Worth doing: the site offers email/password signup, and this checks new
-- passwords against HaveIBeenPwned.
