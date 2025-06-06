
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../../lib/supabaseClient';
import { AppVersion, BuildStatus, BuildSource, AppSettings } from '../../../../types';
import { ForceRebuildPayload, ForceRebuildApiResponse } from '../../../../apiTypes';
import * as localDbService from '../../../../services/localDbService';
import { getAPISettingsDirectly } from '@/lib /settingsUtil';

function getNextRebuildVersion(currentVersion: string | undefined, suffixBase: string): string {
  if (!currentVersion) return `0-${suffixBase}-1`;
  const rebuildSuffixRegex = new RegExp(`-${suffixBase}-(\\d+)$`);
  const match = currentVersion.match(rebuildSuffixRegex);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return currentVersion.replace(rebuildSuffixRegex, `-${suffixBase}-${nextNum}`);
  }
  return `${currentVersion}-${suffixBase}-1`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ForceRebuildApiResponse | { error: string; details?: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let appSettings: AppSettings;
  try {
    appSettings = await getAPISettingsDirectly();
  } catch (settingsError: any) {
    console.error('API Route Rebuild: Critical error fetching settings:', settingsError);
    return res.status(500).json({ error: 'Failed to retrieve application settings', details: settingsError.message });
  }
  
  const { id: originalBuildId } = req.query;
  const { triggeredByUsername } = req.body as Partial<ForceRebuildPayload>;

  if (!originalBuildId || typeof originalBuildId !== 'string') {
    return res.status(400).json({ error: 'Original Build ID is required.' });
  }
  if (!triggeredByUsername) {
    return res.status(400).json({ error: 'triggeredByUsername is required.' });
  }

  try {
    let newBuild: AppVersion | null = null;

    if (appSettings.useSupabase) {
      const { data: originalBuild, error: fetchError } = await supabase
        .from('builds')
        .select('*')
        .eq('id', originalBuildId)
        .single();
      if (fetchError || !originalBuild) {
        return res.status(404).json({ error: `Original build ${originalBuildId} not found.` });
      }

      const newBuildDataSupabase: Omit<AppVersion, 'id'> = {
        ...originalBuild,
        versionName: getNextRebuildVersion(originalBuild.versionName, 'rbld'),
        versionCode: getNextRebuildVersion(originalBuild.versionCode, 'RBLD'),
        changelog: `Forced rebuild of v${originalBuild.versionName}. Triggered by ${triggeredByUsername}.\n---\nOriginal Changelog:\n${originalBuild.changelog}`,
        previousChangelog: originalBuild.changelog,
        uploadDate: new Date().toISOString(),
        buildStatus: BuildStatus.Success, 
        downloadCount: 0,
        qrCodeUrl: `https://picsum.photos/150/150?random=${new Date().getTime()}`, 
        source: BuildSource.MANUAL_UPLOAD,
        triggeredBy: triggeredByUsername,
        ciBuildId: undefined, pipelineStatus: undefined, ciLogsUrl: undefined,
      };
      delete (newBuildDataSupabase as any).id;

      const { data, error: insertError } = await supabase.from('public.builds').insert(newBuildDataSupabase).select().single();
      if (insertError) throw insertError;
      newBuild = data as AppVersion;
    } else {
      newBuild = localDbService.forceRebuildLocal(originalBuildId, triggeredByUsername);
      if (!newBuild) {
        return res.status(404).json({ error: `Original build ${originalBuildId} not found in local DB.` });
      }
    }

    if (!newBuild) { 
        return res.status(500).json({error: "Failed to create rebuilt build."});
    }

    return res.status(201).json({ message: 'Build rebuilt successfully.', newBuild });

  } catch (error: any) {
    console.error('Unexpected error during force rebuild:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.', details: error.message });
  }
}
