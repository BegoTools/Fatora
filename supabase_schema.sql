-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Teams Table
create table if not exists public.teams (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references auth.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Team Members Table
create table if not exists public.team_members (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('owner', 'manager', 'employee')),
  email text,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(team_id, user_id)
);

-- Team Data Table (stores AppState JSON)
create table if not exists public.team_data (
  team_id uuid primary key references public.teams(id) on delete cascade not null,
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Helper function to prevent RLS recursion
create or replace function public.get_my_team_id()
returns uuid
language sql
security definer set search_path = public
as $$
  select team_id from public.team_members where user_id = auth.uid() limit 1;
$$;

-- Enable RLS
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_data enable row level security;

-- Policies for Teams
drop policy if exists "Users can view teams they belong to" on public.teams;
create policy "Users can view teams they belong to" 
  on public.teams for select 
  using (
    id = public.get_my_team_id()
  );

drop policy if exists "Owners can insert teams" on public.teams;
create policy "Owners can insert teams" 
  on public.teams for insert 
  with check (auth.uid() = owner_id);

-- Policies for Team Members (Using get_my_team_id to prevent recursion)
drop policy if exists "Users can view members of their team" on public.team_members;
create policy "Users can view members of their team" 
  on public.team_members for select 
  using (
    user_id = auth.uid() or team_id = public.get_my_team_id()
  );

drop policy if exists "Owners can insert team members" on public.team_members;
create policy "Owners can insert team members" 
  on public.team_members for insert 
  with check (
    team_id = public.get_my_team_id() or user_id = auth.uid()
  );

-- Policies for Team Data
drop policy if exists "Users can view their team data" on public.team_data;
create policy "Users can view their team data" 
  on public.team_data for select 
  using (
    team_id = public.get_my_team_id()
  );

drop policy if exists "Users can update their team data" on public.team_data;
create policy "Users can update their team data" 
  on public.team_data for update 
  using (
    team_id = public.get_my_team_id()
  );

drop policy if exists "Owners can insert team data" on public.team_data;
create policy "Owners can insert team data" 
  on public.team_data for insert 
  with check (
    team_id = public.get_my_team_id()
  );

-- Automatic Trigger Function to handle new user registration seamlessly on the server
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_team_id uuid;
  user_name text;
begin
  user_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  -- If user is not already linked to a team, create a new Team for them
  if not exists (select 1 from public.team_members where user_id = new.id) then
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

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
