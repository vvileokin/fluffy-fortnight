-- CS2 UA — назви команд для текстів бота, окремо від того, що малює сайт.
-- Run in Supabase → SQL Editor. Requires 0058.
--
-- The bot writes its own sentences in SQL and needs a team's real name for
-- them. The obvious place looked like `matches.team_a_name` — and filling that
-- in took every logo off the match cards, because the column is an *override*
-- for teams the front end does not know: setting it makes the card build a
-- synthetic team with no logo and a tag cut from the first four letters.
-- Vitality became VITA, Inner Circle became INNE.
--
-- So the front end keeps its own registry as the single source of what a team
-- looks like, and this table exists only so a sentence written in the database
-- can say "Inner Circle" rather than initcap of a slug. Nothing renders from
-- it. It is a phrasebook, not a registry.

create table if not exists public.team_names (
  slug text primary key,
  name text not null
);

alter table public.team_names enable row level security;

drop policy if exists "team names readable" on public.team_names;
create policy "team names readable" on public.team_names for select using (true);

insert into public.team_names (slug, name) values
  ('b8', 'B8'),
  ('natus', 'Natus Vincere'),
  ('big', 'BIG'),
  ('betboom', 'BetBoom Team'),
  ('flyquest', 'FlyQuest'),
  ('gaimin', 'Gaimin Gladiators'),
  ('gamerlegion', 'GamerLegion'),
  ('heroic', 'HEROIC'),
  ('lynn', 'Lynn Vision'),
  ('m80', 'M80'),
  ('mibr', 'MIBR'),
  ('nrg', 'NRG'),
  ('sinners', 'SINNERS'),
  ('sharks', 'DENDELE'),
  ('thunder', 'THUNDERTDU'),
  ('liquid', 'Liquid'),
  ('tyloo', 'TYLOO'),
  ('vitality', 'Vitality'),
  ('spirit', 'Spirit'),
  ('falcons', 'Falcons'),
  ('mouz', 'MOUZ'),
  ('mongolz', 'The MongolZ'),
  ('aurora', 'Aurora'),
  ('astralis', 'Astralis'),
  ('furia', 'FURIA'),
  ('fut', 'FUT'),
  ('g2', 'G2'),
  ('nemiga', 'Nemiga'),
  ('magic', 'magic'),
  ('pain', 'paiN'),
  ('faze', 'FaZe'),
  ('nip', 'Ninjas in Pyjamas'),
  ('wildcard', 'Wildcard'),
  ('threedmax', '3DMAX'),
  ('alliance', 'Alliance'),
  ('gentlemates', 'Gentle Mates'),
  ('hotu', 'HOTU'),
  ('nemesis', 'Nemesis'),
  ('fokus', 'FOKUS'),
  ('nucleartigers', 'Nuclear TigeRES'),
  ('eyeballers', 'EYEBALLERS'),
  ('hundredthieves', '100 Thieves'),
  ('og', 'OG'),
  ('ninez', '9z'),
  ('jijiehao', 'JiJieHao'),
  ('k27', 'K27'),
  ('legacy', 'Legacy'),
  ('luminosity', 'LUMINOSITY'),
  ('parivision', 'PARIVISION'),
  ('innercircle', 'Inner Circle')
on conflict (slug) do update set name = excluded.name;

-- One fixture, spelled the way a person would say it. `team_a_name` still wins
-- where it is set, so a one-off team that never reaches the registry keeps
-- working.
create or replace function public.match_label(p_match text)
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(m.team_a_name, ta.name, initcap(m.team_a)) || ' vs. ' ||
         coalesce(m.team_b_name, tb.name, initcap(m.team_b))
    from public.matches m
    left join public.team_names ta on ta.slug = m.team_a
    left join public.team_names tb on tb.slug = m.team_b
   where m.id = p_match;
$$;

grant execute on function public.match_label(text) to anon, authenticated, service_role;
