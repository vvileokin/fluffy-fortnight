-- CS2 UA — admin-managed BLAST Bounty stage state (teams, seeds, deadline, winners).
-- The stage meta (title, reward, kind) stays in code; this holds the editable state.
-- Run in Supabase → SQL Editor.

create table if not exists public.bounty_stages (
  stage_id   text primary key,                     -- r1 | r2 | qf | sf
  teams      jsonb not null default '[]'::jsonb,    -- ordered team slugs in the stage
  low_seeds  jsonb not null default '[]'::jsonb,    -- subset of teams that pick (rest are high seeds)
  winners    jsonb not null default '[]'::jsonb,    -- teams that advanced (SF winners build the final)
  locked     boolean not null default false,
  deadline   timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.bounty_stages enable row level security;

drop policy if exists "bounty stages public read" on public.bounty_stages;
create policy "bounty stages public read"
  on public.bounty_stages for select using (true);
