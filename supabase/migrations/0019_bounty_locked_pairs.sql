-- CS2 UA — close bounty pairs one at a time.
-- Holds the lower-seed slugs whose pair is already closed, so the admin can shut
-- a single pair as it gets decided while the rest of the stage stays open.
-- Existing picks in bounty_picks are untouched. Run in Supabase → SQL Editor.

alter table public.bounty_stages
  add column if not exists locked_pairs jsonb not null default '[]'::jsonb;  -- ["<lowSlug>", ...]
