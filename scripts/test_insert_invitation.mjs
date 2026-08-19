import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xlbunuzlvnbzmfuhuuna.supabase.co';
const supabaseAnonKey = 'sb_publishable_d23J02xg8mHofZR91WxaZA_wb4PwpEc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const { data: ownerAuth } = await supabase.auth.signInWithPassword({
    email: 'sss@gmail.com',
    password: 'ssssssss'
  });

  const { data: ownerMember } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', ownerAuth.user.id)
    .single();

  console.log('Inserting into team_invitations with team_id:', ownerMember.team_id);
  const inviteToken = crypto.randomUUID();

  const { data, error } = await supabase
    .from('team_invitations')
    .insert([{
      team_id: ownerMember.team_id,
      email: 'test_insert@example.com',
      name: 'Test Name',
      role: 'employee',
      token: inviteToken,
    }])
    .select();

  console.log('Insert result:', data, error);
}

testInsert();
