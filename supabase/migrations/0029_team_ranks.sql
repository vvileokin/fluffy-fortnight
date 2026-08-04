-- CS2 UA — team ranks from Valve's own Regional Standings (the model used to
-- invite teams to Majors), pulled from the public GitHub repo. A team can have
-- a global position, a regional one, both, or neither (not every team in our
-- catalog is ranked). Written by the sync only; read is public since the site
-- already shows a world rank on team cards.
-- Run in Supabase → SQL Editor.

create table if not exists public.team_ranks (
  slug           text primary key,   -- our catalog slug (hardcoded or custom_teams)
  global_rank    integer,
  global_points  integer,
  region         text,               -- europe | americas | asia — whichever list it appeared in
  region_rank    integer,
  region_points  integer,
  updated_at     timestamptz not null default now()
);

alter table public.team_ranks enable row level security;

drop policy if exists "team ranks public read" on public.team_ranks;
create policy "team ranks public read"
  on public.team_ranks for select using (true);
-- No write policy — only the service role updates this.
