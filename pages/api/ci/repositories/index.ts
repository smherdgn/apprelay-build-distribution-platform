
import type { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { AppSettings, MonitoredRepository, UserRole, Platform, Channel } from '../../../../types';
import { 
    GetMonitoredRepositoriesApiResponse, 
    CreateMonitoredRepositoryPayload, 
    CreateMonitoredRepositoryApiResponse 
} from '../../../../apiTypes';
import { supabase } from '../../../../lib/supabaseClient'; 
import * as localDbService from '../../../../services/localDbService';
import { v4 as uuidv4 } from 'uuid';
import { getAPISettingsDirectly } from '@/lib /settingsUtil';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetMonitoredRepositoriesApiResponse | CreateMonitoredRepositoryApiResponse | { error: string; details?: string }>
) {
  let appSettings: AppSettings;
  try {
    appSettings = await getAPISettingsDirectly();
  } catch (settingsError: any) {
    console.error('API Route /ci/repositories: Critical error fetching settings:', settingsError);
    return res.status(500).json({ error: 'Failed to retrieve application settings', details: settingsError.message });
  }

  const supabaseServerClient = createPagesServerClient({ req, res });
  const { data: { user } } = await supabaseServerClient.auth.getUser();

  if (!user || user.user_metadata?.role !== UserRole.Admin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }

  if (req.method === 'GET') {
    try {
      if (!appSettings.ciIntegrationEnabled) {
        return res.status(200).json({ repositories: [] });
      }
      let repositories: MonitoredRepository[];
      if (appSettings.useSupabase) {
        const { data, error } = await supabase
          .from('monitored_repositories')
          .select('*')
          .order('repo_url', { ascending: true });
        if (error) {
            console.error('Supabase error fetching monitored repositories:', error);
            throw error;
        }
        repositories = data || [];
      } else {
        repositories = localDbService.getLocalMonitoredRepositories();
      }
      res.status(200).json({ repositories });
    } catch (error: any) {
      console.error('Error fetching monitored repositories:', error);
      res.status(500).json({ error: 'Failed to fetch monitored repositories', details: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      if (!appSettings.ciIntegrationEnabled) {
        return res.status(403).json({ error: 'CI integration is disabled in settings.'});
      }
      const { 
        repo_url, 
        default_branch, 
        default_platform, 
        default_channel, 
        auto_trigger_enabled 
      } = req.body as CreateMonitoredRepositoryPayload;

      if (!repo_url || !default_branch || !default_platform || !default_channel) {
        return res.status(400).json({ error: 'Missing required fields for monitored repository.' });
      }
      if (!Object.values(Platform).includes(default_platform)) {
        return res.status(400).json({ error: 'Invalid platform value.' });
      }
      if (!Object.values(Channel).includes(default_channel)) {
        return res.status(400).json({ error: 'Invalid channel value.' });
      }

      const payload: Omit<MonitoredRepository, 'id' | 'created_at' | 'updated_at'> = {
        repo_url,
        default_branch,
        default_platform,
        default_channel,
        auto_trigger_enabled: auto_trigger_enabled !== undefined ? auto_trigger_enabled : true,
      };
      
      let newRepository: MonitoredRepository;

      if (appSettings.useSupabase) {
        const dbPayload = {
            ...payload,
            id: uuidv4(), 
            created_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from('monitored_repositories')
          .insert(dbPayload)
          .select()
          .single();
        if (error) {
            if (error.code === '23505') { 
                 return res.status(409).json({ error: 'Repository URL already exists.', details: error.message });
            }
            console.error('Supabase error inserting monitored repository:', error);
            throw error;
        }
        if (!data) throw new Error("Failed to insert monitored repository into Supabase.");
        newRepository = data as MonitoredRepository;
      } else {
        newRepository = localDbService.addLocalMonitoredRepository(payload);
      }
      
      res.status(201).json({ repository: newRepository, message: 'Monitored repository added successfully.' });
    } catch (error: any) {
      console.error('Error adding monitored repository:', error);
      if (error.message && error.message.toLowerCase().includes('unique constraint failed: monitored_repositories.repo_url')) {
          return res.status(409).json({ error: 'Repository URL already exists in local DB.', details: error.message });
      }
      res.status(500).json({ error: 'Failed to add monitored repository', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
