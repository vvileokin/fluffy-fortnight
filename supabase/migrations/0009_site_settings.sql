-- CS2 UA — editable site content (promo banner + tournament cover overrides).
-- Single-row settings table. Run in Supabase → SQL Editor.

create table if not exists public.site_settings (
  id              int primary key default 1,
  promo_enabled   boolean not null default true,
  promo_image     text,
  promo_link_type text not null default 'tournament', -- tournament | match
  promo_target    text,
  covers          jsonb not null default '{}'::jsonb,  -- { "<tournament-slug>": "<image-url>" }
  updated_at      timestamptz not null default now(),
  constraint site_settings_single_row check (id = 1)
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "site settings public read" on public.site_settings;
create policy "site settings public read"
  on public.site_settings for select using (true);
