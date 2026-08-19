import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env manually if process.env isn't populated
let envVars = {};
if (fs.existsSync('.env')) {
  const content = fs.readFileSync('.env', 'utf8');
  content.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) envVars[key.trim()] = vals.join('=').trim();
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || envVars.VITE_SUPABASE_URL || 'https://xlbunuzlvnbzmfuhuuna.supabase.co';
// Service role key is required for admin actions (deleting users from auth.users)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY || process.argv[2];

if (!serviceRoleKey) {
  console.error('\n❌ لم يتم العثور على SUPABASE_SERVICE_ROLE_KEY');
  console.log('\n📌 لاستخدام هذا السكريبت، يرجى التمرير كـ Argument أو إضافته لملف .env:');
  console.log('   node clean_supabase_users.mjs YOUR_SUPABASE_SERVICE_ROLE_KEY\n');
  console.log('أو يمكنك استخدام خيار SQL Editor في لوحة تحكم Supabase عبر تشغيل كود reset_supabase_users.sql.\n');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanAllUsers() {
  console.log('🚀 جاري الاتصال بـ Supabase لمسح كافة الحسابات والمستخدمين...\n');

  try {
    // 1. Fetch all users from Supabase Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('❌ خطأ في جلب المستخدمين:', listError.message);
      return;
    }

    console.log(`📋 عدد المستخدمين المسجلين في auth.users: ${users.length}`);

    // Delete each user
    for (const user of users) {
      console.log(`🗑️ جاري حذف المستخدم: ${user.email} (ID: ${user.id})...`);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`❌ فشل حذف المستخدم ${user.email}:`, deleteError.message);
      } else {
        console.log(`✅ تم حذف المستخدم ${user.email} بنجاح.`);
      }
    }

    // 2. Clear public tables (team_members, permissions, teams, team_data)
    console.log('\n🧹 جاري تنظيف الجداول العامة (public tables)...');

    const { error: permErr } = await supabaseAdmin.from('permissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (permErr) console.log('ملاحظة تنظيف الصلاحيات:', permErr.message);

    const { error: tmErr } = await supabaseAdmin.from('team_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (tmErr) console.log('ملاحظة تنظيف الأعضاء:', tmErr.message);

    const { error: tdErr } = await supabaseAdmin.from('team_data').delete().neq('team_id', '00000000-0000-0000-0000-000000000000');
    if (tdErr) console.log('ملاحظة تنظيف بيانات الفرق:', tdErr.message);

    const { error: tErr } = await supabaseAdmin.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (tErr) console.log('ملاحظة تنظيف الفرق:', tErr.message);

    console.log('\n✨ اكتملت عملية مسح جميع المستخدمين والبيانات بنجاح!');

  } catch (err) {
    console.error('❌ حدث خطأ غير متوقع:', err);
  }
}

cleanAllUsers();
