-- ============================================================
-- Easy Store ERP - Phase 2.1 Security Hardening
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Fix team_members UPDATE policy
-- Only owners and admins can update team members
create policy "Owners and Admins can update team members" 
  on public.team_members for update 
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
      and tm.team_id = team_members.team_id
      and tm.role in ('owner', 'admin')
    )
  );

-- Also need a DELETE policy for team_members
create policy "Owners can delete team members" 
  on public.team_members for delete 
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
      and tm.team_id = team_members.team_id
      and tm.role = 'owner'
    )
  );

-- 2. Add Constraints to Phase 1 Tables to prevent malicious inputs
alter table public.items 
  add constraint items_stock_check check (stock_quantity >= 0),
  add constraint items_min_stock_check check (min_stock_level >= 0),
  add constraint items_price_check check (purchase_price >= 0 and sale_price >= 0);

alter table public.sales_invoices
  add constraint sales_total_check check (total >= 0),
  add constraint sales_paid_check check (paid >= 0),
  add constraint sales_remaining_check check (remaining >= 0);

alter table public.treasury_accounts
  add constraint treasury_balance_check check (balance >= 0);

-- 3. Restrict team_data (Partial Fix)
-- NOTE: We cannot restrict UPDATE on team_data completely because the frontend
-- monolithic architecture requires employees to update it when they make a sale.
-- A true fix requires migrating all modules to relational tables.

-- However, we can add a check to prevent users from completely deleting team_data
create policy "Nobody can delete team data"
  on public.team_data for delete
  using (false);
