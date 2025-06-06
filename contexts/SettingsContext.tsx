import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS, Channel } from '../types';
import { getSettings } from '../services/settingsService'; // Updated import
import { GetSettingsApiResponse } from '../apiTypes'; // For typing the response
import * as apiClient from '../services/apiClient'; 

interface SettingsContextType {
  settings: AppSettings;
  isLoadingSettings: boolean;
  fetchSettings: () => Promise<void>;
  getSetting: <K extends keyof AppSettings>(key: K, defaultValue?: AppSettings[K]) => AppSettings[K];
  updateSettingOptimistic: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void; 
  saveSettings: (newSettings: Partial<Omit<AppSettings, 'id' | 'created_at'>>) => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const fetchSettingsCallback = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const response: GetSettingsApiResponse = await getSettings(); // Use the new service function
      if (response && response.settings) {
        // Ensure all default fields are present if API returns a partial object
        const completeSettings = { ...DEFAULT_SETTINGS, ...response.settings };
        setSettings(completeSettings);
      } else {
        // This case handles a successful API call (2xx) but missing 'settings' property in the response.
        console.warn("Settings data is missing in the API response (response.settings is undefined), using defaults. Response:", response);
        setSettings(DEFAULT_SETTINGS); 
      }
    } catch (error) { // This catches errors thrown by getSettings (network, non-2xx status)
      console.error("Failed to fetch settings via context (service threw an error):", error);
      setSettings(DEFAULT_SETTINGS); 
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchSettingsCallback();
  }, [fetchSettingsCallback]);

  const getSetting = useCallback(<K extends keyof AppSettings>(key: K, defaultValue?: AppSettings[K]): AppSettings[K] => {
    const contextValue = settings?.[key];
    const hardcodedDefaultValue = DEFAULT_SETTINGS[key];

    if (contextValue !== undefined) {
        // Validate specific types if necessary, e.g. enums
        if (key === 'defaultChannel' && !Object.values(Channel).includes(contextValue as Channel)) {
            return (defaultValue !== undefined ? defaultValue : hardcodedDefaultValue) as AppSettings[K];
        }
        if (key === 'uiTheme' && !['light', 'dark', 'system'].includes(contextValue as string)){
             return (defaultValue !== undefined ? defaultValue : hardcodedDefaultValue) as AppSettings[K];
        }
        // For numbers, ensure contextValue is actually a number if settings source could be problematic
        if (typeof hardcodedDefaultValue === 'number' && typeof contextValue !== 'number') {
            const parsed = Number(contextValue);
            return isNaN(parsed) ? (defaultValue !== undefined ? defaultValue : hardcodedDefaultValue) as AppSettings[K] : parsed as AppSettings[K];
        }
        return contextValue as AppSettings[K];
    }
    
    return (defaultValue !== undefined ? defaultValue : hardcodedDefaultValue) as AppSettings[K];
  }, [settings]);

  const updateSettingOptimistic = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const saveSettings = useCallback(async (newSettingsToSave: Partial<Omit<AppSettings, 'id' | 'created_at'>>): Promise<boolean> => {
    setIsLoadingSettings(true); 
    try {
        const response = await apiClient.updateSettings(newSettingsToSave); 
        // Ensure all default fields are present in the response from saveSettings as well
        const completeSettings = { ...DEFAULT_SETTINGS, ...response.settings };
        setSettings(completeSettings);
        setIsLoadingSettings(false);
        return true;
    } catch (error) {
        console.error("Failed to save settings:", error);
        await fetchSettingsCallback(); // Re-fetch to revert to actual DB state on failure
        setIsLoadingSettings(false);
        return false;
    }
  }, [fetchSettingsCallback]);


  useEffect(() => {
    if (!isLoadingSettings) {
      const currentTheme = getSetting('uiTheme', 'dark');
      document.documentElement.classList.remove('light', 'dark');
      if (currentTheme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.add(systemPrefersDark ? 'dark' : 'light');
      } else {
        document.documentElement.classList.add(currentTheme);
      }
    }
  }, [settings, isLoadingSettings, getSetting]);


  if (isLoadingSettings && typeof window !== 'undefined' && window.location.pathname.startsWith('/_next/')) {
    // Avoid global loader for internal Next.js asset requests.
  } else if (isLoadingSettings) {
     return (
      <div className="flex justify-center items-center h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400" aria-label="Loading application settings..."></div>
      </div>
    );
  }

  return (
    <SettingsContext.Provider value={{ settings, isLoadingSettings, fetchSettings: fetchSettingsCallback, getSetting, updateSettingOptimistic, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};