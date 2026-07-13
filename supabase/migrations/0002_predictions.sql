-- CS2 UA — user predictions + bounty picks. Run in Supabase → SQL Editor.

-- One row per (user, question). Answer to a match prediction question.
create table if not exists public.predictions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  question_id text not null,
  option_id   text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, question_id)
);

alter table public.predictions enable row level security;

create policy "users read own predictions"
  on public.predictions for select using (auth.uid() = user_id);
create policy "users insert own predictions"
  on public.predictions for insert with check (auth.uid() = user_id);
create policy "users update own predictions"
  on public.predictions for update using (auth.uid() = user_id);

-- Bounty predictor picks: which higher seed a lower seed is predicted to face.
create table if not exists public.bounty_picks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  stage_id   text not null,
  low_slug   text not null,
  high_slug  text not null,
  created_at timestamptz not null default now(),
  unique (user_id, stage_id, low_slug)
);

alter table public.bounty_picks enable row level security;

create policy "users read own bounty picks"
  on public.bounty_picks for select using (auth.uid() = user_id);
create policy "users insert own bounty picks"
  on public.bounty_picks for insert with check (auth.uid() = user_id);
create policy "users update own bounty picks"
  on public.bounty_picks for update using (auth.uid() = user_id);
