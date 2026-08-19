import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xlbunuzlvnbzmfuhuuna.supabase.co';
const supabaseAnonKey = 'sb_publishable_d23J02xg8mHofZR91WxaZA_wb4PwpEc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectSchema() {
  const { data: ownerAuth } = await supabase.auth.signInWithPassword({
    email: 'sss@gmail.com',
    password: 'ssssssss'
  });

  console.log('--- Testing table access ---');

  const tables = [
    'teams',
    'team_members',
    'team_data',
    'team_invitations',
    'permissions',
    'items',
    'treasury_accounts',
    'sales_invoices'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table '${table}': ERROR ${error.code} - ${error.message}`);
    } else {
      console.log(`✅ Table '${table}': Accessible (count: ${data.length})`);
    }
  }
}

inspectSchema();
