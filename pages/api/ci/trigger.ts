
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { AppVersion, BuildSource, BuildStatus, Platform, Channel, AppSettings } from '../../../types';
import { TriggerCIPayload, TriggerCIApiResponse } from '../../../apiTypes';
import * as localDbService from '../../../services/localDbService';
 import { v4 as uuidv4 } from 'uuid';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { UserRole } from '../../../types';
import { getAPISettingsDirectly } from '@/lib /settingsUtil';


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TriggerCIApiResponse | { error: string; details?: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let appSettings: AppSettings;
  try {
    appSettings = await getAPISettingsDirectly();
  } catch (settingsError: any) {
    console.error('API Route /ci/trigger: Critical error fetching settings:', settingsError);
    return res.status(500).json({ error: 'Failed to retrieve application settings', details: settingsError.message });
  }

  if (!appSettings.ciIntegrationEnabled) {
    return res.status(403).json({ error: 'CI/CD integration is disabled in settings.' });
  }

  const supabaseServerClient = createPagesServerClient({ req, res });
  const { data: { user } } = await supabaseServerClient.auth.getUser();

  if (!user || (user.user_metadata?.role !== UserRole.Admin && user.user_metadata?.role !== UserRole.Developer) ) {
    return res.status(403).json({ error: 'Forbidden: Admin or Developer access required to trigger CI builds.' });
  }

  try {
    const { projectName, branch, triggeredByUsername, platform, channel } = req.body as TriggerCIPayload;

    if (!projectName || !branch || !triggeredByUsername || !platform || !channel) {
      return res.status(400).json({ error: 'Missing required fields: projectName, branch, triggeredByUsername, platform, channel' });
    }
    if (!Object.values(Platform).includes(platform) || !Object.values(Channel).includes(channel)) {
        return res.status(400).json({ error: 'Invalid platform or channel value.' });
    }

    // Simulate CI build trigger - create a placeholder build record
    const ciBuildId = `ci-${uuidv4().substring(0, 8)}`;
    // Type definition for addLocalBuild param is Omit<AppVersion, 'id' | 'qrCodeUrl'> & { qrCodeUrl?: string }
    // This means 'downloadUrl' is required.
    const newBuildData: Omit<AppVersion, 'id' | 'qrCodeUrl'> & { qrCodeUrl?: string } = {
      appName: projectName,
      versionName: `0.0.0-${branch}-${ciBuildId.substring(0,5)}`, // Placeholder version
      versionCode: `0`, // Placeholder version code
      platform,
      channel,
      changelog: `Build triggered from branch: ${branch} by ${triggeredByUsername}. Awaiting CI completion.`,
      uploadDate: new Date().toISOString(),
      buildStatus: BuildStatus.Success, // Overall status of the record itself
      pipelineStatus: BuildStatus.InProgress, // Specific CI pipeline status
      commitHash: branch, // Or a more specific commit if available from payload
      size: 'N/A',
      fileName: `${ciBuildId}.placeholder`,
      fileType: 'application/octet-stream',
      downloadCount: 0,
      source: BuildSource.CI_PIPELINE,
      ciBuildId: ciBuildId,
      triggeredBy: triggeredByUsername,
      ciLogsUrl: `${appSettings.apiBaseUrl}/ci/logs/${ciBuildId}`, // Placeholder logs URL
      downloadUrl: `${appSettings.apiBaseUrl}/api/local-downloads/${ciBuildId}.placeholder`, // Added placeholder downloadUrl
      // qrCodeUrl is optional here and will be handled by addLocalBuild if not provided
    };

    let createdBuild: AppVersion;

    if (appSettings.useSupabase) {
      // Supabase insertion logic (doesn't use localDbService.addLocalBuild)
      const { data, error } = await supabase
        .from('builds')
        // Cast newBuildData to the broader type expected by Supabase if needed,
        // though it should be compatible. Ensure all fields Supabase expects are present.
        .insert(newBuildData as Omit<AppVersion, 'id'>) 
        .select()
        .single();
      if (error) {
        console.error('Supabase error creating CI placeholder build:', error);
        throw error;
      }
      if(!data) throw new Error('Failed to insert CI placeholder build into Supabase.');
      createdBuild = data as AppVersion;
    } else {
      createdBuild = localDbService.addLocalBuild(newBuildData);
    }
    
    // Simulate CI process (in a real scenario, a webhook would update this later)
    // For demo, we can set a timeout to change status to Success/Failed
    setTimeout(async () => {
        const finalStatus = Math.random() > 0.2 ? BuildStatus.Success : BuildStatus.Failed; // 80% success
        const updatedFields: Partial<AppVersion> = {
            pipelineStatus: finalStatus,
            buildStatus: finalStatus, // Update overall status as well
            size: finalStatus === BuildStatus.Success ? `${(Math.random() * 100 + 50).toFixed(1)} MB` : 'N/A',
            fileName: finalStatus === BuildStatus.Success ? `${ciBuildId}.${platform === Platform.iOS ? 'ipa' : 'apk'}` : `${ciBuildId}.placeholder`,
            downloadUrl: finalStatus === BuildStatus.Success ? `${appSettings.apiBaseUrl}/api/local-downloads/${ciBuildId}.${platform === Platform.iOS ? 'ipa' : 'apk'}` : '#', // Example
            changelog: `${createdBuild.changelog}\nCI process ${finalStatus === BuildStatus.Success ? 'completed successfully.' : 'failed.'}`
        };
        if (finalStatus === BuildStatus.Success) {
            updatedFields.versionName = `1.0.0-${branch}-${ciBuildId.substring(0,5)}`;
            updatedFields.versionCode = `${Math.floor(Math.random()*100)+1}`;
        }

        if (appSettings.useSupabase) {
            await supabase.from('public.builds').update(updatedFields).eq('id', createdBuild.id);
        } else {
            const current = localDbService.getLocalBuildById(createdBuild.id);
            if (current) {
                // const updated = { ...current, ...updatedFields }; // This line was causing TS6133
                // Need an update function in localDbService or re-insert (which is complex due to ID)
                // For simplicity, this part of local simulation is less robust.
                // Ideally, localDbService.updateLocalBuild(createdBuild.id, updatedFields);
                console.log(`[Local CI Sim] Build ${createdBuild.id} would be updated with fields:`, updatedFields);
            }
        }
        console.log(`[CI Sim] Build ${createdBuild.id} pipeline finished with status: ${finalStatus}`);
    }, 15000); // Simulate 15 seconds CI process


    res.status(202).json({ message: `CI Build triggered for ${projectName} on branch ${branch}. Build ID: ${createdBuild.id}`, newBuild: createdBuild });

  } catch (error: any) {
    console.error('Error triggering CI build:', error);
    res.status(500).json({ error: 'Failed to trigger CI build', details: error.message });
  }
}