
import { UserRole } from './types';

// The console.warn for API_KEY has been removed as requested for production.
// The geminiService.ts will still handle the absence of the API_KEY appropriately:
// if settings.geminiEnabled is true and the key is missing, Gemini features
// will be unavailable or return an error.

// MOCK_APP_VERSIONS is removed. Data will be fetched from the API.
// MOCK_DASHBOARD_STATS is removed. Data will be fetched from the API.


export interface NavItem {
  path: string;
  label: string;
  icon: string; // Corresponds to key in iconMap in AppLayout
  allowedRoles?: UserRole[]; 
}

export const NAVIGATION_ITEMS: NavItem[] = [
  { path: "/", label: "Dashboard", icon: "Home", allowedRoles: [UserRole.Admin, UserRole.Developer, UserRole.Tester] },
  { path: "/builds", label: "Builds", icon: "List", allowedRoles: [UserRole.Admin, UserRole.Developer, UserRole.Tester] },
  { path: "/upload", label: "Upload Build", icon: "Upload", allowedRoles: [UserRole.Admin, UserRole.Developer] },
  { path: "/settings", label: "Settings", icon: "Settings", allowedRoles: [UserRole.Admin] },
];

// MOCK_USERS is removed as authentication is now handled by Supabase.
// User roles are still defined in types.ts and used for authorization.

// MOCK_PROJECTS has been removed. Project data should be fetched from an API if needed.

// Constants like MAX_BUILDS_PER_GROUP, geminiEnabled, enableAutoClean, ciIntegrationEnabled etc.,
// are now managed via SettingsContext and fetched from the backend.