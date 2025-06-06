
import type { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { AppSettings, MonitoredRepository, UserRole, Platform, Channel } from '../../../../types';
import { 
    UpdateMonitoredRepositoryPayload, 
    UpdateMonitoredRepositoryApiResponse, 
    DeleteMonitoredRepositoryApiResponse 
} from '../../../../apiTypes';
import { supabase } from '../../../../lib/supabaseClient'; 
import * as localDbService from '../../../../services/localDbService';
import { getAPISettingsDirectly } from '@/lib /settingsUtil';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateMonitoredRepositoryApiResponse | DeleteMonitoredRepositoryApiResponse | { error: string; details?: string }>
) {
  let appSettings: AppSettings;
  try {
    appSettings = await getAPISettingsDirectly();
  } catch (settingsError: any) {
    console.error('API Route /ci/repositories/[id]: Critical error fetching settings:', settingsError);
    return res.status(500).json({ error: 'Failed to retrieve application settings', details: settingsError.message });
  }

  const supabaseServerClient = createPagesServerClient({ req, res });
  const { data: { user } } = await supabaseServerClient.auth.getUser();

  if (!user || user.user_metadata?.role !== UserRole.Admin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Repository ID is required.' });
  }

  if (req.method === 'PUT') {
    try {
      if (!appSettings.ciIntegrationEnabled) {
        return res.status(403).json({ error: 'CI integration is disabled in settings.'});
      }
      const payload = req.body as UpdateMonitoredRepositoryPayload;
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ error: 'No update data provided.' });
      }
      if (payload.default_platform && !Object.values(Platform).includes(payload.default_platform)) {
        return res.status(400).json({ error: 'Invalid platform value.' });
      }
      if (payload.default_channel && !Object.values(Channel).includes(payload.default_channel)) {
        return res.status(400).json({ error: 'Invalid channel value.' });
      }

      let updatedRepository: MonitoredRepository | null;

      if (appSettings.useSupabase) {
        const updateData = { ...payload, updated_at: new Date().toISOString() };
        const { data, error } = await supabase
          .from('monitored_repositories')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (error) {
             if (error.code === '23505') { 
                 return res.status(409).json({ error: 'Update failed, repository URL might already exist for another entry.', details: error.message });
            }
            console.error(`Supabase error updating monitored repository ${id}:`, error);
            throw error;
        }
        if (!data) return res.status(404).json({ error: 'Repository not found for update.'});
        updatedRepository = data as MonitoredRepository;
      } else {
        updatedRepository = localDbService.updateLocalMonitoredRepository(id, payload);
        if (!updatedRepository) return res.status(404).json({ error: 'Repository not found in local DB for update.'});
      }
      
      res.status(200).json({ repository: updatedRepository, message: 'Monitored repository updated successfully.' });
    } catch (error: any) {
      console.error(`Error updating monitored repository ${id}:`, error);
       if (error.message && error.message.toLowerCase().includes('unique constraint failed: monitored_repositories.repo_url')) {
          return res.status(409).json({ error: 'Update failed, repository URL might already exist for another entry (local DB).', details: error.message });
      }
      res.status(500).json({ error: 'Failed to update monitored repository', details: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      if (!appSettings.ciIntegrationEnabled) {
        return res.status(403).json({ error: 'CI integration is disabled in settings.'});
      }
      let success = false;
      if (appSettings.useSupabase) {
        const { error, count } = await supabase
          .from('monitored_repositories')
          .delete({ count: 'exact' })
          .eq('id', id);
        if (error) {
            console.error(`Supabase error deleting monitored repository ${id}:`, error);
            throw error;
        }
        if (count === 0) return res.status(404).json({ error: 'Repository not found for deletion.'});
        success = true;
      } else {
        success = localDbService.deleteLocalMonitoredRepository(id);
        if (!success) return res.status(404).json({ error: 'Repository not found in local DB for deletion.'});
      }
      
      res.status(200).json({ success: true, message: 'Monitored repository deleted successfully.' });
    } catch (error: any) {
      console.error(`Error deleting monitored repository ${id}:`, error);
      res.status(500).json({ error: 'Failed to delete monitored repository', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
