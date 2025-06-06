
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { AppSettings } from '../../../types'; 
import { getAPISettingsDirectly } from '@/lib /settingsUtil';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { filename } = req.query;

  if (!filename || typeof filename !== 'string') {
    return res.status(400).send('Filename is required.');
  }

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).send('Invalid filename.');
  }
  
  let appSettings: AppSettings;
  try {
    appSettings = await getAPISettingsDirectly();
  } catch (settingsError: any) {
    console.error('API Route /local-downloads: Critical error fetching settings:', settingsError);
    // For file serving, if settings fail, it's hard to proceed safely.
    return res.status(500).json({ error: 'Failed to retrieve application settings, cannot serve file.', details: settingsError.message });
  }

  if (appSettings.useSupabaseStorage) {
      console.warn(`[LocalDownload] Attempted to download ${filename} via local endpoint, but Supabase Storage is currently active in settings. This might be for an older build or misconfiguration.`);
      // Depending on policy, you might want to forbid this or allow for legacy files.
      // For now, we allow, assuming the file URL was generated when local storage was active.
  }
  
  const localBuildStoragePath = appSettings.localBuildPath; 
  const filesDir = path.resolve((process as NodeJS.Process).cwd(), localBuildStoragePath);
  const filePath = path.join(filesDir, filename);

  if (path.dirname(filePath) !== filesDir) {
      console.error(`[LocalDownload] Path traversal attempt detected or misconfiguration. Requested: ${filename}, Resolved: ${filePath}, Expected Dir: ${filesDir}`);
      return res.status(403).send('Forbidden.');
  }

  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      let contentType = 'application/octet-stream'; 
      if (filename.endsWith('.apk')) {
        contentType = 'application/vnd.android.package-archive';
      } else if (filename.endsWith('.ipa')) {
        contentType = 'application/octet-stream'; 
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); 

      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
      
      readStream.on('error', (err) => {
        console.error(`[LocalDownload] Error streaming file ${filePath}:`, err);
        if (!res.headersSent) {
          res.status(500).send('Error streaming file.');
        } else {
          res.end();
        }
      });

      readStream.on('close', () => {
        console.log(`[LocalDownload] Finished streaming ${filename}`);
      });

    } else {
      console.log(`[LocalDownload] File not found: ${filePath}`);
      res.status(404).send('File not found.');
    }
  } catch (error) {
    console.error(`[LocalDownload] Error accessing file ${filePath}:`, error);
    res.status(500).send('Error accessing file.');
  }
}
