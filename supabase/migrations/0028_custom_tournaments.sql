-- CS2 UA — tournaments created from the import.
-- The hardcoded catalog only ever held our own events; PandaScore brings
-- matches from competitions we've never listed, and a match has to belong to
-- one. These are created while approving a match and then behave like any
-- other tournament on the site. Run in Supabase → SQL Editor.

create table if not exists public.custom_tournaments (
  slug        text primary key,
  name        text not null,
  short_name  text not null,
  tier        integer not null default 2,
  status      text not null default 'upcoming' check (status in ('live', 'upcoming', 'finished')),
  start_at    timestamptz,
  end_at      timestamptz,
  location    text not null default 'Онлайн',
  online      boolean not null default true,
  prize_usd   integer not null default 0,
  format      text not null default '',
  accent      text not null default '#3B4C6B',
  cover_image text,
  created_at  timestamptz not null default now()
);

alter table public.custom_tournaments enable row level security;
-- Read is public: these show up in the catalog like any other tournament.
drop policy if exists "custom tournaments public read" on public.custom_tournaments;
create policy "custom tournaments public read"
  on public.custom_tournaments for select using (true);
-- No write policy — only the service role creates them.
