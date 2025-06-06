
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { DashboardStats, AppSettings } from '../../../types';
import { GetDashboardStatsApiResponse } from '../../../apiTypes';
import * as localDbService from '../../../services/localDbService';
import { getAPISettingsDirectly } from '@/lib /settingsUtil';
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetDashboardStatsApiResponse | { error: string; details?: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  
  let appSettings: AppSettings;
  try {
    appSettings = await getAPISettingsDirectly();
  } catch (settingsError: any) {
    console.error('API Route /dashboard/stats: Critical error fetching settings:', settingsError);
    return res.status(500).json({ error: 'Failed to retrieve application settings', details: settingsError.message });
  }

  try {
    let stats: DashboardStats;

    if (appSettings.useSupabase) {
      const { data: builds, error: buildsError } = await supabase
        .from('builds')
        .select('id, appName, versionName, platform, channel, buildStatus, pipelineStatus, downloadCount, source');
      if (buildsError) {
        console.error('Supabase error fetching builds for dashboard stats:', buildsError);
        throw buildsError;
      }
      if (!builds) throw new Error('No builds data returned from Supabase for dashboard stats.');
      
      const totalBuilds = builds.length;
      const successfulBuilds = builds.filter(
        (build) => build.buildStatus === 'Success' || (build.source === 'CI Pipeline' && build.pipelineStatus === 'Success')
      ).length;
      const buildSuccessRatio = totalBuilds > 0 ? successfulBuilds / totalBuilds : 0;
      const channelDistribution = builds.reduce((acc, build) => {
        acc[build.channel] = (acc[build.channel] || 0) + 1;
        return acc;
      }, {} as Record<any, number>);
      const platformDistribution = builds.reduce((acc, build) => {
        acc[build.platform] = (acc[build.platform] || 0) + 1;
        return acc;
      }, {} as Record<any, number>);
      const downloadsByVersion = builds
        .filter(build => (build.downloadCount || 0) > 0)
        .sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0))
        .slice(0, 5)
        .map(build => ({
          versionId: build.id,
          appName: build.appName,
          versionName: build.versionName,
          platform: build.platform,
          count: build.downloadCount || 0,
        }));
      stats = { totalBuilds, downloadsByVersion, buildSuccessRatio, channelDistribution, platformDistribution };

    } else {
      stats = localDbService.getLocalDashboardStats();
    }

    return res.status(200).json({ stats });

  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard statistics.', details: error.message });
  }
}
