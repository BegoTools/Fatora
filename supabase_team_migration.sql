-- Easy Store ERP: secure team provisioning and data isolation migration.
-- Run this file once in Supabase Dashboard > SQL Editor, before publishing.

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null,
  token uuid not null unique,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (team_id, email)
);

-- A person can be a member of only one workspace. This also prevents the
-- historic provisioning bug where an employee received both a private team
-- and an owner-team membership.
delete from public.team_members a
using public.team_members b
where a.user_id = b.user_id
  and a.team_id <> b.team_id
  and a.created_at > b.created_at;

create unique index if not exists team_members_one_team_per_user
  on public.team_members (user_id);

alter table public.team_members drop constraint if exists team_members_role_check;

alter table public.team_invitations enable row level security;

create or replace function public.is_my_team_owner(target_team_id uuid)
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 from public.teams
    where id = target_team_id and owner_id = auth.uid()
  );
$$;

drop policy if exists "Team owners can create invitations" on public.team_invitations;
create policy "Team owners can create invitations"
  on public.team_invitations for insert
  with check (
    team_id = public.get_my_team_id()
    and public.is_my_team_owner(team_id)
  );

drop policy if exists "Team owners can delete invitations" on public.team_invitations;
create policy "Team owners can delete invitations"
  on public.team_invitations for delete
  using (
    team_id = public.get_my_team_id()
    and public.is_my_team_owner(team_id)
  );

-- The sign-up trigger only trusts a server-side invitation that matches the
-- new user's email. Arbitrary user_metadata can no longer attach an account
-- to a different team's data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_team_id uuid;
  user_name text;
  invitation public.team_invitations%rowtype;
  invite_token uuid;
begin
  user_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  begin
    invite_token := nullif(new.raw_user_meta_data->>'invite_token', '')::uuid;
  exception when invalid_text_representation then
    invite_token := null;
  end;

  if invite_token is not null then
    select * into invitation
    from public.team_invitations
    where token = invite_token and lower(email) = lower(new.email)
    for update;
  end if;

  if found then
    insert into public.team_members (team_id, user_id, role, email, name)
    values (invitation.team_id, new.id, invitation.role, new.email, invitation.name);
    delete from public.team_invitations where id = invitation.id;
  else
    insert into public.teams (name, owner_id)
    values (user_name || '''s Team', new.id)
    returning id into new_team_id;

    insert into public.team_members (team_id, user_id, role, email, name)
    values (new_team_id, new.id, 'owner', new.email, user_name);

    insert into public.team_data (team_id, state_json)
    values (new_team_id, '{}'::jsonb);
  end if;
  return new;
end;
$$;
