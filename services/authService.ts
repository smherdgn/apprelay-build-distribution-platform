
import { supabase } from '../lib/supabaseClient';
import { User as AppUser, UserRole } from '../types'; // Renamed to AppUser to avoid conflict with Supabase User
import type { User as SupabaseUser } from '@supabase/supabase-js'; // Removed SignUpWithPasswordCredentials import as we define our own specific type

// Helper to map Supabase user to our application's User type
const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser | null): AppUser | null => {
  if (!supabaseUser) return null;

  // Ensure user_metadata exists and has the expected properties
  const username = supabaseUser.user_metadata?.username || supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0] || 'Anonymous';
  const role = supabaseUser.user_metadata?.role as UserRole || UserRole.Tester; // Default to Tester if not set

  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    username: username,
    role: role,
  };
};

export const loginUser = async (email: string, password_param: string): Promise<AppUser | null> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: password_param, // Supabase signInWithPassword expects 'password'
  });

  if (error) {
    console.error('Supabase login error:', error.message);
    throw error; // Propagate error to be handled by the caller
  }
  return data.user ? mapSupabaseUserToAppUser(data.user) : null;
};

// Define the specific structure for our application's sign-up credentials
export interface AppSpecificSignUpCredentials {
  email: string;
  password: string; // Use 'password' for clarity in our app's context
  options: {
    data: {
      username: string;
      role: UserRole;
    };
    emailRedirectTo?: string;
    captchaToken?: string;
  };
}

export const registerUser = async (credentials: AppSpecificSignUpCredentials): Promise<AppUser | null> => {
  const { email, password, options: appOptions } = credentials;
  
  if (!appOptions.data.username) {
    throw new Error("Username is required for registration.");
  }
  if (!appOptions.data.role) {
    throw new Error("Role is required for registration.");
  }

  // Construct the object for Supabase's signUp method
  // Supabase's SignUpWithPasswordCredentials type expects 'password_param'
  const supabaseCredentials = {
    email: email,
    password: password, // Supabase auth.signUp expects 'password'
    options: {
      emailRedirectTo: appOptions.emailRedirectTo,
      captchaToken: appOptions.captchaToken,
      data: { // This data is stored in user_metadata
        username: appOptions.data.username,
        role: appOptions.data.role,
        display_name: appOptions.data.username, // Supabase often uses display_name
      }
    }
  };

  const { data, error } = await supabase.auth.signUp(supabaseCredentials);

  if (error) {
    console.error('Supabase registration error:', error.message);
    throw error;
  }
  // After signUp, data.user might not contain user_metadata immediately if email confirmation is pending.
  // However, Supabase often returns the user object. We'll map what we get.
  // If email confirmation is enabled, the user object will be returned but session will be null until confirmed.
  return data.user ? mapSupabaseUserToAppUser(data.user) : null;
};

export const logoutUser = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Supabase logout error:', error.message);
    throw error;
  }
};

export const getCurrentUser = async (): Promise<AppUser | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  // If there's a session, user should be available in session.user
  // For a more robust way to get potentially updated user_metadata, you could re-fetch:
  // const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
  // if (error || !supabaseUser) return null;
  // return mapSupabaseUserToAppUser(supabaseUser);
  
  return mapSupabaseUserToAppUser(session.user);
};

// Listen to auth state changes - useful for AuthContext
export const onAuthStateChange = (callback: (user: AppUser | null) => void) => {
  const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const appUser = session?.user ? mapSupabaseUserToAppUser(session.user) : null;
    callback(appUser);
  });
  return () => {
    authListener?.subscription.unsubscribe();
  };
};
