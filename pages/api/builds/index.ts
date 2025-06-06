
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient'; 
import { AppVersion, BuildSource, BuildStatus, Platform, Channel, AppSettings } from '../../../types'; 
import { notifyNewBuild } from '../../../services/notificationService'; 
import * as localDbService from '../../../services/localDbService';
import formidable from 'formidable'; 
import fs from 'fs'; 
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; 
import { getAPISettingsDirectly } from '@/lib /settingsUtil';
 
export const config = {
  api: {
    bodyParser: false,
  },
};

async function enforceSupabaseRetentionPolicy(
  appName: string, 
  platform: Platform, 
  channel: Channel,
  currentAppSettings: AppSettings
) {
  console.info(`[SupabaseRetention] Checking for builds to prune for group: ${appName} | ${platform} | ${channel}`);
  try {
    const { maxBuildsPerGroup, deletePolicy, enableAutoClean } = currentAppSettings;

    if (!enableAutoClean) {
      console.info(`[SupabaseRetention] Auto-cleaning is disabled. Skipping prune.`);
      return;
    }
    
    let groupBuildsQuery = supabase
      .from('builds')
      .select('id, fileName, uploadDate, source') 
      .eq('appName', appName)
      .eq('platform', platform)
      .eq('channel', channel);

    if (deletePolicy === 'CIOnly') {
      groupBuildsQuery = groupBuildsQuery.eq('source', BuildSource.CI_PIPELINE);
    }
    
    groupBuildsQuery = groupBuildsQuery.order('uploadDate', { ascending: false });
    const { data: groupBuilds, error: fetchError } = await groupBuildsQuery;

    if (fetchError) {
      console.error(`[SupabaseRetention] Error fetching builds for group:`, fetchError.message);
      return;
    }

    if (groupBuilds && groupBuilds.length > maxBuildsPerGroup) {
      const buildsToDelete = groupBuilds.slice(maxBuildsPerGroup);
      console.warn(`[SupabaseRetention] Deleting ${buildsToDelete.length} oldest builds.`);

      for (const build of buildsToDelete) {
        if (build.fileName && currentAppSettings.useSupabaseStorage) { 
          const { error: storageError } = await supabase.storage.from('builds').remove([`builds/${build.fileName}`]);
          if (storageError) console.error(`[SupabaseRetention] Failed to delete ${build.fileName} from storage:`, storageError.message);
          else console.info(`[SupabaseRetention] Deleted ${build.fileName} from storage.`);
        } else if (build.fileName && !currentAppSettings.useSupabaseStorage) {
            const localFilePath = path.join((process as NodeJS.Process).cwd(), currentAppSettings.localBuildPath, build.fileName);
            try {
                if(fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
                console.info(`[SupabaseRetention - LocalFile] Deleted local file: ${localFilePath}`);
            } catch (e) {
                console.error(`[SupabaseRetention - LocalFile] Error deleting local file ${localFilePath}:`, e);
            }
        }

        const { error: dbDeleteError } = await supabase.from('public.builds').delete().eq('id', build.id);
        if (dbDeleteError) console.error(`[SupabaseRetention] Failed to delete build record ${build.id}:`, dbDeleteError.message);
        else console.info(`[SupabaseRetention] Deleted build record ${build.id}.`);
      }
    }
  } catch (error: any) {
    console.error(`[SupabaseRetention] Unexpected error:`, error.message);
  }
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let appSettings: AppSettings;
  try {
    appSettings = await getAPISettingsDirectly();
  } catch (settingsError: any) {
    console.error('API Route /builds: Critical error fetching settings:', settingsError);
    return res.status(500).json({ error: 'Failed to retrieve application settings', details: settingsError.message });
  }

  if (req.method === 'GET') {
    try {
      const { platform, channel } = req.query;
      let builds: AppVersion[];

      if (appSettings.useSupabase) {
        let query = supabase.from('public.builds').select('*').order('uploadDate', { ascending: false });
        if (platform && typeof platform === 'string') query = query.eq('platform', platform);
        if (channel && typeof channel === 'string') query = query.eq('channel', channel);
        const { data, error } = await query;
        if (error) throw error;
        builds = data || [];
      } else {
        builds = localDbService.getLocalBuilds({ 
          platform: platform as Platform | undefined, 
          channel: channel as Channel | undefined 
        });
      }
      res.status(200).json({ builds });
    } catch (error: any) {
      console.error('Error fetching builds:', error);
      res.status(500).json({ error: 'Failed to fetch builds', details: error.message });
    }
  } else if (req.method === 'POST') {
    const form = formidable({ multiples: false }); 
    let tempFilePath: string | undefined;

    try {
      const [fields, files] = await form.parse(req);

      const getStringField = (fieldName: string): string | undefined => {
        const value = fields[fieldName];
        return Array.isArray(value) && value.length > 0 ? value[0] : undefined;
      };

      const appName = getStringField('appName');
      const versionName = getStringField('versionName');
      const versionCode = getStringField('versionCode');
      const platform = getStringField('platform') as Platform | undefined;
      const channel = getStringField('channel') as Channel | undefined;
      const changelog = getStringField('changelog');
      const commitHash = getStringField('commitHash');
      const allowedUDIDsString = getStringField('allowedUDIDs');
      
      let parsedAllowedUDIDs: string[] | undefined = undefined;
      if (platform === Platform.iOS && allowedUDIDsString) {
        try {
          const tempParsed = JSON.parse(allowedUDIDsString);
          if (Array.isArray(tempParsed) && tempParsed.every(udid => typeof udid === 'string')) {
            parsedAllowedUDIDs = tempParsed;
          } else { throw new Error('allowedUDIDs must be an array of strings.'); }
        } catch (e: any) {
           return res.status(400).json({ error: 'Invalid format for allowedUDIDs.', details: e.message });
        }
      }

      if (!appName || !versionName || !versionCode || !platform || !channel || !changelog) {
        return res.status(400).json({ error: 'Missing required metadata fields.' });
      }
      
      const buildFileEntry = files.buildFile;
      if (!buildFileEntry || Array.isArray(buildFileEntry)) { 
        return res.status(400).json({ error: 'Build file (`buildFile`) is required and must be a single file.' });
      }
      const buildFile: formidable.File = buildFileEntry; // formidable.File is the correct type here from the library itself
      tempFilePath = buildFile.filepath; 

      if (!buildFile.originalFilename || !buildFile.mimetype || !buildFile.filepath) {
         return res.status(400).json({ error: 'Invalid file data received.' });
      }

      if (buildFile.size > appSettings.maxUploadSizeMB * 1024 * 1024) {
        if (tempFilePath) fs.unlinkSync(tempFilePath);
        return res.status(413).json({ error: `File size exceeds ${appSettings.maxUploadSizeMB}MB.`});
      }

      const fileExtension = buildFile.originalFilename.split('.').pop() || 'bin';
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      let fileDownloadUrl: string;
      
      if (appSettings.useSupabaseStorage) {
        const supabaseStoragePath = `builds/${uniqueFileName}`;
        const fileContent = fs.readFileSync(buildFile.filepath);
        const { error: storageError } = await supabase.storage
          .from('builds') 
          .upload(supabaseStoragePath, fileContent, { contentType: buildFile.mimetype, upsert: false });
        if (storageError) throw new Error(`Supabase Storage Error: ${storageError.message}`);
        const { data: publicUrlData } = supabase.storage.from('builds').getPublicUrl(supabaseStoragePath);
        if (!publicUrlData?.publicUrl) throw new Error('Failed to get public URL for Supabase file.');
        fileDownloadUrl = publicUrlData.publicUrl;
      } else {
        const targetDir = path.resolve((process as NodeJS.Process).cwd(), appSettings.localBuildPath);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        const localFilePath = path.join(targetDir, uniqueFileName);
        fs.copyFileSync(buildFile.filepath, localFilePath);
        fileDownloadUrl = `${appSettings.apiBaseUrl}/api/local-downloads/${uniqueFileName}`;
        console.log(`[LocalBuild] File saved to: ${localFilePath}, URL: ${fileDownloadUrl}`);
      }
      
      const newBuildData: Omit<AppVersion, 'id' | 'qrCodeUrl'> = { 
        appName, versionName, versionCode, platform, channel, changelog,
        uploadDate: new Date().toISOString(),
        buildStatus: getStringField('buildStatus') as BuildStatus || BuildStatus.Success, 
        commitHash: commitHash || undefined,
        downloadUrl: fileDownloadUrl, 
        size: `${(buildFile.size / (1024 * 1024)).toFixed(1)} MB`,
        fileName: uniqueFileName, 
        fileType: buildFile.mimetype,
        downloadCount: 0,
        source: BuildSource.MANUAL_UPLOAD, 
        allowedUDIDs: parsedAllowedUDIDs,
      };
      
      let insertedBuild: AppVersion;
      if (appSettings.useSupabase) {
        const { data, error: dbError } = await supabase.from('public.builds').insert([newBuildData]).select().single();
        if (dbError) throw dbError;
        if (!data) throw new Error("Supabase build insertion failed.");
        insertedBuild = data as AppVersion;
      } else {
        insertedBuild = localDbService.addLocalBuild(newBuildData);
      }
      
      insertedBuild.qrCodeUrl = `${appSettings.apiBaseUrl}/builds/${insertedBuild.id}/qr`; 

      res.status(201).json({ build: insertedBuild });
      
      if (appSettings.notifyOnNewBuild) {
        notifyNewBuild(insertedBuild).catch(err => console.error("[PostProcessing] Error sending notification:", err));
      }

      if (appSettings.useSupabase) {
        enforceSupabaseRetentionPolicy(insertedBuild.appName, insertedBuild.platform, insertedBuild.channel, appSettings)
          .catch(err => console.error("[PostProcessing] Error in Supabase retention policy:", err));
      } else {
        localDbService.applyLocalRetentionPolicy(insertedBuild.appName, insertedBuild.platform, insertedBuild.channel, appSettings);
      }

    } catch (error: any) {
      console.error('Error creating build:', error);
      res.status(500).json({ error: 'Failed to create build', details: error.message });
    } finally {
      if (tempFilePath) {
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error("Error deleting temp file:", tempFilePath, err);
        });
      }
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
