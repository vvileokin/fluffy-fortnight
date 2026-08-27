-- CS2 UA — вимикач для клубу 0-2, як у сітки плейофу.
-- Run in Supabase → SQL Editor. Requires 0009 and 0053.
--
-- Each group already shuts itself when its own first match is due, which is the
-- right backstop and the wrong only-option — the same argument that gave the
-- playoff bracket its switch in 0041. A schedule moves. An admin decides the
-- picks have had long enough. Group B does not play until tomorrow morning and
-- there is no way, short of lying about a fixture's start time, to say "that is
-- enough" today.
--
-- One flag rather than one per group: the derived clock already handles the
-- per-group case, so what is missing is only the ability to close the whole
-- thing early. Off by default, so nothing changes until somebody throws it.

alter table public.site_settings
  add column if not exists porto_club_closed boolean not null default false;

comment on column public.site_settings.porto_club_closed is
  'Closes the 0-2 club for every group regardless of the fixtures. The per-group
   clock still closes each group on its own first match; this only ever shuts
   things earlier, never re-opens them.';
