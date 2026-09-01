revoke all on function public.clear_team_password(text, integer) from public, anon;
grant execute on function public.clear_team_password(text, integer) to authenticated;

create index playlist_items_league_id_idx on public.playlist_items(league_id);

drop policy if exists commissioners_manage_playlist on public.playlist_items;
create policy commissioners_update_playlist
on public.playlist_items for update to authenticated
using (exists (select 1 from public.commissioners c where c.user_id = (select auth.uid())))
with check (exists (select 1 from public.commissioners c where c.user_id = (select auth.uid())));
create policy commissioners_delete_playlist
on public.playlist_items for delete to authenticated
using (exists (select 1 from public.commissioners c where c.user_id = (select auth.uid())));
