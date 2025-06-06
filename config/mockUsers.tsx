import {  UserRole } from '../types';

/**
 * Mock user for local development when Supabase is disabled.
 * This user is automatically logged in if `useSupabase` setting is false.
 */
export const MOCK_LOCAL_USER = {
  id: 'local-admin-001',
  username: 'Local Admin',
  email: 's@s.com',
  role: UserRole.Admin,
};

// Potential future mock users can be added here, e.g.:
/*
export const MOCK_LOCAL_DEVELOPER: User = {
  id: 'local-dev-002',
  username: 'Local Developer',
  email: 'localdev@example.com',
  role: UserRole.Developer,
};
*/
