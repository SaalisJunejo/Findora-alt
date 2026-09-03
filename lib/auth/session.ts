import { supabase } from '@/lib/db/supabase';

export interface UserSession {
  userId: string | null;
  email: string | null;
  isLoggedIn: boolean;
}

/**
 * Checks current user session on client or client-side helper calls
 */
export async function getCurrentSession(): Promise<UserSession> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      return { userId: null, email: null, isLoggedIn: false };
    }
    return {
      userId: session.user.id,
      email: session.user.email ?? null,
      isLoggedIn: true,
    };
  } catch {
    return { userId: null, email: null, isLoggedIn: false };
  }
}

/**
 * Gets the current logged-in user ID, or null if unauthenticated.
 */
export async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
