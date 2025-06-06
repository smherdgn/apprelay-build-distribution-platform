
export enum Platform {
  iOS = "iOS",
  Android = "Android",
}

export enum Channel {
  Beta = "Beta",
  Staging = "Staging",
  Production = "Production",
}

export enum BuildStatus {
  Success = "Success",
  Failed = "Failed",
  InProgress = "In Progress",
}

export enum BuildSource {
  MANUAL_UPLOAD = "Manual Upload",
  CI_PIPELINE = "CI Pipeline",
}

export interface AppVersion {
  id: string;
  appName: string;
  versionName: string;
  versionCode: string;
  platform: Platform;
  channel: Channel;
  changelog: string;
  previousChangelog?: string; // For Gemini comparison
  uploadDate: string;
  buildStatus: BuildStatus;
  commitHash?: string;
  downloadUrl: string;
  qrCodeUrl: string;
  size: string;

  fileName?: string;
  fileType?: string;
  downloadCount: number;

  source: BuildSource;
  ciBuildId?: string;
  pipelineStatus?: BuildStatus;
  ciLogsUrl?: string;
  triggeredBy?: string;

  allowedUDIDs?: string[];
}

export interface Feedback {
  id?: string; 
  buildId: string;
  user: string;
  comment: string;
  timestamp: string;
}

export interface DashboardStats {
  totalBuilds: number;
  downloadsByVersion: Array<{ versionId: string, appName: string; versionName: string; platform: Platform; count: number }>;
  buildSuccessRatio: number;
  channelDistribution: Record<Channel, number>;
  platformDistribution: Record<Platform, number>;
}

export interface ChangelogAnalysis {
  summary?: string;
  error?: string;
}

export enum UserRole {
  Admin = "Admin",
  Developer = "Developer",
  Tester = "Tester",
  Guest = "Guest",
  System = "System",
}

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
}

export interface AppSettings {
  id: string; // UUID from the database
  // Runtime environment settings
  useSupabase: boolean; // Use Supabase for DB (true) or local SQLite (false)
  useSupabaseStorage: boolean; // Use Supabase Storage for files (true) or local disk (false)
  apiBaseUrl: string; // For constructing local download URLs if useSupabaseStorage is false
  localBuildPath: string; // Path for local build file storage if useSupabaseStorage is false

  // Build management & retention
  maxBuildsPerGroup: number; // Max builds per (appName, platform, channel) group
  deletePolicy: 'CIOnly' | 'All'; // Policy for deleting excess builds
  enableAutoClean: boolean; // Master switch for build retention policy
  
  // Feature toggles
  geminiEnabled: boolean; // Enable/disable Gemini AI for changelog analysis
  feedbackEnabled: boolean; // Enable/disable user feedback system
  notifyOnNewBuild: boolean; // Enable/disable notifications on new build uploads
  ciIntegrationEnabled: boolean; // Enable/disable CI/CD related features (manual trigger, repo monitoring UI)
  buildApprovalRequired: boolean; // Example: future feature for build approval workflows

  // UI & functional parameters
  qrCodeMode: 'DownloadLink' | 'BuildDetail'; // What QR codes link to
  defaultChannel: Channel; // Default channel for new uploads
  maxUploadSizeMB: number; // Maximum allowed file size for uploads
  uiTheme: 'light' | 'dark' | 'system'; // UI theme preference
  
  created_at: string; // Timestamp of last update
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'default-settings-id', // Placeholder, actual ID will be UUID from DB
  // Runtime defaults
  useSupabase: true,
  useSupabaseStorage: true,
  apiBaseUrl: 'http://localhost:3000', // Should be dynamically set or configured in deployment
  localBuildPath: '_local_build_storage', // Relative to project root

  // Build management defaults
  maxBuildsPerGroup: 10,
  deletePolicy: 'CIOnly',
  enableAutoClean: true,

  // Feature toggle defaults
  geminiEnabled: true,
  feedbackEnabled: true,
  notifyOnNewBuild: false,
  ciIntegrationEnabled: true,
  buildApprovalRequired: false,

  // UI & functional parameter defaults
  qrCodeMode: 'DownloadLink',
  defaultChannel: Channel.Beta,
  maxUploadSizeMB: 200,
  uiTheme: 'dark',
  
  created_at: new Date().toISOString(),
};

export interface MonitoredRepository {
  id: string; // UUID from DB
  repo_url: string; // e.g., "https://github.com/org/repo.git"
  default_branch: string; // e.g., "main", "develop"
  default_platform: Platform;
  default_channel: Channel;
  auto_trigger_enabled: boolean; // Whether new commits should automatically trigger a build
  created_at: string;
  updated_at?: string;
}
