create table if not exists public.audio_cues (
  league_id text not null references public.broadcast_state(league_id) on delete cascade,
  cue text not null check (cue in ('opening','pick-in','pick-reveal','draft-start','draft-end','announcement','alert','trade','round-break','celebration')),
  file_name text not null,
  storage_path text not null,
  public_url text not null,
  mime_type text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (league_id,cue)
);
create index if not exists audio_cues_updated_by_idx on public.audio_cues(updated_by);
alter table public.audio_cues enable row level security;
grant select on public.audio_cues to anon,authenticated;
grant insert,update,delete on public.audio_cues to authenticated;
create policy audio_cues_public_read on public.audio_cues for select using (true);
create policy audio_cues_commissioner_insert on public.audio_cues for insert to authenticated with check (exists (select 1 from public.commissioners c where c.user_id=(select auth.uid())));
create policy audio_cues_commissioner_update on public.audio_cues for update to authenticated using (exists (select 1 from public.commissioners c where c.user_id=(select auth.uid()))) with check (exists (select 1 from public.commissioners c where c.user_id=(select auth.uid())));
create policy audio_cues_commissioner_delete on public.audio_cues for delete to authenticated using (exists (select 1 from public.commissioners c where c.user_id=(select auth.uid())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('draft-audio','draft-audio',true,15728640,array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/vnd.wave','audio/mp4','audio/x-m4a','audio/m4a','audio/aac','audio/x-aac','audio/ogg','audio/webm','audio/flac','audio/x-flac'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy draft_audio_public_read on storage.objects for select using (bucket_id='draft-audio');
create policy draft_audio_commissioner_insert on storage.objects for insert to authenticated with check (bucket_id='draft-audio' and exists (select 1 from public.commissioners c where c.user_id=(select auth.uid())));
create policy draft_audio_commissioner_update on storage.objects for update to authenticated using (bucket_id='draft-audio' and exists (select 1 from public.commissioners c where c.user_id=(select auth.uid()))) with check (bucket_id='draft-audio' and exists (select 1 from public.commissioners c where c.user_id=(select auth.uid())));
create policy draft_audio_commissioner_delete on storage.objects for delete to authenticated using (bucket_id='draft-audio' and exists (select 1 from public.commissioners c where c.user_id=(select auth.uid())));
alter publication supabase_realtime add table public.audio_cues;
