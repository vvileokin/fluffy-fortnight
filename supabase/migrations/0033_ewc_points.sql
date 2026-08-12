-- CS2 UA — Esports World Cup 2026 event points.
-- Run in Supabase → SQL Editor.
--
-- EWC scores the same way BLAST Bounty did, but it needs its own columns rather
-- than reusing `bounty_points` / `bounty_correct`. Those hold a finished
-- tournament's final table; if EWC wrote into them, every BLAST result on the
-- site would silently drift upward for the next two weeks and the historical
-- leaderboard would stop being true.
--
-- There is deliberately no `ewc_streak`. A streak is a property of the player,
-- not of one tournament, so EWC matches feed the ordinary `profiles.streak`
-- and the event board simply doesn't show a streak column.

alter table public.profiles
  add column if not exists ewc_points  integer not null default 0,
  add column if not exists ewc_correct integer not null default 0;

-- Same lockdown as every other scoring column: a player may never write their
-- own total. Migration 0021 froze these for `authenticated`; re-assert it for
-- the new pair so a stale grant can't leave them writable.
revoke update (ewc_points, ewc_correct) on public.profiles from authenticated;

create index if not exists profiles_ewc_points_idx
  on public.profiles (ewc_points desc)
  where ewc_points > 0;
