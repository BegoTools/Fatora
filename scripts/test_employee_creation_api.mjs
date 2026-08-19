import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xlbunuzlvnbzmfuhuuna.supabase.co';
const supabaseAnonKey = 'sb_publishable_d23J02xg8mHofZR91WxaZA_wb4PwpEc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'easy-store-employee-provisioning',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function runTest() {
  console.log('====================================================');
  console.log('STEP 1: Logging in as Owner (sss@gmail.com)');
  console.log('====================================================');

  const { data: ownerAuth, error: ownerErr } = await supabase.auth.signInWithPassword({
    email: 'sss@gmail.com',
    password: 'ssssssss'
  });

  if (ownerErr || !ownerAuth.user) {
    console.error('❌ Failed owner login:', ownerErr);
    return;
  }
  console.log('✅ Owner logged in successfully. User ID:', ownerAuth.user.id);

  // Get owner's team
  const { data: ownerMember, error: memErr } = await supabase
    .from('team_members')
    .select('id, team_id, role, name, email')
    .eq('user_id', ownerAuth.user.id)
    .single();

  if (memErr || !ownerMember) {
    console.error('❌ Failed to fetch owner team member:', memErr);
    return;
  }
  console.log('✅ Owner team member record:', ownerMember);

  console.log('\n====================================================');
  console.log('STEP 2: Creating Employee Account via adminCreateAccount flow');
  console.log('====================================================');

  const empEmail = `emp_test_${Date.now()}@example.com`;
  const empPassword = 'Password123!';
  const empName = 'موظف تجريبي';
  const initialRole = 'employee';

  const inviteToken = crypto.randomUUID();
  console.log(`Inserting invitation into team_invitations for email: ${empEmail}, role: ${initialRole}...`);

  const { data: invData, error: invitationError } = await supabase
    .from('team_invitations')
    .insert([{
      team_id: ownerMember.team_id,
      email: empEmail,
      name: empName,
      role: initialRole,
      token: inviteToken,
    }])
    .select();

  if (invitationError) {
    console.error('❌ Team invitation insertion error:', invitationError);
  } else {
    console.log('✅ Team invitation inserted successfully:', invData);
  }

  console.log('\nCalling authSupabase.auth.signUp for employee...');
  const { data: signUpData, error: signUpErr } = await authSupabase.auth.signUp({
    email: empEmail,
    password: empPassword,
    options: {
      data: { name: empName, invite_token: inviteToken },
    }
  });

  if (signUpErr) {
    console.error('❌ Employee signUp Error:', signUpErr);
  } else {
    console.log('✅ Employee signUp response user ID:', signUpData.user?.id);
    console.log('   Session returned:', !!signUpData.session);
  }

  // Check if team member was created by trigger or if trigger failed
  await new Promise(r => setTimeout(r, 1000));

  console.log('\nFetching employee from team_members table...');
  const { data: empMember, error: empMemErr } = await supabase
    .from('team_members')
    .select('*')
    .eq('email', empEmail);

  console.log('Employee team member query result:', empMember, empMemErr);

  console.log('\n====================================================');
  console.log('STEP 3: Testing syncUserPermissions for Employee');
  console.log('====================================================');

  if (empMember && empMember.length > 0) {
    const targetMemberId = empMember[0].id;
    console.log(`Attempting to upsert permissions for team_member_id: ${targetMemberId}...`);

    const samplePerms = [
      { team_member_id: targetMemberId, module: 'sales', can_view: true, can_create: true, can_edit: true, can_delete: true, updated_at: new Date().toISOString() },
      { team_member_id: targetMemberId, module: 'inventory', can_view: true, can_create: true, can_edit: true, can_delete: true, updated_at: new Date().toISOString() },
    ];

    const { data: permRes, error: permErr } = await supabase
      .from('permissions')
      .upsert(samplePerms, { onConflict: 'team_member_id, module' });

    if (permErr) {
      console.error('❌ Permissions upsert error:', permErr);
    } else {
      console.log('✅ Permissions upsert result:', permRes);
    }
  }

  console.log('\n====================================================');
  console.log('STEP 4: Testing updating role to "manager"');
  console.log('====================================================');

  if (empMember && empMember.length > 0) {
    const empUserId = empMember[0].user_id;
    console.log(`Updating role of user ${empUserId} from "${initialRole}" to "manager"...`);

    const { data: updateRes, error: updateErr } = await supabase
      .from('team_members')
      .update({ role: 'manager' })
      .eq('user_id', empUserId)
      .eq('team_id', ownerMember.team_id)
      .select('*');

    if (updateErr) {
      console.error('❌ Role update error:', updateErr);
    } else {
      console.log('✅ Role updated successfully:', updateRes);
    }
  }

  console.log('\n====================================================');
  console.log('STEP 5: Testing Login as newly created Employee');
  console.log('====================================================');

  const { data: empAuth, error: empAuthErr } = await supabase.auth.signInWithPassword({
    email: empEmail,
    password: empPassword,
  });

  if (empAuthErr) {
    console.error('❌ Employee Login Error:', empAuthErr);
  } else {
    console.log('✅ Employee logged in successfully. User ID:', empAuth.user?.id);
    
    // Check if employee can fetch their team member and permissions
    const { data: empTM, error: empTMErr } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', empAuth.user?.id)
      .single();

    console.log('Employee fetching own team_member record:', empTM, empTMErr);
  }

}

runTest();
