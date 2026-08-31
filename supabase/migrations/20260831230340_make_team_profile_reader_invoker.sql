-- Let the safe reader run with caller rights. Callers receive column-level access
-- to broadcast identity only; password_hash remains inaccessible by construction.
grant select (
  league_id,
  roster_id,
  team_name,
  accent,
  accent_2,
  panel_style,
  motto,
  badge,
  updated_at
) on table public.team_profiles to anon, authenticated;

alter function public.get_team_profiles_public(text) security invoker;
