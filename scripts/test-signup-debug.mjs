import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xlbunuzlvnbzmfuhuuna.supabase.co';
const supabaseAnonKey = 'sb_publishable_d23J02xg8mHofZR91WxaZA_wb4PwpEc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignUp() {
  console.log('Testing SignUp directly with Supabase URL & Key...');
  const { data, error } = await supabase.auth.signUp({
    email: 'test_debug_owner@example.com',
    password: 'Password123!',
    options: {
      data: { name: 'Test Owner' }
    }
  });

  if (error) {
    console.error('❌ RAW SUPABASE ERROR:', JSON.stringify(error, null, 2));
    console.error('Error Message:', error.message);
    console.error('Error Status:', error.status);
    console.error('Error Name:', error.name);
  } else {
    console.log('✅ SIGNUP SUCCESSFUL!');
    console.log('User ID:', data.user?.id);
    console.log('Session exists:', !!data.session);
  }
}

testSignUp();
