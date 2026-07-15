-- CS2 UA — admin-managed giveaways + entries. Run in Supabase → SQL Editor.

create table if not exists public.giveaways (
  slug        text primary key,
  prize       text not null,
  sponsor     text,
  value_usd   integer not null default 0,
  end_label   text,
  end_iso     timestamptz,
  entrants    integer not null default 0,
  min_points  integer not null default 0,
  status      text not null default 'open',   -- open | ending | finished
  cover       text not null default 'oklch(0.64 0.235 24)',
  image       text,
  description text,
  conditions  jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.giveaways enable row level security;
create policy "giveaways are public" on public.giveaways for select using (true);

create table if not exists public.giveaway_entries (
  id            uuid primary key default gen_random_uuid(),
  giveaway_slug text not null references public.giveaways (slug) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  confirmed     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (giveaway_slug, user_id)
);

alter table public.giveaway_entries enable row level security;
create policy "users read own entries"
  on public.giveaway_entries for select using (auth.uid() = user_id);
create policy "users insert own entries"
  on public.giveaway_entries for insert with check (auth.uid() = user_id);

-- Seed the current demo giveaways so the site isn't empty right after migrating.
insert into public.giveaways (slug, prize, sponsor, value_usd, end_label, entrants, min_points, status, cover, description, conditions)
values
  ('ak-nightwish', 'AK-47 | Nightwish (FN)', 'CS2 UA × SkinHub', 340, 'до 20 лип', 2840, 500, 'open',
   'oklch(0.64 0.235 24)',
   'Розігруємо AK-47 | Nightwish у Factory New серед активних учасників спільноти.',
   '["Підписка на Telegram і Instagram CS2 UA","Мінімум 500 поінтів у поточному сезоні","Відкритий для трейду Steam-акаунт"]'::jsonb),
  ('awp-dragon', 'AWP | Dragon Lore', 'BLAST Bounty S2', 9800, 'завершується завтра', 5210, 1000, 'ending',
   'oklch(0.82 0.13 88)',
   'Легендарний AWP | Dragon Lore до старту BLAST Bounty S2.',
   '["Активна участь у bounty-прогнозах BLAST Bounty","Мінімум 1000 поінтів у сезоні","Один акаунт — одна заявка"]'::jsonb)
on conflict (slug) do nothing;
