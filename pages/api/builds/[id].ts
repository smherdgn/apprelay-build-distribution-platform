
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient'; 
import * as localDbService from '../../../services/localDbService';
import { AppSettings } from '../../../types';
import { getAPISettingsDirectly } from '@/lib /settingsUtil';
 
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  let appSettings: AppSettings;
  try {
    appSettings = await getAPISettingsDirectly();
  } catch (settingsError: any) {
    console.error(`API Route /builds/[id] (${id}): Critical error fetching settings:`, settingsError);
    return res.status(500).json({ error: 'Failed to retrieve application settings', details: settingsError.message });
  }

  if (req.method === 'GET') {
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Build ID is required' });
    }
    try {
      let buildData: any; 
      let error: any = null;

      if (appSettings.useSupabase) {
        const { data, error: supabaseError } = await supabase
          .from('builds')
          .select('*')
          .eq('id', id)
          .single();
        buildData = data;
        error = supabaseError;
      } else {
        buildData = localDbService.getLocalBuildById(id);
        if (!buildData) {
             error = { code: 'PGRST116', message: 'Build not found in local DB' }; 
        }
      }
      
      if (error) {
        if (error.code === 'PGRST116') { 
          return res.status(404).json({ build: null, message: 'Build not found' });
        }
        throw error;
      }
      
      if (!buildData) { 
        return res.status(404).json({ build: null, message: 'Build not found' });
      }

      res.status(200).json({ build: buildData });

    } catch (error: any) {
      console.error(`Error fetching build ${id}:`, error);
      res.status(500).json({ error: `Failed to fetch build ${id}`, details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
