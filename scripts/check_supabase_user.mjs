import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xlbunuzlvnbzmfuhuuna.supabase.co';
const supabaseAnonKey = 'sb_publishable_d23J02xg8mHofZR91WxaZA_wb4PwpEc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUser() {
  console.log('--- Checking Owner Account Login ---');
  const email = 'sss@gmail.com';
  const password = 'ssssssss';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('❌ Owner Login Error:', error);
    return;
  }

  console.log('✅ Owner Login Successful!');
  console.log('User ID:', data.user.id);
  console.log('User Email:', data.user.email);

  // Check team_members
  const { data: member, error: memberErr } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', data.user.id);

  console.log('Team Members record:', member, memberErr);

  // Check teams
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('*');
  console.log('Teams record:', teams, teamsErr);

  // Check team_invitations
  const { data: invites, error: invitesErr } = await supabase
    .from('team_invitations')
    .select('*');
  console.log('Invitations:', invites, invitesErr);

  // Check permissions
  const { data: perms, error: permsErr } = await supabase
    .from('permissions')
    .select('*');
  console.log('Permissions:', perms, permsErr);
}

checkUser();
