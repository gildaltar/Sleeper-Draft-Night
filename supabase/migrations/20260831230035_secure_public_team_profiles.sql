-- Public broadcast clients need visual team identity, never password material.
-- Remove base-table reads and expose only a stable, explicitly shaped RPC.
revoke select on table public.team_profiles from anon, authenticated;

drop function if exists public.get_team_profiles_public(text);

create function public.get_team_profiles_public(p_league_id text)
returns table (
  league_id text,
  roster_id integer,
  team_name text,
  accent text,
  accent_2 text,
  panel_style text,
  motto text,
  badge text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    profile.league_id,
    profile.roster_id,
    profile.team_name,
    profile.accent,
    profile.accent_2,
    profile.panel_style,
    profile.motto,
    profile.badge,
    profile.updated_at
  from public.team_profiles as profile
  where profile.league_id = p_league_id
  order by profile.roster_id;
$$;

revoke all on function public.get_team_profiles_public(text) from public;
grant execute on function public.get_team_profiles_public(text) to anon, authenticated, service_role;
