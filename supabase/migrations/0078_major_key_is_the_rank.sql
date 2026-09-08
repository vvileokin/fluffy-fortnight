-- CS2 UA — ключ прогнозу це номер у рейтингу, а не назва команди.
-- Run in Supabase → SQL Editor. Requires 0077.
--
-- 0077 keyed the projection on (region, team), which reads as obviously right
-- and is obviously wrong the moment you look at the data. HLTV's standings
-- carry four hundred teams and a dozen of those names belong to two different
-- sides: two CYBERSHOKE in Europe eighty places apart, two Ninjas in Pyjamas,
-- two Phantom, two Rare Atom. The first push failed on the primary key, which
-- is the good outcome — the alternative was one of each pair silently
-- overwriting the other and the page showing an academy roster's numbers under
-- a first team's name.
--
-- This is the sixth time the same collision has bitten this project. It put one
-- Ninjas in Pyjamas' entire tournament calendar onto another in the model; it
-- crossed two players called Олег in a Telegram send; it wrote HOTU out of
-- their own qualifier by handing them a namesake's rating. The rule that comes
-- out of it: a name is never a key.
--
-- The rank is. HLTV number every team in one global list, and that number is
-- unique across all of them by construction — it is a position, and two teams
-- cannot hold the same one. The name stays as a column, indexed for lookup,
-- carrying no promise of being unique because it is not.

alter table public.major_projection
  add column if not exists vrs_rank integer;

-- Empty in practice — the first push never landed — but written to survive the
-- case where it partly did.
delete from public.major_projection where vrs_rank is null;

alter table public.major_projection
  alter column vrs_rank set not null;

alter table public.major_projection
  drop constraint if exists major_projection_pkey;

alter table public.major_projection
  add constraint major_projection_pkey primary key (vrs_rank);

-- The name is still how a reader finds a team, so it keeps an index. Not a
-- unique one.
create index if not exists major_projection_team
  on public.major_projection (region, team);
