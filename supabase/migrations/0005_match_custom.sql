-- CS2 UA — allow admins to enter custom teams / tournaments per match.
-- Run in Supabase → SQL Editor (after 0003_matches.sql).

alter table public.matches
  add column if not exists team_a_name    text,
  add column if not exists team_a_logo    text,
  add column if not exists team_a_color   text,
  add column if not exists team_b_name    text,
  add column if not exists team_b_logo    text,
  add column if not exists team_b_color   text,
  add column if not exists tournament_name text,
  add column if not exists tournament_icon text;
