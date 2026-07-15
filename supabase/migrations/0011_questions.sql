-- CS2 UA — admin-created prediction questions, tied to a match. Run in Supabase.

create table if not exists public.questions (
  id             text primary key,
  match_id       text not null references public.matches (id) on delete cascade,
  kind           text not null default 'custom',    -- match_winner | exact_score | map_winner | player_stat | custom
  title          text not null,
  difficulty     text not null default 'medium',    -- easy | medium | hard
  status         text not null default 'open',      -- open | upcoming | locked | resolved
  deadline_label text,
  options        jsonb not null default '[]'::jsonb, -- [{ id, label, sublabel?, reward }]
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists questions_match_idx on public.questions (match_id);

alter table public.questions enable row level security;

drop policy if exists "questions public read" on public.questions;
create policy "questions public read"
  on public.questions for select using (true);
