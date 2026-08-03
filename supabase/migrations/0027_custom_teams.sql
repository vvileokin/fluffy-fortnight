-- CS2 UA — teams created from the import, plus tidier competition names.
-- Run in Supabase → SQL Editor.

-- Teams that aren't in the hardcoded catalog. Created straight from PandaScore
-- (name + logo) while approving a match, so the next match with that team is
-- recognised without any picking. Matches keep carrying their own copy of the
-- name/logo/colour, so nothing here is needed to render a match.
create table if not exists public.custom_teams (
  slug       text primary key,
  name       text not null,
  tag        text not null,
  logo       text,                       -- absolute URL (PandaScore) or local path
  brand      text not null default '#1D1D20',
  created_at timestamptz not null default now()
);

alter table public.custom_teams enable row level security;
-- Read is public: the site shows these teams like any other.
drop policy if exists "custom teams public read" on public.custom_teams;
create policy "custom teams public read"
  on public.custom_teams for select using (true);
-- No write policy — only the service role creates them.

-- PandaScore splits a competition across league / serie / tournament. Store the
-- readable name we build from those, and the stage within it, rather than
-- re-deriving them everywhere.
alter table public.ps_matches
  add column if not exists competition text,   -- "ESL Pro League Season 23"
  add column if not exists stage_name  text;   -- "Playoffs"
