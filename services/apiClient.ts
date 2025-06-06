
import {
  GetBuildsApiParams, GetBuildsApiResponse,
  GetBuildByIdApiParams, GetBuildByIdApiResponse,
  CreateBuildPayload, CreateBuildApiResponse,
  TriggerCIPayload, TriggerCIApiResponse,
  IncrementDownloadCountPayload, IncrementDownloadCountApiResponse,
  SubmitFeedbackPayload, SubmitFeedbackApiResponse,
  GetFeedbacksApiParams, GetFeedbacksApiResponse,
  GetDashboardStatsApiResponse,
  ForceRebuildPayload, ForceRebuildApiResponse,
  DeleteBuildPayload, DeleteBuildApiResponse,
  GetSettingsApiResponse, UpdateSettingsPayload, UpdateSettingsApiResponse,
  GetMonitoredRepositoriesApiResponse, CreateMonitoredRepositoryPayload, CreateMonitoredRepositoryApiResponse,
  UpdateMonitoredRepositoryPayload, UpdateMonitoredRepositoryApiResponse, DeleteMonitoredRepositoryApiResponse
} from '../apiTypes';

const API_BASE_URL = '/api'; // Next.js API routes

export const getBuilds = async (params: GetBuildsApiParams): Promise<GetBuildsApiResponse> => {
  const queryParams = new URLSearchParams();
  if (params.platform) queryParams.append('platform', params.platform);
  if (params.channel) queryParams.append('channel', params.channel);
  
  const response = await fetch(`${API_BASE_URL}/builds?${queryParams.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch builds' }));
    throw new Error(errorData.message || 'Failed to fetch builds');
  }
  return response.json();
};

export const getBuildById = async (params: GetBuildByIdApiParams): Promise<GetBuildByIdApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/builds/${params.id}`);
  if (!response.ok) {
    if (response.status === 404) return { build: null };
    const errorData = await response.json().catch(() => ({ message: `Failed to fetch build ${params.id}` }));
    throw new Error(errorData.message || `Failed to fetch build ${params.id}`);
  }
  return response.json();
};

// Changed signature: accepts payload and file, constructs FormData internally
export const addBuild = async (payload: CreateBuildPayload, file: File, maxUploadSizeMB: number): Promise<CreateBuildApiResponse> => {
  if (file.size > maxUploadSizeMB * 1024 * 1024) {
    throw new Error(`File size exceeds the maximum limit of ${maxUploadSizeMB}MB.`);
  }
  const formData = new FormData();

  // Append metadata fields from the payload object
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined) {
      // CreateBuildPayload defines allowedUDIDs as string (JSON stringified)
      // All other relevant fields are strings or will be converted to strings by FormData.
      formData.append(key, value as string);
    }
  });

  // Append the file object
  // The backend API route /api/builds expects the file under the field name 'buildFile'
  formData.append('buildFile', file, file.name);

  const response = await fetch(`${API_BASE_URL}/builds`, {
    method: 'POST',
    body: formData,
    // 'Content-Type': 'multipart/form-data' is automatically set by the browser for FormData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to create build' }));
    throw new Error(errorData.message || 'Failed to create build');
  }
  return response.json();
};

export const forceRebuild = async (payload: ForceRebuildPayload): Promise<ForceRebuildApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/builds/${payload.originalBuildId}/rebuild`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ triggeredByUsername: payload.triggeredByUsername }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to force rebuild' }));
    throw new Error(errorData.message || 'Failed to force rebuild');
  }
  return response.json();
};

export const submitFeedback = async (payload: SubmitFeedbackPayload): Promise<SubmitFeedbackApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to submit feedback' }));
    throw new Error(errorData.message || 'Failed to submit feedback');
  }
  return response.json();
};

export const getFeedbacksForBuild = async (params: GetFeedbacksApiParams): Promise<GetFeedbacksApiResponse> => {
  const queryParams = new URLSearchParams({ buildId: params.buildId });
  const response = await fetch(`${API_BASE_URL}/feedback?${queryParams.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch feedback' }));
    throw new Error(errorData.message || 'Failed to fetch feedback');
  }
  return response.json();
};

export const triggerManualCIBuild = async (payload: TriggerCIPayload): Promise<TriggerCIApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/ci/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to trigger CI build' }));
    throw new Error(errorData.message || 'Failed to trigger CI build');
  }
  return response.json();
};

export const incrementDownloadCount = async (payload: IncrementDownloadCountPayload): Promise<IncrementDownloadCountApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/builds/${payload.buildId}/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to increment download count' }));
    throw new Error(errorData.message || 'Failed to increment download count');
  }
  return response.json();
};

export const getDashboardStats = async (): Promise<GetDashboardStatsApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/dashboard/stats`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch dashboard stats' }));
    throw new Error(errorData.message || 'Failed to fetch dashboard stats');
  }
  return response.json();
};

export const deleteBuild = async (payload: DeleteBuildPayload): Promise<DeleteBuildApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/builds/${payload.buildId}/delete`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    // No body needed for DELETE usually, but payload ensures buildId is passed correctly in URL
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to delete build' }));
    throw new Error(errorData.message || 'Failed to delete build');
  }
  return response.json();
};

// Settings API
export const getSettings = async (): Promise<GetSettingsApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/settings`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch settings' }));
    throw new Error(errorData.message || 'Failed to fetch settings');
  }
  return response.json();
};

export const updateSettings = async (payload: UpdateSettingsPayload): Promise<UpdateSettingsApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to update settings' }));
    throw new Error(errorData.message || 'Failed to update settings');
  }
  return response.json();
};

// Monitored Repositories API
export const getMonitoredRepositories = async (): Promise<GetMonitoredRepositoriesApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/ci/repositories`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch monitored repositories' }));
    throw new Error(errorData.message || 'Failed to fetch monitored repositories');
  }
  return response.json();
};

export const addMonitoredRepository = async (payload: CreateMonitoredRepositoryPayload): Promise<CreateMonitoredRepositoryApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/ci/repositories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to add monitored repository' }));
    throw new Error(errorData.message || 'Failed to add monitored repository');
  }
  return response.json();
};

export const updateMonitoredRepository = async (id: string, payload: UpdateMonitoredRepositoryPayload): Promise<UpdateMonitoredRepositoryApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/ci/repositories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to update monitored repository' }));
    throw new Error(errorData.message || 'Failed to update monitored repository');
  }
  return response.json();
};

export const deleteMonitoredRepository = async (id: string): Promise<DeleteMonitoredRepositoryApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/ci/repositories/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to delete monitored repository' }));
    throw new Error(errorData.message || 'Failed to delete monitored repository');
  }
  return response.json();
};