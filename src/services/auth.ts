import type { User, UserRole } from '@/types';
import { supabase, authSupabase } from './supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthResult {
  ok: boolean;
  user?: User;
  error?: 'email_exists' | 'invalid_credentials' | 'not_found' | 'inactive' | 'weak_password' | 'invalid_input' | 'owner_protected' | string;
}

// Map supabase user and team to our User type
async function getUserWithTeam(supabaseUser: SupabaseUser | undefined | null): Promise<User | null> {
  if (!supabaseUser) return null;
  const { data: teamMember, error } = await supabase
    .from('team_members')
    .select('team_id, role, name, email')
    .eq('user_id', supabaseUser.id)
    .single();

  if (error || !teamMember) return null;

  return {
    id: supabaseUser.id,
    name: teamMember.name || supabaseUser.user_metadata?.name || supabaseUser.email || '',
    email: teamMember.email || supabaseUser.email || '',
    role: teamMember.role as UserRole,
    isActive: true,
    teamId: teamMember.team_id,
  };
}

export async function hasAnyAccount(): Promise<boolean> {
  return true;
}

export async function register(name: string, email: string, password: string): Promise<AuthResult> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanName || !cleanEmail) return { ok: false, error: 'invalid_input' };
  if (password.length < 8) return { ok: false, error: 'weak_password' };
  
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: { name: cleanName },
    }
  });

  if (error) {
    console.error('Supabase SignUp Error:', error);
    if (error.message.includes('already registered')) return { ok: false, error: 'email_exists' };
    return { ok: false, error: error.message };
  }

  if (!data.user) return { ok: false, error: 'unknown_error' };

  // If email confirmation is enabled on Supabase, session might be null.
  // We attempt to log in immediately.
  if (!data.session) {
    const loginRes = await login(cleanEmail, password);
    if (loginRes.ok) return loginRes;
    
    // If auto-login fails, inform the user about Supabase email confirmation
    return { 
      ok: false, 
      error: 'تم إنشاء الحساب! إذا طلبت منصة Supabase تأكيد الإيميل، يرجى تفعيل الحساب من بريدك أو تعطيل Confirm Email من إعدادات Supabase Auth.' 
    };
  }

  // Fetch created user with team (auto-created by DB trigger)
  let user = await getUserWithTeam(data.user);
  if (!user) {
    await new Promise(r => setTimeout(r, 600));
    user = await getUserWithTeam(data.user);
  }

  if (!user) {
    return { ok: false, error: 'تم إنشاء الحساب، يرجى إدخال البريد وكلمة السر لتسجيل الدخول.' };
  }

  return { ok: true, user };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
  
  if (error) {
    console.error('Supabase Login Error:', error);
    return { ok: false, error: 'invalid_credentials' };
  }
  
  const user = await getUserWithTeam(data.user);
  if (!user) return { ok: false, error: 'not_found' };
  
  return { ok: true, user };
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null }, error: null }>((resolve) => {
      setTimeout(() => resolve({ data: { session: null }, error: null }), 3000);
    });
    
    const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
    if (!session) return null;
    return getUserWithTeam(session.user);
  } catch (err) {
    console.error('getCurrentUser error or timeout:', err);
    return null;
  }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function listAccounts(): Promise<User[]> {
  const user = await getCurrentUser();
  if (!user || !user.teamId) return [];
  
  const { data, error } = await supabase
    .from('team_members')
    .select('user_id, role, email, name')
    .eq('team_id', user.teamId);
    
  if (error || !data) return [];
  
  return data.map(member => ({
    id: member.user_id,
    name: member.name || '',
    email: member.email || '',
    role: member.role as UserRole,
    isActive: true,
    teamId: user.teamId
  }));
}

export async function adminCreateAccount(
  name: string,
  email: string,
  password: string,
  role: UserRole,
): Promise<AuthResult> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  
  if (!cleanName || !cleanEmail) return { ok: false, error: 'invalid_input' };
  if (password.length < 8) return { ok: false, error: 'weak_password' };
  if (role === 'owner') return { ok: false, error: 'owner_protected' };

  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.teamId) return { ok: false, error: 'not_found' };

  // Create a short-lived, email-bound invitation first.  The database trigger
  // consumes it when the employee account is created, so the employee joins
  // the owner's team instead of receiving a second, private team.
  const inviteToken = crypto.randomUUID();
  const { error: invitationError } = await supabase
    .from('team_invitations')
    .insert([{
      team_id: currentUser.teamId,
      email: cleanEmail,
      name: cleanName,
      role,
      token: inviteToken,
    }]);

  if (invitationError) {
    console.error('Team invitation error:', invitationError);
    return { ok: false, error: invitationError.message };
  }

  // Use a secondary client so provisioning does not replace the owner's
  // session. The trigger uses the invitation, not client-supplied team data.
  const { data, error } = await authSupabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: { name: cleanName, invite_token: inviteToken },
    }
  });

  if (error) {
    await supabase.from('team_invitations').delete().eq('token', inviteToken);
    if (error.message.includes('already registered')) return { ok: false, error: 'email_exists' };
    return { ok: false, error: error.message };
  }
  if (!data.user) return { ok: false, error: 'unknown_error' };

  return { 
    ok: true, 
    user: {
      id: data.user.id,
      name: cleanName,
      email: cleanEmail,
      role,
      isActive: true,
      teamId: currentUser.teamId
    } 
  };
}

export async function updateAccount(
  id: string,
  changes: { name?: string; role?: UserRole; isActive?: boolean },
): Promise<AuthResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.teamId) return { ok: false, error: 'not_found' };

  const updateData: Record<string, string | boolean> = {};
  if (changes.name !== undefined) updateData.name = changes.name.trim();
  if (changes.role !== undefined) updateData.role = changes.role;

  if (Object.keys(updateData).length === 0) return { ok: true };

  const { error } = await supabase
    .from('team_members')
    .update(updateData)
    .eq('user_id', id)
    .eq('team_id', currentUser.teamId);

  if (error) return { ok: false, error: error.message };
  
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<AuthResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.teamId) return { ok: false, error: 'not_found' };

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('user_id', id)
    .eq('team_id', currentUser.teamId)
    .neq('role', 'owner');

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function changePassword(userId: string, _oldPassword: string, newPassword: string): Promise<AuthResult> {
  if (newPassword.length < 8) return { ok: false, error: 'weak_password' };
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.id !== userId) return { ok: false, error: 'not_found' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
