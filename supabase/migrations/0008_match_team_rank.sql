-- CS2 UA — optional world-rank for custom match teams. Run in Supabase → SQL Editor.

alter table public.matches
  add column if not exists team_a_rank integer not null default 0,
  add column if not exists team_b_rank integer not null default 0;
