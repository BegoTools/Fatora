import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xlbunuzlvnbzmfuhuuna.supabase.co';
const supabaseAnonKey = 'sb_publishable_d23J02xg8mHofZR91WxaZA_wb4PwpEc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testVariations() {
  const { data: ownerAuth } = await supabase.auth.signInWithPassword({
    email: 'sss@gmail.com',
    password: 'ssssssss'
  });

  const ownerId = ownerAuth.user.id;
  console.log('Owner ID:', ownerId);

  const { data: ownerMember } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', ownerId)
    .single();

  console.log('Owner member:', ownerMember);

  const { data: teamData } = await supabase
    .from('teams')
    .select('*')
    .eq('id', ownerMember.team_id)
    .single();

  console.log('Team data:', teamData);

  // Test inserting invitation with exact team_id
  const inviteToken = crypto.randomUUID();
  const insertPayload = {
    team_id: ownerMember.team_id,
    email: 'test_var_1@example.com',
    name: 'Test Name',
    role: 'employee',
    token: inviteToken,
  };

  console.log('Insert payload:', insertPayload);

  const res = await supabase.from('team_invitations').insert([insertPayload]).select();
  console.log('Insert res:', res);
}

testVariations();
