do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'playlist_items'
  ) then
    alter publication supabase_realtime add table public.playlist_items;
  end if;
end
$$;
