-- CS2 UA — PandaScore import inbox.
-- PandaScore supplies the calendar (who plays whom, when, best-of); the maps,
-- veto and questions stay ours. Nothing it sends goes live on its own: every
-- match waits in this inbox until an admin approves it.
-- Both tables are service-role only — no client policies. Run in Supabase.

-- Matches pulled from PandaScore, awaiting a decision.
create table if not exists public.ps_matches (
  ps_id            bigint primary key,          -- PandaScore match id
  name             text,                        -- "MOUZ vs Team Spirit"
  ps_status        text,                        -- not_started|running|finished|canceled|postponed
  begin_at         timestamptz,
  number_of_games  integer,                     -- 3 => BO3, 5 => BO5
  match_type       text,                        -- best_of | first_to | ...
  league_name      text,
  serie_name       text,
  tournament_name  text,
  team_a_ps_id     bigint,
  team_a_name      text,
  team_a_acronym   text,
  team_a_logo      text,
  team_b_ps_id     bigint,
  team_b_name      text,
  team_b_acronym   text,
  team_b_logo      text,
  score_a          integer not null default 0,
  score_b          integer not null default 0,
  raw              jsonb,                       -- full object, so new fields need no re-sync

  -- Review state. A rejected match stays rejected: re-syncing must not
  -- resurrect something the admin already dismissed.
  review           text not null default 'pending'
                     check (review in ('pending', 'approved', 'rejected')),
  match_id         text references public.matches (id) on delete set null,
  synced_at        timestamptz not null default now(),
  decided_at       timestamptz,
  decided_by       uuid references auth.users (id) on delete set null
);

create index if not exists ps_matches_review_idx
  on public.ps_matches (review, begin_at desc);

-- PandaScore's team ids mapped onto our catalog slugs, so a team only has to be
-- identified once. Filled in as matches get approved.
create table if not exists public.ps_teams (
  ps_team_id bigint primary key,
  slug       text not null,                     -- our catalog slug, e.g. "mouz"
  ps_name    text,
  created_at timestamptz not null default now()
);

alter table public.ps_matches enable row level security;
alter table public.ps_teams   enable row level security;
-- Deliberately no policies: only the service role reads or writes these.
