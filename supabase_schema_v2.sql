-- ============================================================
-- Easy Store ERP - Phase 1.1 Migration (Relational & Permissions)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Extend team_members if needed
alter table public.team_members 
add column if not exists status text default 'active',
add column if not exists invited_by uuid references auth.users(id);

-- 2. Permissions Table
create table if not exists public.permissions (
  id uuid default gen_random_uuid() primary key,
  team_member_id uuid references public.team_members(id) on delete cascade not null,
  module text not null,
  can_view boolean default false,
  can_create boolean default false,
  can_edit boolean default false,
  can_delete boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(team_member_id, module)
);

-- 3. Items (Inventory)
create table if not exists public.items (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  barcode text,
  name text not null,
  name_ar text not null,
  category_id text,
  unit text,
  purchase_price numeric not null default 0,
  sale_price numeric not null default 0,
  stock_quantity numeric not null default 0,
  min_stock_level numeric not null default 0,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Treasury Accounts
create table if not exists public.treasury_accounts (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  name text not null,
  name_ar text not null,
  type text not null,
  balance numeric not null default 0,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Sales Invoices
create table if not exists public.sales_invoices (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  invoice_number text not null,
  customer_id text,
  customer_name text,
  total numeric not null default 0,
  paid numeric not null default 0,
  remaining numeric not null default 0,
  payment_method text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text
);

-- Enable RLS
alter table public.permissions enable row level security;
alter table public.items enable row level security;
alter table public.treasury_accounts enable row level security;
alter table public.sales_invoices enable row level security;

-- Policies for permissions
create policy "Owners and Admins can manage permissions"
  on public.permissions
  for all
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
      and tm.team_id = (select team_id from public.team_members tm2 where tm2.id = permissions.team_member_id)
      and tm.role in ('owner', 'admin')
    )
  );

create policy "Users can view their own permissions"
  on public.permissions
  for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
      and tm.id = permissions.team_member_id
    )
  );

-- RLS helper function
create or replace function public.has_permission(req_module text, req_action text)
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 
    from public.team_members tm
    left join public.permissions p on p.team_member_id = tm.id and p.module = req_module
    where tm.user_id = auth.uid()
      and tm.team_id = public.get_my_team_id()
      and (
        tm.role = 'owner'
        or (
          req_action = 'view' and p.can_view = true
        ) or (
          req_action = 'create' and p.can_create = true
        ) or (
          req_action = 'edit' and p.can_edit = true
        ) or (
          req_action = 'delete' and p.can_delete = true
        )
      )
  );
$$;

-- Items Policies
create policy "View items if permitted" on public.items for select using (team_id = public.get_my_team_id() and public.has_permission('inventory', 'view'));
create policy "Create items if permitted" on public.items for insert with check (team_id = public.get_my_team_id() and public.has_permission('inventory', 'create'));
create policy "Edit items if permitted" on public.items for update using (team_id = public.get_my_team_id() and public.has_permission('inventory', 'edit'));
create policy "Delete items if permitted" on public.items for delete using (team_id = public.get_my_team_id() and public.has_permission('inventory', 'delete'));

-- Add to Realtime
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.team_members;
alter publication supabase_realtime add table public.permissions;
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.treasury_accounts;
alter publication supabase_realtime add table public.sales_invoices;
alter publication supabase_realtime add table public.team_data;
