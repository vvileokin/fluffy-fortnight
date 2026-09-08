-- CS2 UA — прогноз відбору на мейджор, як таблиця в базі.
-- Run in Supabase → SQL Editor. Standalone; depends on nothing.
--
-- The model that fills this lives outside the app and cannot be moved into it.
-- Valve publish the Regional Standings once a month; HLTV recompute them
-- continuously and include prize money already secured in tournaments still
-- running, which is one of the four seed factors and never shows up in match
-- results. So HLTV is the source. HLTV also refuse a plain fetch — the page
-- comes back 403 to anything that is not a browser — which means no scheduled
-- function on Vercel can ever refresh this on its own.
--
-- That constraint decides the shape. The projection is computed offline, on a
-- machine with a browser, and pushed here. The site only ever reads. A refresh
-- is one command in a terminal and needs no deploy, which is the whole point of
-- putting it in a table rather than committing a JSON file to the repo.
--
-- Two tables because there are two kinds of fact: one row per team, and one row
-- for the run itself. The run row matters as much as the teams — a projection
-- without the date it was taken and the cutoff it points at is not a
-- projection, it is a number somebody remembers seeing.

-- ---------------------------------------------------------------------------
-- The run
-- ---------------------------------------------------------------------------
create table if not exists public.major_meta (
  -- One row, ever. The check keeps it that way: a second run overwrites the
  -- first rather than quietly doubling the page.
  id           boolean primary key default true check (id),
  as_of        date        not null,          -- дата зрізу VRS
  cutoff       date        not null,          -- коли роздають запрошення
  event        text        not null,          -- 'PGL Major Singapore'
  runs         bigint      not null,          -- скільки прогонів у симуляції
  slots        jsonb       not null,          -- {"europe":{"total":18,"stage3":6,...}, ...}
  -- The calendar the projection is built on, so the page can show what is still
  -- to be played rather than only the number that came out of it. Kept here and
  -- not derived from the team rows: the rows carry which events a team is in,
  -- which is not the same as when those events are, and a reader wants the
  -- dates.
  events       jsonb       not null default '[]'::jsonb,
  source       text        not null,
  computed_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- The teams
-- ---------------------------------------------------------------------------
create table if not exists public.major_projection (
  region        text    not null check (region in ('europe','americas','asia')),
  team          text    not null,             -- як пише HLTV
  -- Slug into the site's own team catalogue where there is one, so the page can
  -- draw a crest. Null is normal and expected: the standings carry four hundred
  -- teams and the catalogue carries the ones we run matches on.
  slug          text,
  vrs           integer not null,             -- очки VRS на дату зрізу
  mu            integer not null,             -- очікувані очки на відсічення
  sd            integer not null,             -- розкид навколо mu
  p_qual        real    not null,             -- шанс потрапити на мейджор
  p_stage3      real    not null,
  p_stage2      real    not null,
  p_stage1      real    not null,
  projected     integer not null,             -- прогнозоване місце в регіоні
  place_lo      integer,                      -- 5% межа місця
  place_hi      integer,                      -- 95% межа місця
  -- What the number is made of, so a reader can check it rather than trust it.
  tier1         jsonb   not null default '[]'::jsonb,   -- ["ESL Pro League Season 24", ...]
  tier2         jsonb   not null default '[]'::jsonb,   -- [{"name":"...","p":0.6}, ...]
  qual_by       jsonb   not null default '[]'::jsonb,   -- [{"name":"...","p":0.4}, ...]
  primary key (region, team)
);

create index if not exists major_projection_rank
  on public.major_projection (region, projected);

-- ---------------------------------------------------------------------------
-- Read by everyone, written by nobody through the API
-- ---------------------------------------------------------------------------
-- The page is public and the numbers are published, so anon may read. Writes
-- come from the offline push using the service role, which bypasses RLS — so
-- no write policy is declared at all. Leaving one off is the point: there is no
-- path from the browser to these rows.
alter table public.major_meta       enable row level security;
alter table public.major_projection enable row level security;

drop policy if exists major_meta_read on public.major_meta;
create policy major_meta_read on public.major_meta
  for select using (true);

drop policy if exists major_projection_read on public.major_projection;
create policy major_projection_read on public.major_projection
  for select using (true);

grant select on public.major_meta, public.major_projection to anon, authenticated;
