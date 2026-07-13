-- CS2 UA — matches managed by admins. Run in Supabase → SQL Editor.

create table if not exists public.matches (
  id             text primary key,
  tournament_slug text not null,
  is_event       boolean not null default false,      -- BLAST event skin vs regular
  team_a         text not null,                        -- team slug
  team_b         text not null,
  status         text not null default 'upcoming',     -- upcoming | live | finished
  format         text not null default 'BO3',
  stage          text,
  start_at       timestamptz,
  time_label     text,
  score_a        integer not null default 0,           -- overall series score (maps won)
  score_b        integer not null default 0,
  live_map_label text,                                  -- e.g. "Mirage · 2 карта"
  live_round_a   integer not null default 0,           -- current-map rounds
  live_round_b   integer not null default 0,
  maps           jsonb not null default '[]'::jsonb,    -- [{ name, a, b }]
  veto           jsonb not null default '[]'::jsonb,    -- [{ team, action, map }] action: ban|pick|decider
  h2h            jsonb,                                 -- { a, b, series:[{ event, score, winner }] }
  open_questions integer not null default 0,
  max_reward     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.matches enable row level security;

-- Public read; writes happen only via the service-role admin API (bypasses RLS).
create policy "matches are public"
  on public.matches for select using (true);

-- Seed the two BLAST Bounty matches so nothing breaks on first deploy.
insert into public.matches (id, tournament_slug, is_event, team_a, team_b, status, format, stage, time_label, open_questions, max_reward)
values
  ('m-vitality-wildcard', 'blast-bounty-s2', true, 'vitality', 'wildcard', 'upcoming', 'BO3', 'Bounty · Раунд 1', '21 лип · 17:00', 2, 260),
  ('m-spirit-og',        'blast-bounty-s2', true, 'spirit',   'og',       'upcoming', 'BO3', 'Bounty · Раунд 1', '21 лип · 20:00', 2, 195)
on conflict (id) do nothing;
