-- ============================================================
-- Easy Store ERP - Phase 1 Fix (Realtime Permissions Bug)
-- ============================================================
-- المشكلة: جدول permissions كان يفتقد لعمود team_id، وكانت سياسات الـ RLS 
-- تستخدم EXISTS مباشر، مما يجعل محرك Supabase Realtime يتجاهل الأحداث بصمت 
-- (لأنه لا يدعم الـ Joins/Subqueries المباشرة في الـ RLS).
-- 
-- الحل:
-- 1. إضافة team_id.
-- 2. إعادة كتابة الـ RLS لتعتمد على دوال SECURITY DEFINER بسيطة.

BEGIN;

-- 1. إضافة عمود team_id إذا لم يكن موجوداً
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'permissions' AND column_name = 'team_id') THEN
    ALTER TABLE public.permissions ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. تحديث الصفوف القديمة لربطها بالـ team الصحيح
UPDATE public.permissions p
SET team_id = tm.team_id
FROM public.team_members tm
WHERE p.team_member_id = tm.id
  AND p.team_id IS NULL;

-- 3. جعل العمود إجبارياً بعد تحديث البيانات
ALTER TABLE public.permissions ALTER COLUMN team_id SET NOT NULL;

-- 4. إزالة سياسات الـ RLS القديمة التي تمنع الـ Realtime
DROP POLICY IF EXISTS "Owners and Admins can manage permissions" ON public.permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.permissions;

-- 5. إنشاء سياسات جديدة تعتمد على دوال مبسطة تدعمها الـ Realtime
CREATE POLICY "Owners and Admins can manage permissions"
  ON public.permissions
  FOR ALL
  USING (
    team_id = public.get_my_team_id() 
    AND public.is_my_team_owner(team_id)
  );

CREATE POLICY "Users can view their own permissions"
  ON public.permissions
  FOR SELECT
  USING (
    team_id = public.get_my_team_id()
  );

-- 6. تأكيد تفعيل الـ Realtime لجدول permissions
-- We remove and re-add to ensure it is in the publication
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.permissions;

COMMIT;
