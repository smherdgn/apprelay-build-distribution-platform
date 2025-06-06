
import { AppVersion, Platform, Channel, Feedback, DashboardStats, BuildStatus, AppSettings, MonitoredRepository } from './types';

// === Get Builds ===
export interface GetBuildsApiParams {
  platform?: Platform;
  channel?: Channel;
}
export interface GetBuildsApiResponse {
  builds: AppVersion[];
}

// === Get Build By ID ===
export interface GetBuildByIdApiParams {
  id: string;
}
export interface GetBuildByIdApiResponse {
  build: AppVersion | null;
}

// === Create Build ===
// Represents metadata fields sent in FormData along with the actual build file.
// Server will derive fileName, fileType, size, and downloadUrl from the uploaded file.
export interface CreateBuildPayload {
  appName: string;
  versionName: string;
  versionCode: string;
  platform: Platform;
  channel: Channel;
  changelog: string;
  commitHash?: string;
  buildStatus?: BuildStatus; // Optional: client might suggest, server can override
  allowedUDIDs?: string; // JSON string array for iOS, parsed by server
}
export interface CreateBuildApiResponse {
  build: AppVersion;
}

// === Trigger CI Build ===
export interface TriggerCIPayload {
  projectName: string;
  branch: string;
  triggeredByUsername: string;
  platform: Platform;
  channel: Channel;
}
export interface TriggerCIApiResponse {
  message: string;
  newBuild?: AppVersion;
}

// === Increment Download Count ===
export interface IncrementDownloadCountPayload {
  buildId: string;
}
export interface IncrementDownloadCountApiResponse {
  success: boolean;
  updatedBuild?: AppVersion;
}

// === Submit Feedback ===
export interface SubmitFeedbackPayload {
  buildId: string;
  user: string;
  comment: string;
}
export interface SubmitFeedbackApiResponse {
  feedback: Feedback;
}

// === Get Feedbacks for Build ===
export interface GetFeedbacksApiParams {
  buildId: string;
}
export interface GetFeedbacksApiResponse {
  feedbacks: Feedback[];
}

// === Get Dashboard Stats ===
export interface GetDashboardStatsApiResponse {
  stats: DashboardStats;
}

// === Force Rebuild ===
export interface ForceRebuildPayload {
    originalBuildId: string;
    triggeredByUsername: string;
}
export interface ForceRebuildApiResponse {
    message: string;
    newBuild?: AppVersion;
}

// === Delete Build ===
export interface DeleteBuildPayload {
    buildId: string;
}
export interface DeleteBuildApiResponse {
    success: boolean;
    message: string;
}

// === Settings ===
export interface GetSettingsApiResponse {
  settings: AppSettings; // API will ensure a default settings object is always returned
}

export type UpdateSettingsPayload = Partial<Omit<AppSettings, 'id' | 'created_at'>>;

export interface UpdateSettingsApiResponse {
  settings: AppSettings;
  message: string;
}

// === Monitored Repositories (for CI auto-trigger config) ===
export interface GetMonitoredRepositoriesApiResponse {
  repositories: MonitoredRepository[];
}

export type CreateMonitoredRepositoryPayload = Omit<MonitoredRepository, 'id' | 'created_at' | 'updated_at'>;
export interface CreateMonitoredRepositoryApiResponse {
  repository: MonitoredRepository;
  message: string;
}

export type UpdateMonitoredRepositoryPayload = Partial<CreateMonitoredRepositoryPayload>;
export interface UpdateMonitoredRepositoryApiResponse {
  repository: MonitoredRepository;
  message: string;
}

export interface DeleteMonitoredRepositoryApiResponse {
  success: boolean;
  message: string;
}
