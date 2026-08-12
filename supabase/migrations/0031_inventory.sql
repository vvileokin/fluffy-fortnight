-- Player inventory: items won in giveaways or bought with points.
--
-- Read-only from the client. Items are granted by admin/server flows through
-- the service role, so there is deliberately no insert/update/delete policy
-- for `authenticated` — a player must never be able to mint themselves a
-- knife, the same reason `profiles.points` is frozen by trigger.

create table if not exists public.user_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  wear        text,
  rarity      text not null default 'common'
                check (rarity in ('common','uncommon','rare','mythical','legendary','covert')),
  image       text,
  source      text,
  created_at  timestamptz not null default now()
);

-- The only query the profile makes: this player's items, newest first.
create index if not exists user_items_user_created_idx
  on public.user_items (user_id, created_at desc);

alter table public.user_items enable row level security;

drop policy if exists "own items are readable" on public.user_items;
create policy "own items are readable"
  on public.user_items
  for select
  to authenticated
  using (auth.uid() = user_id);
