import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xlbunuzlvnbzmfuhuuna.supabase.co';
const supabaseAnonKey = 'sb_publishable_d23J02xg8mHofZR91WxaZA_wb4PwpEc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpdateMember() {
  const { data: ownerAuth } = await supabase.auth.signInWithPassword({
    email: 'sss@gmail.com',
    password: 'ssssssss'
  });

  if (!ownerAuth.user) {
    console.error('Owner login failed');
    return;
  }

  // Get owner member
  const { data: ownerMember } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', ownerAuth.user.id)
    .single();

  console.log('Owner member:', ownerMember);

  // Let's manually insert a test member into team_members (simulating existing employee)
  // Wait! Can owner insert directly into team_members? Let's check team_members insert policy!
  const fakeUserId = crypto.randomUUID();
  const { data: insertMem, error: insertMemErr } = await supabase
    .from('team_members')
    .insert([{
      team_id: ownerMember.team_id,
      user_id: fakeUserId,
      role: 'employee',
      email: 'fake_emp@example.com',
      name: 'Fake Employee'
    }])
    .select();

  console.log('Insert member result:', insertMem, insertMemErr);

  if (insertMem && insertMem.length > 0) {
    const memId = insertMem[0].id;
    console.log('Updating role to manager for member ID:', memId);

    const { data: updateRes, error: updateErr } = await supabase
      .from('team_members')
      .update({ role: 'manager' })
      .eq('id', memId)
      .select();

    console.log('Update member result:', updateRes, updateErr);

    // Clean up
    await supabase.from('team_members').delete().eq('id', memId);
  }
}

testUpdateMember();
