
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { User, UserRole } from '../types';
import * as AuthService from '../services/authService';
import { AppSpecificSignUpCredentials } from '../services/authService';
import { useRouter } from 'next/router';
import { useSettings } from './SettingsContext'; // Import useSettings
import { MOCK_LOCAL_USER } from '../config/mockUsers'; // Import MOCK_LOCAL_USER from config

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password_param: string) => Promise<boolean>;
  register: (credentials: AppSpecificSignUpCredentials) => Promise<{ success: boolean; error?: Error | null; message?: string }>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authProviderInternalIsLoading, setAuthProviderInternalIsLoading] = useState(true);
  const router = useRouter();
  const { settings, isLoadingSettings } = useSettings();

  useEffect(() => {
    if (isLoadingSettings) {
      // Settings are not yet loaded, wait.
      setAuthProviderInternalIsLoading(true);
      return;
    }

    let isMounted = true; // To prevent state updates on unmounted component

    if (!settings.useSupabase) {
      // Local mode: bypass Supabase, set a mock user
      console.log("[AuthContext] Local mode active. Setting mock user.");
      if (isMounted) {
        setCurrentUser(MOCK_LOCAL_USER);
        setAuthProviderInternalIsLoading(false);
      }
      return () => {
        isMounted = false;
      }; 
    }

    // Supabase mode
    setAuthProviderInternalIsLoading(true); // Start loading for Supabase auth check

    // Initial check for current user - good for a quick update but onAuthStateChange is more definitive
    AuthService.getCurrentUser().then(user => {
      if (isMounted) {
        setCurrentUser(user);
        // Do not set loading to false here; wait for onAuthStateChange to give the
        // most current state and ensure the listener is fully active.
      }
    }).catch(() => {
      if (isMounted) {
        setCurrentUser(null);
      }
    });

    // Listener for subsequent auth state changes and initial state detection
    const unsubscribe = AuthService.onAuthStateChange((user) => {
      if (isMounted) {
        setCurrentUser(user);
        setAuthProviderInternalIsLoading(false); // Auth state now definitively known
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [settings.useSupabase, isLoadingSettings]); // Removed authProviderInternalIsLoading from dependencies

  const login = useCallback(async (email: string, password_param: string): Promise<boolean> => {
    if (!settings.useSupabase) {
      console.log("[AuthContext] Local mode login. Re-setting to MOCK_LOCAL_USER.");
      setCurrentUser(MOCK_LOCAL_USER); // Reset to the default mock user on local login
      router.replace(router.query.from === 'string' ? router.query.from : "/");
      return true;
    }

    setAuthProviderInternalIsLoading(true);
    try {
      await AuthService.loginUser(email, password_param);
      // onAuthStateChange will handle setting currentUser and eventually setAuthProviderInternalIsLoading to false.
      return true; 
    } catch (error) {
      console.error("Login failed in AuthContext (Supabase):", error);
      setCurrentUser(null);
      setAuthProviderInternalIsLoading(false); // Explicitly set false on error if listener doesn't fire quickly
      return false;
    }
  }, [settings.useSupabase, router]);

  const register = useCallback(async (credentials: AppSpecificSignUpCredentials): Promise<{ success: boolean; error?: Error | null; message?: string }> => {
    if (!settings.useSupabase) {
      console.log("[AuthContext] Local mode register.");
      const { email, options } = credentials;
      const { username, role } = options.data;

      if (!username || !role) {
        return { success: false, message: "Local mode: Username and role are required for local registration." };
      }
      if (!Object.values(UserRole).includes(role)) {
        return { success: false, message: `Local mode: Invalid role specified: ${role}.` };
      }

      const newLocalUser: User = {
        id: `local-user-${Date.now()}`, // Simple unique ID for the session
        username: username,
        email: email, 
        role: role,
      };
      setCurrentUser(newLocalUser);
      console.log("[AuthContext] Local mode: Successfully 'registered' and set new local user:", newLocalUser);
      return { success: true, message: `Local mode: Session active as ${username} (${role}). This is temporary for this session only.` };
    }
    
    setAuthProviderInternalIsLoading(true);
    try {
      await AuthService.registerUser(credentials);
      // For Supabase, onAuthStateChange might handle currentUser update.
      // If email confirmation is required, user won't be logged in immediately.
      // The onAuthStateChange will eventually set loading to false.
      return { success: true, message: "Registration successful! If email confirmation is enabled, please check your email to confirm your account." };
    } catch (error: any) {
      console.error("Registration failed in AuthContext (Supabase):", error);
      setAuthProviderInternalIsLoading(false); // Explicitly set false on error
      return { success: false, error, message: error.message || "Registration failed." };
    }
  }, [settings.useSupabase]);

  const logout = useCallback(async () => {
    if (!settings.useSupabase) {
      console.log("[AuthContext] Local mode logout. CurrentUser will be null. Next login/refresh will use MOCK_LOCAL_USER.");
      setCurrentUser(null); // For local mode, this is immediate.
      setAuthProviderInternalIsLoading(false); // Ensure loading is false after local logout.
      router.push('/login');
      return;
    }

    // For Supabase, onAuthStateChange will set currentUser to null and loading to false.
    try {
      await AuthService.logoutUser();
      // onAuthStateChange will handle setting currentUser to null and updating loading state.
      router.push('/login');
    } catch (error) {
      console.error("Logout failed in AuthContext (Supabase):", error);
      // Potentially set loading to false here if error means onAuthStateChange won't fire
      setAuthProviderInternalIsLoading(false);
    }
  }, [settings.useSupabase, router]);

  const hasRole = useCallback((roles: UserRole[]): boolean => {
    if (!currentUser) return false;
    return roles.includes(currentUser.role);
  }, [currentUser]);

  // This global loader covers initial loading of settings and auth state.
  // It avoids showing content prematurely.
  // Specific pages like /login or /signup handle their own loading/redirect logic
  // if currentUser or isLoading state changes.
  if ((isLoadingSettings || authProviderInternalIsLoading) && router.pathname !== '/login' && router.pathname !== '/signup') {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400" aria-label="Loading application state..."></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, isLoading: authProviderInternalIsLoading, login, register, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
