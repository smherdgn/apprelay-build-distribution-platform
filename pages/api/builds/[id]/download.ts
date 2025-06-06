
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../../lib/supabaseClient';
import { IncrementDownloadCountApiResponse } from '../../../../apiTypes';
import * as localDbService from '../../../../services/localDbService';
import { AppSettings, AppVersion } from '../../../../types';
import { getAPISettingsDirectly } from '@/lib /settingsUtil';
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IncrementDownloadCountApiResponse | { error: string; details?: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let appSettings: AppSettings;
  try {
    appSettings = await getAPISettingsDirectly();
  } catch (settingsError: any) {
    console.error('API Route /builds/[id]/download: Critical error fetching settings:', settingsError);
    return res.status(500).json({ error: 'Failed to retrieve application settings', details: settingsError.message });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Build ID is required and must be a string.' });
  }

  try {
    let updatedBuild: AppVersion | null = null;

    if (appSettings.useSupabase) {
      const { data: currentBuild, error: fetchError } = await supabase
        .from('builds')
        .select('downloadCount')
        .eq('id', id)
        .single();

      if (fetchError || !currentBuild) {
        if (fetchError && fetchError.code === 'PGRST116') { // PGRST116: Row not found
           return res.status(404).json({ error: `Build with ID ${id} not found.` });
        }
        console.error(`Error fetching build ${id} for download count update:`, fetchError);
        throw fetchError || new Error('Failed to fetch build for download count.');
      }
      
      const newDownloadCount = (currentBuild.downloadCount || 0) + 1;
      const { data, error: updateError } = await supabase
        .from('builds')
        .update({ downloadCount: newDownloadCount })
        .eq('id', id)
        .select()
        .single();
      if (updateError) {
        console.error(`Error updating download count for build ${id}:`, updateError);
        throw updateError;
      }
      updatedBuild = data as AppVersion;
    } else {
      updatedBuild = localDbService.incrementLocalDownloadCount(id);
      if (!updatedBuild) {
        return res.status(404).json({ error: `Build with ID ${id} not found in local DB.` });
      }
    }
    
    if (!updatedBuild) { 
        return res.status(500).json({error: 'Failed to update download count or retrieve updated build.' });
    }

    return res.status(200).json({ success: true, updatedBuild });

  } catch (error: any) {
    console.error(`Unexpected error incrementing download count for build ${id}:`, error);
    return res.status(500).json({ error: 'An unexpected error occurred.', details: error.message });
  }
}
