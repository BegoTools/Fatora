-- ============================================================
-- Easy Store ERP - Safe Reset All Users in Supabase
-- قم بتشغيل هذا الكود في Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. مسح جميع المستخدمين من نظام Supabase Auth
-- (سيتم مسح البيانات المرتبطة تلقائياً في الجداول التي بها CASCADE)
TRUNCATE auth.users CASCADE;

-- 2. تنظيف آمن للجداول العامة المتبقية (يتحقق أولاً من وجود الجدول لمنع حدوث خطأ 42P01)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'permissions') THEN
        DELETE FROM public.permissions;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'team_members') THEN
        DELETE FROM public.team_members;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'team_data') THEN
        DELETE FROM public.team_data;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'teams') THEN
        DELETE FROM public.teams;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'team_invitations') THEN
        DELETE FROM public.team_invitations;
    END IF;
END $$;
