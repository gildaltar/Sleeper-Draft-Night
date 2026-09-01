-- Team desks are tied to an authenticated Supabase user after a one-time
-- commissioner-issued claim code is verified by the team-access Edge Function.
create table if not exists public.team_owner_memberships (
  league_id text not null references public.broadcast_state(league_id) on delete cascade,
  roster_id integer not null check (roster_id between 1 and 32),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null check (char_length(owner_email) between 3 and 320),
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, roster_id),
  unique (league_id, user_id)
);

alter table public.team_owner_memberships enable row level security;
revoke all on table public.team_owner_memberships from anon;
grant select on table public.team_owner_memberships to authenticated;

create policy team_owners_read_own_membership
on public.team_owner_memberships for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.commissioners commissioner
    where commissioner.user_id = (select auth.uid())
  )
);

create or replace function public.revoke_team_owner(p_league_id text, p_roster_id integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.commissioners commissioner where commissioner.user_id = auth.uid()
  ) then
    raise exception 'Commissioner access required';
  end if;

  delete from public.team_owner_memberships
  where league_id = p_league_id and roster_id = p_roster_id;
  return found;
end;
$$;

revoke all on function public.revoke_team_owner(text, integer) from public;
grant execute on function public.revoke_team_owner(text, integer) to authenticated;

alter table public.broadcast_state
  drop constraint if exists broadcast_state_video_provider_check;

alter table public.broadcast_state
  alter column video_provider set default 'livekit';

update public.broadcast_state
set video_provider = 'livekit',
    camera_room = coalesce(nullif(camera_room, ''), 'draft-' || league_id),
    video_join_url = null,
    updated_at = now();

alter table public.broadcast_state
  add constraint broadcast_state_video_provider_check
  check (video_provider in ('livekit','native_preview'));

create index if not exists team_owner_memberships_user_lookup
  on public.team_owner_memberships (user_id, league_id);
