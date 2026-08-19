import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

// Main client for normal operations (persists session)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Secondary client for admin operations like creating employee accounts without logging out the owner
export const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // This client is deliberately isolated from the signed-in owner's session.
    // Without a separate storage key Supabase creates two clients that compete
    // for the same session and startup can become non-deterministic.
    storageKey: 'easy-store-employee-provisioning',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
