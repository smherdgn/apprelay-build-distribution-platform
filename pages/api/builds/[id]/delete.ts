
import type { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { UserRole, AppSettings } from '../../../../types'; 
import { DeleteBuildApiResponse } from '../../../../apiTypes'; 
import * as localDbService from '../../../../services/localDbService';
import { supabase } from '../../../../lib/supabaseClient'; 
import fs from 'fs';
import path from 'path';
import { getAPISettingsDirectly } from '@/lib /settingsUtil';
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteBuildApiResponse | { error: string; details?: string }>
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  
  let appSettings: AppSettings;
  try {
    appSettings = await getAPISettingsDirectly();
  } catch (settingsError: any) {
    console.error('API Route /builds/[id]/delete: Critical error fetching settings:', settingsError);
    return res.status(500).json({ error: 'Failed to retrieve application settings', details: settingsError.message });
  }

  const supabaseServerClient = createPagesServerClient({ req, res }); 
  const { data: { user }, error: userError } = await supabaseServerClient.auth.getUser();

  if (userError) {
    console.error('Error getting user for delete operation:', userError.message);
    return res.status(401).json({ error: 'Authentication failed', details: userError.message });
  }
  if (!user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  if (user.user_metadata?.role !== UserRole.Admin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }

  const { id: buildId } = req.query;

  if (!buildId || typeof buildId !== 'string') {
    return res.status(400).json({ error: 'Build ID is required and must be a string.' });
  }

  try {
    if (appSettings.useSupabase) {
      const { data: buildToDelete, error: fetchError } = await supabase
        .from('builds')
        .select('fileName')
        .eq('id', buildId)
        .single();

      if (fetchError || !buildToDelete) {
        if (fetchError && fetchError.code === 'PGRST116') { // PGRST116: Row not found
          return res.status(404).json({ error: `Build with ID ${buildId} not found.` });
        }
        console.error(`Error fetching build ${buildId} for deletion:`, fetchError);
        throw fetchError || new Error('Build not found for deletion.');
      }

      if (buildToDelete.fileName) {
        if (appSettings.useSupabaseStorage) {
          const { error: storageError } = await supabase.storage.from('builds').remove([`builds/${buildToDelete.fileName}`]);
          if (storageError) console.warn(`Supabase Storage: Failed to delete file builds/${buildToDelete.fileName}: ${storageError.message}. Continuing with DB record deletion.`);
        } else {
          const localFilePath = path.join((process as NodeJS.Process).cwd(), appSettings.localBuildPath, buildToDelete.fileName);
          try {
            if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
            console.log(`[DeleteOp] Local file ${localFilePath} deleted (DB was Supabase).`);
          } catch (e) { console.error(`[DeleteOp] Error deleting local file ${localFilePath} (DB was Supabase):`, e); }
        }
      }
      
      const { error: buildDeleteError } = await supabase.from('public.builds').delete().eq('id', buildId);
      if (buildDeleteError) {
        console.error(`Error deleting build record ${buildId} from Supabase:`, buildDeleteError);
        throw buildDeleteError;
      }

    } else {
      const success = localDbService.deleteLocalBuild(buildId, appSettings.localBuildPath, appSettings.useSupabaseStorage);
      if (!success) {
        const buildExists = localDbService.getLocalBuildById(buildId);
        if (!buildExists) return res.status(404).json({ error: `Build with ID ${buildId} not found.` });
        throw new Error('Failed to delete build from local DB.');
      }
    }

    return res.status(200).json({ success: true, message: `Build ${buildId} and associated data deleted successfully.` });

  } catch (error: any) {
    console.error(`Unexpected error during build deletion for ID ${buildId}:`, error);
    return res.status(500).json({ error: 'An unexpected error occurred during build deletion.', details: error.message });
  }
}
