-- CS2 UA — per-team seed positions for a bounty stage.
-- Lets the admin set the seeding of later stages (round of 16 onward) so the
-- draft lists lower seeds (9–16) and the higher-seed picker (1–8) in that order.
-- Round 1 (round of 32) doesn't use this. Run in Supabase → SQL Editor.

alter table public.bounty_stages
  add column if not exists seeds jsonb not null default '{}'::jsonb;  -- { "<slug>": <seedNumber> }
