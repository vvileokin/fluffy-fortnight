-- CS2 UA — question resolutions (which option won). Run in Supabase SQL Editor.

create table if not exists public.question_results (
  question_id       text primary key,
  correct_option_id text not null,
  resolved_at       timestamptz not null default now()
);

alter table public.question_results enable row level security;

-- Public read so the UI can show correct/wrong; writes only via service-role API.
create policy "question results are public"
  on public.question_results for select using (true);
