import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xlbunuzlvnbzmfuhuuna.supabase.co';
const supabaseKey = 'sb_publishable_d23J02xg8mHofZR91WxaZA_wb4PwpEc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("Starting Phase 2 Realtime Test...");
  
  const ownerEmail = `owner_${Date.now()}@example.com`;
  const empEmail = `emp_${Date.now()}@example.com`;
  const password = "password123";

  console.log("1. Signing up Owner...");
  const { data: ownerAuth, error: ownerErr } = await supabase.auth.signUp({
    email: ownerEmail,
    password,
    options: { data: { name: "Test Owner" } }
  });
  if (ownerErr) throw ownerErr;
  
  await new Promise(r => setTimeout(r, 2000));
  
  const { data: ownerMember } = await supabase.from('team_members').select('team_id').eq('user_id', ownerAuth.user.id).single();
  if (!ownerMember) throw new Error("Team member not created for owner");
  const teamId = ownerMember.team_id;
  console.log("Team ID:", teamId);

  const inviteToken = crypto.randomUUID();
  await supabase.from('team_invitations').insert({
    team_id: teamId,
    email: empEmail,
    name: 'Test Employee',
    role: 'employee',
    token: inviteToken
  });

  console.log("2. Creating Employee...");
  const { data: empAuth, error: empErr } = await supabase.auth.signUp({
    email: empEmail, password,
    options: { data: { invite_token: inviteToken } }
  });
  if (empErr) throw empErr;
  
  await new Promise(r => setTimeout(r, 2000));
  
  const { data: empMember, error: fetchErr } = await supabase.from('team_members').select('id').eq('user_id', empAuth.user.id).single();
  if (fetchErr) throw fetchErr;
  
  const empMemberId = empMember.id;
  console.log("Employee Member ID:", empMemberId);

  console.log("3. Employee subscribing to Broadcast channel...");
  const empSupabase = createClient(supabaseUrl, supabaseKey);
  await empSupabase.auth.signInWithPassword({ email: empEmail, password });
  
  const channel = empSupabase.channel(`team_${teamId}`);
  let received = false;
  let startWait = 0;
  
  channel.on('broadcast', { event: 'permissions_updated' }, (payload) => {
    const elapsed = Date.now() - startWait;
    console.log(`\n✅ SUCCESS! Employee received Live Update in ${elapsed}ms`);
    console.log("Payload:", payload);
    received = true;
  }).subscribe();

  await new Promise(r => setTimeout(r, 2000));

  console.log("4. Owner updating permissions...");
  startWait = Date.now();
  
  // const { error: upsertErr } = await supabase.from('permissions').upsert([{
  //   team_member_id: empMemberId,
  //   module: 'invoices',
  //   can_view: true, can_create: false, can_edit: false, can_delete: false,
  //   updated_at: new Date().toISOString()
  // }], { onConflict: 'team_member_id, module' });
  // if (upsertErr) throw upsertErr;

  console.log("Broadcasting from Owner...");
  const ownerSupabase = createClient(supabaseUrl, supabaseKey);
  await ownerSupabase.auth.signInWithPassword({ email: ownerEmail, password });
  
  const ownerChannel = ownerSupabase.channel(`team_${teamId}`);
  ownerChannel.subscribe();
  await new Promise(r => setTimeout(r, 1000));
  
  await ownerChannel.send({
    type: 'broadcast',
    event: 'permissions_updated',
    payload: { team_member_id: empMemberId }
  });

  for (let i=0; i<10; i++) {
    if (received) break;
    await new Promise(r => setTimeout(r, 500));
  }
  
  if (!received) console.log("❌ FAILED: Employee did not receive broadcast.");
  process.exit(0);
}

runTest().catch(console.error);
