import React, { useState, useEffect, FormEvent, useCallback } from 'react';
import { AppSettings, UserRole, Channel, DEFAULT_SETTINGS, MonitoredRepository, Platform } from '../types';
import * as apiClient from '../services/apiClient';
import { CreateMonitoredRepositoryPayload, UpdateMonitoredRepositoryPayload } from '../apiTypes';
import { useSettings } from '../contexts/SettingsContext';
import AppLayout from '../components/layout/AppLayout';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Switch from '../components/ui/Switch'; 
import Modal from '../components/ui/Modal';
import { SaveIcon, RefreshCwIcon, PlusCircleIcon, Edit3Icon, Trash2Icon, GitBranchIcon } from '../components/icons'; 

interface MonitoredRepoModalState {
  isOpen: boolean;
  repo: MonitoredRepository | Partial<MonitoredRepository> | null; // Use partial for new repo
  isEditing: boolean;
}

const SettingsPageContent: React.FC = () => {
  const { settings: globalSettings, isLoadingSettings: isLoadingGlobalSettings, fetchSettings, saveSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Monitored Repositories State
  const [monitoredRepos, setMonitoredRepos] = useState<MonitoredRepository[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoModalState, setRepoModalState] = useState<MonitoredRepoModalState>({ isOpen: false, repo: null, isEditing: false });
  const [repoForm, setRepoForm] = useState<Partial<MonitoredRepository>>({});


  const ciIntegrationEnabled = globalSettings.ciIntegrationEnabled;

  const fetchMonitoredRepositories = useCallback(async () => {
    if (!ciIntegrationEnabled) {
        setMonitoredRepos([]);
        return;
    }
    setIsLoadingRepos(true);
    try {
      const response = await apiClient.getMonitoredRepositories();
      setMonitoredRepos(response.repositories || []);
    } catch (error) {
      console.error("Failed to fetch monitored repositories:", error);
      setStatusMessage({ type: 'error', message: `Failed to load monitored repositories: ${(error as Error).message}` });
      setMonitoredRepos([]);
    } finally {
      setIsLoadingRepos(false);
    }
  }, [ciIntegrationEnabled]);

  useEffect(() => {
    if (!isLoadingGlobalSettings && globalSettings) {
      setLocalSettings(globalSettings);
      if (globalSettings.ciIntegrationEnabled) {
        fetchMonitoredRepositories();
      } else {
        setMonitoredRepos([]); // Clear if CI is disabled
      }
    }
  }, [globalSettings, isLoadingGlobalSettings, fetchMonitoredRepositories]);

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setStatusMessage(null); 
    setLocalSettings(prev => ({
        ...prev,
        [key]: value, 
    }));
  };

  const handleSubmitAppSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    
    const { id, created_at, ...payload } = localSettings;

    const success = await saveSettings(payload);
    if (success) {
      setStatusMessage({ type: 'success', message: 'Settings updated successfully! Some changes might require a refresh or app restart.' });
    } else {
      setStatusMessage({ type: 'error', message: 'Failed to update settings. Please try again.' });
      fetchSettings(); 
    }
    setIsSaving(false);
  };
  
  const handleRefresh = () => {
    setStatusMessage(null);
    fetchSettings();
    if (ciIntegrationEnabled) fetchMonitoredRepositories();
  };

  // Monitored Repo Modal Handlers
  const openRepoModal = (repoToEdit?: MonitoredRepository) => {
    if (repoToEdit) {
      setRepoForm(repoToEdit);
      setRepoModalState({ isOpen: true, repo: repoToEdit, isEditing: true });
    } else {
      setRepoForm({ 
        repo_url: '', 
        default_branch: 'main', 
        default_platform: Platform.Android, 
        default_channel: Channel.Beta, 
        auto_trigger_enabled: true 
      });
      setRepoModalState({ isOpen: true, repo: null, isEditing: false });
    }
  };

  const closeRepoModal = () => {
    setRepoModalState({ isOpen: false, repo: null, isEditing: false });
    setRepoForm({});
    setStatusMessage(null); // Clear any form-specific messages
  };

  const handleRepoFormChange = (field: keyof CreateMonitoredRepositoryPayload, value: any) => {
    setStatusMessage(null);
    setRepoForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveRepository = async () => {
    if (!repoForm.repo_url || !repoForm.default_branch || !repoForm.default_platform || !repoForm.default_channel) {
      setStatusMessage({ type: 'error', message: 'All repository fields are required.' });
      return;
    }
    
    setIsSaving(true);
    setStatusMessage(null);

    const payload: CreateMonitoredRepositoryPayload = {
      repo_url: repoForm.repo_url!,
      default_branch: repoForm.default_branch!,
      default_platform: repoForm.default_platform!,
      default_channel: repoForm.default_channel!,
      auto_trigger_enabled: repoForm.auto_trigger_enabled !== undefined ? repoForm.auto_trigger_enabled : true,
    };

    try {
      if (repoModalState.isEditing && repoModalState.repo?.id) {
        await apiClient.updateMonitoredRepository(repoModalState.repo.id, payload as UpdateMonitoredRepositoryPayload);
        setStatusMessage({ type: 'success', message: 'Repository updated successfully.' });
      } else {
        await apiClient.addMonitoredRepository(payload);
        setStatusMessage({ type: 'success', message: 'Repository added successfully.' });
      }
      fetchMonitoredRepositories();
      closeRepoModal();
    } catch (error: any) {
      console.error("Failed to save repository:", error);
      setStatusMessage({ type: 'error', message: `Failed to save repository: ${error.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRepository = async (repoId: string) => {
    if (!window.confirm("Are you sure you want to delete this monitored repository?")) return;
    setIsSaving(true); // Use general saving flag or a specific one for repo deletion
    setStatusMessage(null);
    try {
      await apiClient.deleteMonitoredRepository(repoId);
      setStatusMessage({ type: 'success', message: 'Repository deleted successfully.' });
      fetchMonitoredRepositories();
    } catch (error: any) {
      console.error("Failed to delete repository:", error);
      setStatusMessage({ type: 'error', message: `Failed to delete repository: ${error.message}` });
    } finally {
      setIsSaving(false);
    }
  };


  if (isLoadingGlobalSettings && localSettings.id === DEFAULT_SETTINGS.id) { 
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <h1 className="text-3xl font-bold text-sky-300">Application Settings</h1>
        <Button onClick={handleRefresh} variant="ghost" size="sm" leftIcon={<RefreshCwIcon className="w-4 h-4"/>} disabled={isLoadingGlobalSettings || isSaving}>
          Refresh Settings
        </Button>
      </div>

      {statusMessage && !repoModalState.isOpen && ( // Only show global status if modal is closed
        <GlassCard className={statusMessage.type === 'success' ? 'border-green-500/50' : 'border-red-500/50'}>
          <p className={statusMessage.type === 'success' ? 'text-green-300' : 'text-red-300'}>{statusMessage.message}</p>
        </GlassCard>
      )}

      <GlassCard>
        <form onSubmit={handleSubmitAppSettings} className="space-y-8">
          
          <section>
            <h2 className="text-xl font-semibold text-sky-400 mb-4 border-b border-slate-700 pb-2">Runtime Environment</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Switch
                label="Use Supabase Database"
                id="useSupabase"
                checked={localSettings.useSupabase}
                onChange={checked => handleChange('useSupabase', checked)}
                srLabel="Toggle Supabase Database usage. If off, a local SQLite database will be used (requires app restart/rebuild to take full effect on backend)."
              />
              <Switch
                label="Use Supabase Storage for Builds"
                id="useSupabaseStorage"
                checked={localSettings.useSupabaseStorage}
                onChange={checked => handleChange('useSupabaseStorage', checked)}
                disabled={!localSettings.useSupabase} 
                srLabel="Toggle Supabase Storage for build files. If off, local file storage will be used. Dependent on 'Use Supabase Database' for metadata."
              />
              <Input
                label="API Base URL (for local downloads)"
                id="apiBaseUrl"
                type="url"
                value={localSettings.apiBaseUrl}
                onChange={e => handleChange('apiBaseUrl', e.target.value)}
                placeholder="e.g., http://localhost:3000"
                wrapperClassName="md:col-span-2"
              />
              <Input
                label="Local Build Files Path (relative to project root)"
                id="localBuildPath"
                type="text"
                value={localSettings.localBuildPath}
                onChange={e => handleChange('localBuildPath', e.target.value)}
                placeholder="e.g., _local_build_storage"
                wrapperClassName="md:col-span-2"
                disabled={localSettings.useSupabaseStorage}
              />
               <p className="text-xs text-slate-400 md:col-span-2">Note: Changing runtime environment settings (`useSupabase`, `useSupabaseStorage`, `localBuildPath`) might require an application restart for backend services to fully adopt the new configuration.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sky-400 mb-4 border-b border-slate-700 pb-2">Build Management & Retention</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Input
                label="Max Builds Per Group"
                id="maxBuildsPerGroup"
                type="number"
                value={localSettings.maxBuildsPerGroup.toString()}
                onChange={e => handleChange('maxBuildsPerGroup', parseInt(e.target.value, 10) || 0)}
                min="1"
              />
              <Select
                label="Build Deletion Policy"
                id="deletePolicy"
                options={[{ value: 'CIOnly', label: 'CI Builds Only' }, { value: 'All', label: 'All Builds' }]}
                value={localSettings.deletePolicy}
                onChange={e => handleChange('deletePolicy', e.target.value as 'CIOnly' | 'All')}
              />
              <Switch
                label="Enable Auto Clean Old Builds"
                id="enableAutoClean"
                checked={localSettings.enableAutoClean}
                onChange={checked => handleChange('enableAutoClean', checked)}
              />
              <Select
                label="Default Upload Channel"
                id="defaultChannel"
                options={Object.values(Channel).map(c => ({ value: c, label: c }))}
                value={localSettings.defaultChannel}
                onChange={e => handleChange('defaultChannel', e.target.value as Channel)}
              />
              <Input
                label="Max Upload Size (MB)"
                id="maxUploadSizeMB"
                type="number"
                value={localSettings.maxUploadSizeMB.toString()}
                onChange={e => handleChange('maxUploadSizeMB', parseInt(e.target.value, 10) || 1)}
                min="1"
              />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sky-400 mb-4 border-b border-slate-700 pb-2">Feature Toggles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <Switch
                label="Enable Gemini Changelog Analysis"
                id="geminiEnabled"
                checked={localSettings.geminiEnabled}
                onChange={checked => handleChange('geminiEnabled', checked)}
              />
              <Switch
                label="Enable User Feedback System"
                id="feedbackEnabled"
                checked={localSettings.feedbackEnabled}
                onChange={checked => handleChange('feedbackEnabled', checked)}
              />
              <Switch
                label="Enable CI/CD Integration Features"
                id="ciIntegrationEnabled"
                checked={localSettings.ciIntegrationEnabled}
                onChange={checked => {
                    handleChange('ciIntegrationEnabled', checked);
                    if (checked) fetchMonitoredRepositories(); // Fetch repos if enabling
                    else setMonitoredRepos([]); // Clear if disabling
                }}
              />
              <Switch
                label="Notify on New Build Upload"
                id="notifyOnNewBuild"
                checked={localSettings.notifyOnNewBuild}
                onChange={checked => handleChange('notifyOnNewBuild', checked)}
              />
               <Switch
                label="Build Approval Required (Future)"
                id="buildApprovalRequired"
                checked={localSettings.buildApprovalRequired}
                onChange={checked => handleChange('buildApprovalRequired', checked)}
                disabled 
              />
            </div>
          </section>
          
          {ciIntegrationEnabled && (
          <section>
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h2 className="text-xl font-semibold text-sky-400">Monitored Repositories (for Auto-Builds)</h2>
                <Button variant="secondary" size="sm" onClick={() => openRepoModal()} leftIcon={<PlusCircleIcon className="w-4 h-4"/>} disabled={isSaving || isLoadingRepos}>
                    Add Repository
                </Button>
            </div>
             {isLoadingRepos ? (
                <div className="flex justify-center p-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400"></div></div>
            ) : monitoredRepos.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {monitoredRepos.map(repo => (
                    <GlassCard key={repo.id} className="p-3 !rounded-lg hover:border-sky-600/60">
                    <div className="flex flex-col sm:flex-row justify-between items-start">
                        <div className="flex-grow mb-2 sm:mb-0">
                            <div className="flex items-center text-sky-300 font-semibold">
                                <GitBranchIcon className="w-4 h-4 mr-2 text-sky-400"/> {repo.repo_url}
                            </div>
                            <div className="text-xs text-slate-400 ml-6">
                                Branch: <span className="text-slate-300">{repo.default_branch}</span> | 
                                Platform: <span className="text-slate-300">{repo.default_platform}</span> | 
                                Channel: <span className="text-slate-300">{repo.default_channel}</span> |
                                Auto-Trigger: <span className={repo.auto_trigger_enabled ? "text-green-400" : "text-red-400"}>{repo.auto_trigger_enabled ? 'Enabled' : 'Disabled'}</span>
                            </div>
                        </div>
                        <div className="flex space-x-2 self-start sm:self-center">
                        <Button variant="ghost" size="sm" onClick={() => openRepoModal(repo)} aria-label="Edit repository" className="p-2" disabled={isSaving}>
                            <Edit3Icon className="w-4 h-4"/>
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDeleteRepository(repo.id)} aria-label="Delete repository" className="p-2" disabled={isSaving}>
                            <Trash2Icon className="w-4 h-4"/>
                        </Button>
                        </div>
                    </div>
                    </GlassCard>
                ))}
                </div>
            ) : (
                <p className="text-slate-400 text-center py-4">No repositories are currently being monitored for automated builds.</p>
            )}
          </section>
          )}


          <section>
            <h2 className="text-xl font-semibold text-sky-400 mb-4 border-b border-slate-700 pb-2">UI & Display</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Select
                label="QR Code Mode"
                id="qrCodeMode"
                options={[{ value: 'DownloadLink', label: 'Direct Download Link' }, { value: 'BuildDetail', label: 'Link to Build Detail Page' }]}
                value={localSettings.qrCodeMode}
                onChange={e => handleChange('qrCodeMode', e.target.value as 'DownloadLink' | 'BuildDetail')}
              />
              <Select
                label="UI Theme"
                id="uiTheme"
                options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System Preference' }]}
                value={localSettings.uiTheme}
                onChange={e => handleChange('uiTheme', e.target.value as 'light' | 'dark' | 'system')}
              />
            </div>
          </section>
          
          <div className="flex justify-end pt-4 border-t border-slate-700">
            <Button type="submit" variant="primary" size="lg" disabled={isSaving || isLoadingGlobalSettings} leftIcon={isSaving? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : <SaveIcon className="w-5 h-5"/>}>
              {isSaving ? 'Saving Settings...' : 'Save All App Settings'}
            </Button>
          </div>
        </form>
      </GlassCard>

      {/* Monitored Repository Add/Edit Modal */}
        <Modal 
            isOpen={repoModalState.isOpen} 
            onClose={closeRepoModal} 
            title={repoModalState.isEditing ? "Edit Monitored Repository" : "Add Monitored Repository"}
            size="lg"
        >
            {statusMessage && repoModalState.isOpen && ( // Show modal-specific status
                <div className={`p-2 mb-3 rounded-md text-sm ${statusMessage.type === 'success' ? 'bg-green-800/70 text-green-200' : 'bg-red-800/70 text-red-200'}`}>
                    {statusMessage.message}
                </div>
             )}
            <form onSubmit={(e) => { e.preventDefault(); handleSaveRepository(); }} className="space-y-4">
                <Input
                    label="Repository URL (HTTPS)"
                    id="repo_url"
                    type="url"
                    value={repoForm.repo_url || ''}
                    onChange={e => handleRepoFormChange('repo_url', e.target.value)}
                    placeholder="https://github.com/your-org/your-repo.git"
                    required
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Default Branch"
                        id="default_branch"
                        value={repoForm.default_branch || ''}
                        onChange={e => handleRepoFormChange('default_branch', e.target.value)}
                        placeholder="e.g., main, develop"
                        required
                    />
                    <Select
                        label="Default Platform"
                        id="default_platform"
                        options={Object.values(Platform).map(p => ({ value: p, label: p }))}
                        value={repoForm.default_platform || ''}
                        onChange={e => handleRepoFormChange('default_platform', e.target.value as Platform)}
                        required
                    />
                    <Select
                        label="Default Channel"
                        id="default_channel"
                        options={Object.values(Channel).map(c => ({ value: c, label: c }))}
                        value={repoForm.default_channel || ''}
                        onChange={e => handleRepoFormChange('default_channel', e.target.value as Channel)}
                        required
                    />
                    <div className="md:col-span-2">
                       <Switch
                            label="Enable Auto-Triggering New Builds"
                            id="auto_trigger_enabled"
                            checked={repoForm.auto_trigger_enabled !== undefined ? repoForm.auto_trigger_enabled : true}
                            onChange={checked => handleRepoFormChange('auto_trigger_enabled', checked)}
                            srLabel="If enabled, new commits to the default branch will attempt to trigger a CI build."
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="secondary" onClick={closeRepoModal} disabled={isSaving}>Cancel</Button>
                    <Button type="submit" variant="primary" disabled={isSaving} leftIcon={isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : null}>
                        {isSaving ? 'Saving...' : (repoModalState.isEditing ? 'Update Repository' : 'Add Repository')}
                    </Button>
                </div>
            </form>
        </Modal>

    </div>
  );
};


const SettingsPage: React.FC = () => {
  return (
    <ProtectedRoute allowedRoles={[UserRole.Admin]}>
      <AppLayout>
        <SettingsPageContent />
      </AppLayout>
    </ProtectedRoute>
  );
};

export default SettingsPage;