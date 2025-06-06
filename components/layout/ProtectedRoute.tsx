import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { currentUser, isLoading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect while auth state is loading, unless it's the login/signup page itself.
    if (isLoading && router.pathname !== '/login' && router.pathname !== '/signup') {
      return; 
    }

    // If loading is done and there's no user, redirect to login.
    if (!isLoading && !currentUser) {
      router.replace(`/login?from=${encodeURIComponent(router.asPath)}`);
      return;
    }

    // If there is a user but they don't have the required role.
    if (currentUser && !hasRole(allowedRoles)) {
      router.replace(`/?unauthorized=true&from=${encodeURIComponent(router.asPath)}`); // Or to an "Unauthorized" page
      return;
    }
  }, [currentUser, isLoading, hasRole, allowedRoles, router]);


  // While loading or if user is null (and redirection is about to happen), show a loader.
  // Or if user is present but doesn't have the role (and redirection is about to happen).
  if (isLoading || !currentUser || (currentUser && !hasRole(allowedRoles))) {
    // Avoid showing loader on login/signup pages if they are not protected themselves.
    // This loader is for protected content area.
    if (router.pathname === '/login' || router.pathname === '/signup') {
      return <>{children}</>; // If login/signup pages are wrapped, let them render
    }
    return (
      <div className="flex justify-center items-center h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400" aria-label="Loading content..."></div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
