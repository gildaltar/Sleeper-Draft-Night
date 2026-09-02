create table if not exists public.team_password_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  league_id text not null,
  roster_id integer not null check (roster_id between 1 and 32),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  foreign key (league_id,roster_id) references public.team_profiles(league_id,roster_id) on delete cascade
);
create index if not exists team_password_sessions_team_idx on public.team_password_sessions(league_id,roster_id,expires_at);
alter table public.team_password_sessions enable row level security;
revoke all on public.team_password_sessions from anon,authenticated;
grant all on public.team_password_sessions to service_role;

create or replace function public.set_team_password(p_league_id text,p_roster_id integer,p_password text)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' and (auth.uid() is null or not exists (select 1 from public.commissioners c where c.user_id=auth.uid())) then raise exception 'Commissioner access required'; end if;
  if length(coalesce(p_password,'')) < 6 or length(p_password) > 72 then raise exception 'Team password must be 6 to 72 characters'; end if;
  update public.team_profiles set password_hash=extensions.crypt(p_password,extensions.gen_salt('bf',11)),updated_at=now() where league_id=p_league_id and roster_id=p_roster_id;
  if not found then raise exception 'Team not found'; end if;
  delete from public.team_password_sessions where league_id=p_league_id and roster_id=p_roster_id;
  update public.broadcast_state set updated_at=now() where league_id=p_league_id;
  return true;
end;
$$;
revoke all on function public.set_team_password(text,integer,text) from public,anon,authenticated;
grant execute on function public.set_team_password(text,integer,text) to service_role;
