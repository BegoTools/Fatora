import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xlbunuzlvnbzmfuhuuna.supabase.co';
const supabaseAnonKey = 'sb_publishable_d23J02xg8mHofZR91WxaZA_wb4PwpEc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugRLS() {
  const { data: ownerAuth, error: ownerErr } = await supabase.auth.signInWithPassword({
    email: 'sss@gmail.com',
    password: 'ssssssss'
  });

  if (ownerErr || !ownerAuth.user) {
    console.error('Owner login failed', ownerErr);
    return;
  }

  console.log('Owner auth uid:', ownerAuth.user.id);

  // Test get_my_team_id RPC if exists
  const { data: teamIdData, error: teamIdErr } = await supabase.rpc('get_my_team_id');
  console.log('rpc get_my_team_id result:', teamIdData, teamIdErr);

  // Test is_my_team_owner RPC
  const { data: ownerMember } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', ownerAuth.user.id)
    .single();

  if (ownerMember) {
    const { data: isOwnerData, error: isOwnerErr } = await supabase.rpc('is_my_team_owner', {
      target_team_id: ownerMember.team_id
    });
    console.log('rpc is_my_team_owner result:', isOwnerData, isOwnerErr);
  }

  // Select team_invitations
  const { data: invites, error: selectErr } = await supabase.from('team_invitations').select('*');
  console.log('select from team_invitations:', invites, selectErr);
}

debugRLS();
