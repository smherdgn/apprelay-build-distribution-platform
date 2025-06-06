
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Platform, Channel, UserRole, DEFAULT_SETTINGS } from '../types'; 
import * as apiClient from '../services/apiClient'; 
import { CreateBuildPayload } from '../apiTypes'; 
import { UploadIcon as UploadActionIcon } from '../components/icons';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import AppLayout from '../components/layout/AppLayout'; 
import ProtectedRoute from '../components/layout/ProtectedRoute'; 
import { useSettings } from '../contexts/SettingsContext'; // Import useSettings

const UploadPageContent: React.FC = () => {
  const router = useRouter();
  const { getSetting } = useSettings();

  const defaultChannelSetting = getSetting('defaultChannel', DEFAULT_SETTINGS.defaultChannel);
  const maxUploadSizeMBSetting = getSetting('maxUploadSizeMB', DEFAULT_SETTINGS.maxUploadSizeMB);

  const [appName, setAppName] = useState('MyApp NextGen');
  const [versionName, setVersionName] = useState('1.0.0');
  const [versionCode, setVersionCode] = useState('100');
  const [platform, setPlatform] = useState<Platform>(Platform.Android);
  const [channel, setChannel] = useState<Channel>(defaultChannelSetting);
  const [changelog, setChangelog] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [commitHash, setCommitHash] = useState('');
  const [allowedUDIDsInput, setAllowedUDIDsInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setChannel(defaultChannelSetting); // Update if setting changes post-mount (though unlikely for this)
  }, [defaultChannelSetting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    if (!file) {
      setUploadError("Please select a build file (.ipa or .apk).");
      return;
    }
    if (file.size > maxUploadSizeMBSetting * 1024 * 1024) {
      setUploadError(`File size (${(file.size / (1024*1024)).toFixed(1)}MB) exceeds the maximum limit of ${maxUploadSizeMBSetting}MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const metadataPayload: CreateBuildPayload = {
        appName,
        versionName,
        versionCode,
        platform,
        channel,
        changelog,
        commitHash: commitHash || undefined,
      };

      if (platform === Platform.iOS && allowedUDIDsInput.trim() !== '') {
        const parsedUDIDs = allowedUDIDsInput.split('\n').map(s => s.trim()).filter(Boolean);
        if (parsedUDIDs.length > 0) {
          metadataPayload.allowedUDIDs = JSON.stringify(parsedUDIDs);
        }
      }
      
      const response = await apiClient.addBuild(metadataPayload, file, maxUploadSizeMBSetting); 
      
      alert(`Build ${response.build.appName} v${response.build.versionName} uploaded successfully!`);
      router.push(`/builds/${response.build.id}`);
    } catch (error: any) {
      setUploadError(`Failed to upload build: ${error.message || 'Unknown error'}`);
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-sky-300">Upload New Build</h1>
      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {uploadError && (
            <div className="p-3 bg-red-700/30 border border-red-600/50 rounded-md text-red-300 text-sm">
              {uploadError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="App Name" value={appName} onChange={e => setAppName(e.target.value)} required />
            <Select
              label="Platform"
              options={Object.values(Platform).map(p => ({ value: p, label: p }))}
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value as Platform);
                if (e.target.value !== Platform.iOS) {
                  setAllowedUDIDsInput(''); 
                }
              }}
              required
            />
            <Input label="Version Name (e.g., 1.2.3)" value={versionName} onChange={e => setVersionName(e.target.value)} required />
            <Input label="Version Code (e.g., 123)" value={versionCode} onChange={e => setVersionCode(e.target.value)} required />
            <Select
              label="Channel"
              options={Object.values(Channel).map(c => ({ value: c, label: c }))}
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              required
            />
            <Input label="Commit Hash (Optional)" value={commitHash} onChange={e => setCommitHash(e.target.value)} placeholder="e.g., a1b2c3d" />
             <div>
              <label htmlFor="buildFile" className="block text-sm font-medium text-slate-300 mb-1">
                Build File (.ipa/.apk) - Max {maxUploadSizeMBSetting}MB 
                <span className="text-red-400 ml-1">*</span>
              </label>
              <input 
                type="file" 
                id="buildFile"
                accept=".ipa,.apk"
                onChange={(e) => {
                  setFile(e.target.files ? e.target.files[0] : null);
                  setUploadError(null); // Clear error on new file selection
                }} 
                required 
                className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-600 file:text-sky-50 hover:file:bg-sky-700 transition-colors"
                aria-describedby="file-error-message"
              />
              <span id="file-error-message" className="text-xs text-red-400 mt-1" aria-live="polite">
                {file && file.size > maxUploadSizeMBSetting * 1024 * 1024 ? `File is too large. Max size: ${maxUploadSizeMBSetting}MB.` : ''}
              </span>
            </div>
            {platform === Platform.iOS && (
              <div className="md:col-span-2">
                <label htmlFor="allowedUDIDs" className="block text-sm font-medium text-slate-300 mb-1">Allowed UDIDs (iOS Only - One per line)</label>
                <textarea
                  id="allowedUDIDs"
                  rows={3}
                  className="block w-full bg-slate-700/50 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                  value={allowedUDIDsInput}
                  onChange={e => setAllowedUDIDsInput(e.target.value)}
                  placeholder="Enter one UDID per line..."
                />
              </div>
            )}
          </div>
          <div>
            <label htmlFor="changelog" className="block text-sm font-medium text-slate-300 mb-1">
              Changelog (Markdown supported)
              <span className="text-red-400 ml-1">*</span>
            </label>
            <textarea
              id="changelog"
              rows={6}
              className="block w-full bg-slate-700/50 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
              value={changelog}
              onChange={e => setChangelog(e.target.value)}
              placeholder="Enter changelog details..."
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="lg" disabled={isUploading || !file} leftIcon={isUploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : <UploadActionIcon className="w-5 h-5"/>}>
              {isUploading ? 'Uploading Build...' : 'Upload Build'}
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};

const UploadPage: React.FC = () => {
  return (
    <ProtectedRoute allowedRoles={[UserRole.Admin, UserRole.Developer]}>
      <AppLayout>
        <UploadPageContent />
      </AppLayout>
    </ProtectedRoute>
  );
};

export default UploadPage;
