import { supabase } from '@/lib/db/supabase';

/**
 * Auth Helper Functions
 * 
 * Functions for OTP verification, password auth, session management,
 * and user role checks will be implemented here per PRD Section 2.3.
 */

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export async function signOutUser() {
  return await supabase.auth.signOut();
}
