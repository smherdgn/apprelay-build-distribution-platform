
import type { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { AppSettings, UserRole, Channel, DEFAULT_SETTINGS } from '../../../types';
import { GetSettingsApiResponse, UpdateSettingsPayload, UpdateSettingsApiResponse } from '../../../apiTypes';
import { supabase } from '../../../lib/supabaseClient'; 
import * as localDbService from '../../../localDbService';
import { getAPISettingsDirectly } from '@/lib /settingsUtil';

// Helper to ensure settings have correct types, especially for enums or numbers
const sanitizeSettingsPayload = (payload: any): UpdateSettingsPayload => {
  const sanitized: Partial<AppSettings> = {};

  const booleanKeys: (keyof AppSettings)[] = [
    'useSupabase', 'useSupabaseStorage', 'enableAutoClean', 
    'geminiEnabled', 'feedbackEnabled', 'notifyOnNewBuild', 
    'ciIntegrationEnabled', 'buildApprovalRequired'
  ];
  booleanKeys.forEach(key => {
    if (payload[key] !== undefined) {
      (sanitized as any)[key] = Boolean(payload[key]);
    }
  });

  const stringKeys: (keyof AppSettings)[] = ['apiBaseUrl', 'localBuildPath'];
  stringKeys.forEach(key => {
    if (payload[key] !== undefined && typeof payload[key] === 'string') {
      (sanitized as any)[key] = payload[key];
    } else if (payload[key] !== undefined) {
      (sanitized as any)[key] = String(payload[key]); 
    }
  });
  
  const numberKeys: (keyof AppSettings)[] = ['maxBuildsPerGroup', 'maxUploadSizeMB'];
  numberKeys.forEach(key => {
    if (payload[key] !== undefined) {
      const num = parseInt(String(payload[key]), 10);
      if (!isNaN(num)) {
        (sanitized as any)[key] = num;
      }
    }
  });

  if (payload.deletePolicy !== undefined) {
    sanitized.deletePolicy = payload.deletePolicy === 'All' ? 'All' : 'CIOnly';
  }
  if (payload.qrCodeMode !== undefined) {
    sanitized.qrCodeMode = payload.qrCodeMode === 'BuildDetail' ? 'BuildDetail' : 'DownloadLink';
  }
  if (payload.defaultChannel !== undefined && Object.values(Channel).includes(payload.defaultChannel as Channel)) {
    sanitized.defaultChannel = payload.defaultChannel as Channel;
  }
  if (payload.uiTheme !== undefined) {
    const theme = String(payload.uiTheme);
    if (['light', 'dark', 'system'].includes(theme)) {
        sanitized.uiTheme = theme as 'light' | 'dark' | 'system';
    }
  }
  
  return sanitized as UpdateSettingsPayload;
};


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetSettingsApiResponse | UpdateSettingsApiResponse | { error: string; details?: string }>
) {
  if (req.method === 'GET') {
    try {
      // Use the centralized utility function to get settings
      const appSettings = await getAPISettingsDirectly();
      res.status(200).json({ settings: appSettings });
    } catch (error: any) {
      console.error(`Error fetching settings in API route (/api/settings GET):`, error);
      res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
    }
  } else if (req.method === 'PUT') {
    const supabaseServerClient = createPagesServerClient({ req, res });
    const { data: { user }, error: userError } = await supabaseServerClient.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
    if (user.user_metadata?.role !== UserRole.Admin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }

    const settingsSource = process.env.APP_SETTINGS_SOURCE || 'supabase';

    try {
      const payload = sanitizeSettingsPayload(req.body);
      let updatedSettingsData: AppSettings;

      if (settingsSource === 'local') {
        updatedSettingsData = localDbService.updateLocalSettings(payload);
      } else { // Supabase
        const { data: existingSettings, error: fetchError } = await supabase
          .from('settings')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(); // Use maybeSingle to correctly handle no existing row

        // Allow PGRST116 (no rows found), but throw other errors
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; 
        
        const settingsToApply = { ...payload, created_at: new Date().toISOString() };

        if (existingSettings?.id) { 
          const { data, error: updateError } = await supabase
            .from('settings')
            .update(settingsToApply)
            .eq('id', existingSettings.id)
            .select()
            .single();
          if (updateError) throw updateError;
          if (!data) throw new Error("Supabase settings update failed to return data.");
          updatedSettingsData = data as AppSettings;
        } else { 
           // If no existing settings, insert with defaults merged with payload
           const baseSettingsWithPayload = { ...DEFAULT_SETTINGS, ...settingsToApply, id: DEFAULT_SETTINGS.id };
           const { data, error: insertError } = await supabase
            .from('settings')
            .insert(baseSettingsWithPayload) 
            .select()
            .single();
          if (insertError) throw insertError;
          if (!data) throw new Error("Supabase settings insert failed to return data.");
          updatedSettingsData = data as AppSettings;
        }
      }
      
      if (!updatedSettingsData) throw new Error("Failed to update or insert settings.");

      // Ensure the returned settings object has all default fields if some were omitted during DB operation
      const finalSettings = { ...DEFAULT_SETTINGS, ...updatedSettingsData, id: updatedSettingsData.id, created_at: updatedSettingsData.created_at };
      res.status(200).json({ settings: finalSettings as AppSettings, message: 'Settings updated successfully.' });

    } catch (error: any) {
      console.error(`Error updating settings (source: ${settingsSource}):`, error);
      res.status(500).json({ error: 'Failed to update settings', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
