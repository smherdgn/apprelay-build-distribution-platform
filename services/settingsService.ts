
import { GetSettingsApiResponse } from '../apiTypes';

/**
 * Fetches the application settings from the backend.
 * Uses '/api/settings'.
 * @returns A promise that resolves to GetSettingsApiResponse.
 * @throws An error if the API call fails (e.g., network error, or non-OK response).
 */
export const getSettings = async (): Promise<GetSettingsApiResponse> => {
  const res = await fetch("/api/settings");
  if (!res.ok) {
    let errorMessage = "Ayarlar alınamadı"; // Default error message in Turkish as per user's snippet context
    try {
        // Attempt to parse a JSON error response from the API
        const errorBody = await res.json();
        errorMessage = errorBody.message || errorBody.error || errorMessage;
    } catch (parseError) {
        // Ignore if error response is not JSON or empty
        console.warn("Could not parse error response from /api/settings:", parseError);
    }
    throw new Error(errorMessage);
  }
  // The API is expected to return an object with a 'settings' property.
  // So, the type here should be GetSettingsApiResponse.
  return await res.json() as GetSettingsApiResponse; 
};