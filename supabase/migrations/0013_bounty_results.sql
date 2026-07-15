-- CS2 UA — actual bounty pair results + resolved flag for scoring. Run in Supabase.

alter table public.bounty_stages
  add column if not exists results  jsonb   not null default '{}'::jsonb,  -- { "<lowSlug>": "<actual highSlug>" }
  add column if not exists resolved boolean not null default false;
