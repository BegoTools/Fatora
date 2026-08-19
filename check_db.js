import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://xlbunuzlvnbzmfuhuuna.supabase.co';
const supabaseKey = 'sb_publishable_d23J02xg8mHofZR91WxaZA_wb4PwpEc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('team_members').select('*').limit(1);
  console.log("Team members:", error || "Exists");
  const { data: p, error: pe } = await supabase.from('permissions').select('*').limit(1);
  console.log("Permissions:", pe || "Exists");
}
check();
