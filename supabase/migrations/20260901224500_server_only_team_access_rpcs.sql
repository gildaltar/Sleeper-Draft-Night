-- Team access RPCs contain password hashes or elevated writes. They are called
-- only by the authenticated team-access Edge Function using the service role.
revoke all on function public.set_team_password(text, integer, text) from public, anon, authenticated;
revoke all on function public.clear_team_password(text, integer) from public, anon, authenticated;
revoke all on function public.revoke_team_owner(text, integer) from public, anon, authenticated;

grant execute on function public.set_team_password(text, integer, text) to service_role;
grant execute on function public.clear_team_password(text, integer) to service_role;
grant execute on function public.revoke_team_owner(text, integer) to service_role;
