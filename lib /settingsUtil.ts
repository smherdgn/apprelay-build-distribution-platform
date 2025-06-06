
import { AppSettings, DEFAULT_SETTINGS } from '../types';
import { supabase } from './supabaseClient'; 
import * as localDbService from '../localDbService'; // Path from lib/ to root/

/**
 * Fetches application settings directly from the configured data source.
 * The source (Supabase or local SQLite DB) is determined by the
 * `APP_SETTINGS_SOURCE` environment variable (defaults to 'supabase').
 * Handles initialization of default settings if they don't exist.
 * @returns A promise that resolves to AppSettings.
 * @throws An error if settings cannot be fetched or initialized beyond the graceful fallback for missing table.
 */
export async function getAPISettingsDirectly(): Promise<AppSettings> {
  const settingsSource = process.env.APP_SETTINGS_SOURCE || 'supabase';
  // const schemaName = 'apprelay'; // Schema is now set in supabaseClient

  try {
    if (settingsSource === 'local') {
      // Defensive check for localDbService and its expected function
      if (!localDbService || typeof localDbService.getLocalSettings !== 'function') {
        console.error("[SettingsUtil] CRITICAL: localDbService.getLocalSettings is not available.");
        console.error("[SettingsUtil] This usually indicates a problem with local database initialization, possibly due to 'better-sqlite3' native module issues or the localDbService module itself not loading correctly in the current environment.");
        console.error("[SettingsUtil] Please check server logs for any errors related to 'better-sqlite3' or SQLite database file access/permissions (local.db).");
        throw new Error("Local database service (localDbService) failed to load correctly. The function 'getLocalSettings' is missing.");
      }
      console.log('[SettingsUtil] Fetching settings from local SQLite database.');
      return localDbService.getLocalSettings();
    } else { // Supabase
      console.log('[SettingsUtil] Fetching settings from Supabase.');
      let settingsData = null;
      let fetchError: any = null;

      try {
        const { data, error } = await supabase
          .from('settings') // Schema removed, handled by client config
          .select('*')
          .order('created_at', { ascending: false }) 
          .limit(1)
          .maybeSingle(); 
        settingsData = data;
        fetchError = error;
      } catch (e: any) {
        // Catch potential network errors or other pre-request issues if supabase client itself throws
        fetchError = e;
      }

      if (fetchError) {
        if (fetchError.code === '42P01') { // Specific PostgreSQL error code for "undefined_table"
          console.error(`[SettingsUtil] CRITICAL: The 'settings' table does not exist in your Supabase database (current default schema).`);
          console.error(`[SettingsUtil] Please run the SQL schema found in your project's README.md to create it.`);
          console.warn('[SettingsUtil] Falling back to default in-memory settings. Admin configuration via UI will not persist until the table is created.');
          return { ...DEFAULT_SETTINGS }; // Return default settings and let app attempt to run
        }
        // PGRST116 means "Resource Not Found" (no rows), which is handled by data being null/undefined below.
        // For other errors, throw them.
        if (fetchError.code !== 'PGRST116') {
          console.error('[SettingsUtil] Supabase error fetching settings:', fetchError);
          throw new Error(`Supabase error fetching settings: ${fetchError.message}`);
        }
        // If PGRST116, fetchError is "truthy" but data will be null, leading to the 'else' block.
      }

      if (settingsData) {
        const completeSettings = { 
          ...DEFAULT_SETTINGS, 
          ...settingsData, 
          id: settingsData.id || DEFAULT_SETTINGS.id, 
          created_at: settingsData.created_at || new Date().toISOString()
        };
        return completeSettings as AppSettings;
      } else {
        // Table exists but no settings row found, or PGRST116 occurred.
        console.warn(`[SettingsUtil] No settings row found in Supabase or table was empty. Attempting to create default settings row.`);
        const { data: newSettings, error: insertError } = await supabase
          .from('settings') // Schema removed
          .insert(DEFAULT_SETTINGS) 
          .select()
          .single();
        
        if (insertError) {
          console.error(`[SettingsUtil] Supabase error inserting default settings:`, insertError);
          throw new Error(`Supabase error inserting default settings: ${insertError.message}`);
        }
        if (!newSettings) {
            console.error(`[SettingsUtil] Failed to insert default settings into Supabase (no data returned).`);
            throw new Error("Failed to insert default settings and retrieve them from Supabase.");
        }
        return { ...DEFAULT_SETTINGS, ...newSettings } as AppSettings;
      }
    }
  } catch (e: any) {
    console.error(`[SettingsUtil] Critical error in getAPISettingsDirectly (source: ${settingsSource}):`, e);
    // If the error is the one we throw from the localDbService check, rethrow it directly.
    if (e.message.includes("Local database service (localDbService) failed to load correctly")) {
        throw e;
    }
    throw new Error(`Failed to get or initialize application settings: ${e.message}`);
  }
}
