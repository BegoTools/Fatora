-- ============================================================
-- Easy Store ERP - الإصلاح الكامل لإدارة الموظفين والصلاحيات في Supabase
-- قم بتشغيل هذا الكود في Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. إنشاء جدول الدعوات (team_invitations) إذا لم يكن موجوداً
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

-- 2. إنشاء جدول الصلاحيات (permissions) إذا لم يكن موجوداً
create table if not exists public.permissions (
  id uuid default gen_random_uuid() primary key,
  team_member_id uuid references public.team_members(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade,
  module text not null,
  can_view boolean default false,
  can_create boolean default false,
  can_edit boolean default false,
  can_delete boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(team_member_id, module)
);

-- إضافة عمود team_id إذا كان الجدول موجوداً من قبل بدونه
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'permissions' AND column_name = 'team_id') THEN
    ALTER TABLE public.permissions ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
  END IF;
END $$;

-- تحديث الصفوف القديمة لربطها بالـ team الصحيح
UPDATE public.permissions p
SET team_id = tm.team_id
FROM public.team_members tm
WHERE p.team_member_id = tm.id
  AND p.team_id IS NULL;

-- 3. إزالة قيد الأدوار القديم الذي يمنع استخدام الرتب الجديدة
alter table public.team_members drop constraint if exists team_members_role_check;

-- ضمان أن كل مستخدم ينتمي لفريق واحد فقط
create unique index if not exists team_members_one_team_per_user
  on public.team_members (user_id);

-- 4. تفعيل حماية الصفوف (RLS) على الجداول
alter table public.team_invitations enable row level security;
alter table public.permissions enable row level security;
alter table public.team_members enable row level security;
alter table public.teams enable row level security;

-- 4. إصلاح سياسات RLS لجدول الدعوات (team_invitations)
drop policy if exists "Team owners can create invitations" on public.team_invitations;
drop policy if exists "Team owners can view invitations" on public.team_invitations;
drop policy if exists "Team owners can delete invitations" on public.team_invitations;

create policy "Team owners can view invitations"
  on public.team_invitations for select
  using (
    team_id = public.get_my_team_id()
    and public.get_my_role() in ('owner', 'admin')
  );

create policy "Team owners can create invitations"
  on public.team_invitations for insert
  with check (
    team_id = public.get_my_team_id()
    and public.get_my_role() in ('owner', 'admin')
  );

create policy "Team owners can delete invitations"
  on public.team_invitations for delete
  using (
    team_id = public.get_my_team_id()
    and public.get_my_role() in ('owner', 'admin')
  );

-- 5. إصلاح سياسات RLS لجدول أعضاء الفريق (team_members)
drop policy if exists "Owners and Admins can update team members" on public.team_members;
drop policy if exists "Owners can delete team members" on public.team_members;
drop policy if exists "Users can view members of their team" on public.team_members;

create policy "Users can view members of their team"
  on public.team_members for select
  using (
    user_id = auth.uid() or team_id = public.get_my_team_id()
  );

create or replace function public.get_my_role()
returns text
language sql
security definer set search_path = public
as $$
  select role from public.team_members where user_id = auth.uid() limit 1;
$$;

create policy "Owners and Admins can update team members" 
  on public.team_members for update 
  using (
    team_id = public.get_my_team_id()
    and public.get_my_role() in ('owner', 'admin')
  );

create policy "Owners can delete team members" 
  on public.team_members for delete 
  using (
    team_id = public.get_my_team_id()
    and public.get_my_role() = 'owner'
    and role <> 'owner'
  );

-- 6. إصلاح سياسات RLS لجدول الصلاحيات (permissions)
drop policy if exists "Owners and Admins can manage permissions" on public.permissions;
drop policy if exists "Users can view their own permissions" on public.permissions;

-- Use team_id directly for Realtime compatibility (no subqueries)
create policy "Owners and Admins can manage permissions"
  on public.permissions
  for all
  using (
    team_id = public.get_my_team_id()
    and public.get_my_role() in ('owner', 'admin')
  );

create policy "Users can view their own permissions"
  on public.permissions
  for select
  using (
    team_id = public.get_my_team_id()
  );

-- 7. تحديث التريجر المباشر (handle_new_user) لربط الموظف بالفريق المطلوب تلقائياً
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
    -- إضافة المستخدم للمتجر/الفريق التابع للمالك
    insert into public.team_members (team_id, user_id, role, email, name)
    values (invitation.team_id, new.id, invitation.role, new.email, invitation.name);
    
    -- حذف الدعوة المستعملة
    delete from public.team_invitations where id = invitation.id;
  else
    -- في حالة التسجيل العادي (صاحب متجر جديد)
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

-- إعادة ربط التريجر مع auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 8. تحديث منشور Realtime للثبات
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.team_members;
alter publication supabase_realtime add table public.permissions;
alter publication supabase_realtime add table public.team_data;
