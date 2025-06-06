import React, { useState, useEffect, useCallback } from 'react';
import { AppVersion, Platform, Channel, UserRole } from '../../types'; // Added UserRole
import * as apiClient from '../../services/apiClient'; 
import { DeleteBuildPayload } from '../../apiTypes';
import GlassCard from '../../components/ui/GlassCard';
import Select from '../../components/ui/Select';
import BuildListItem from '../../components/BuildListItem';
import AppLayout from '../../components/layout/AppLayout'; // Import AppLayout
import ProtectedRoute from '../../components/layout/ProtectedRoute'; // Import ProtectedRoute

const BuildsListPageContent: React.FC = () => {
  const [builds, setBuilds] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<Platform | ''>('');
  const [channelFilter, setChannelFilter] = useState<Channel | ''>('');
  const [refreshKey, setRefreshKey] = useState(0); 

  const fetchBuilds = useCallback(async () => {
      setLoading(true);
      try {
        const params = {
          platform: platformFilter || undefined,
          channel: channelFilter || undefined,
        };
        const response = await apiClient.getBuilds(params); 
        setBuilds(response.builds || []); // Ensure builds is an array
      } catch (error) {
        console.error("Failed to fetch builds:", error);
        setBuilds([]);
      } finally {
        setLoading(false);
      }
    }, [platformFilter, channelFilter]);

  useEffect(() => {
    fetchBuilds();
  }, [fetchBuilds, refreshKey]);

  const handleDeleteBuild = useCallback(async (buildId: string) => {
    // Confirmation is handled within BuildListItem or if it calls a modal itself.
    // This function is the final action after confirmation.
    try {
      const payload: DeleteBuildPayload = { buildId };
      await apiClient.deleteBuild(payload);
      alert(`Build ${buildId} deleted successfully.`);
      setRefreshKey(prev => prev + 1); // Trigger a refresh
    } catch (error: any) {
      console.error(`Failed to delete build ${buildId}:`, error);
      alert(`Failed to delete build: ${error.message || 'Unknown error'}`);
    }
  }, []);

  const handleDownload = useCallback(async (buildId: string) => {
    try {
      await apiClient.incrementDownloadCount({ buildId }); 
      setRefreshKey(prev => prev + 1); 
    } catch (error) {
      console.error("Failed to increment download count:", error);
    }
  }, []);


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-sky-300">Builds</h1>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Select
            options={[{ value: '', label: 'All Platforms' }, ...Object.values(Platform).map(p => ({ value: p, label: p }))]}
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as Platform | '')}
            placeholder="All Platforms"
            aria-label="Filter by platform"
            className="min-w-[180px]"
          />
          <Select
            options={[{ value: '', label: 'All Channels' }, ...Object.values(Channel).map(c => ({ value: c, label: c }))]}
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as Channel | '')}
            placeholder="All Channels"
            aria-label="Filter by channel"
            className="min-w-[180px]"
          />
        </div>
      </div>
      {loading ? (
         <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div></div>
      ) : builds.length > 0 ? (
        <div className="space-y-4">
          {builds.map(build => <BuildListItem key={build.id} build={build} onDelete={handleDeleteBuild} onDownload={handleDownload} />)}
        </div>
      ) : (
        <GlassCard><p className="text-center text-slate-400 py-8">No builds found matching your criteria.</p></GlassCard>
      )}
    </div>
  );
};

const BuildsListPage: React.FC = () => {
  return (
    <ProtectedRoute allowedRoles={[UserRole.Admin, UserRole.Developer, UserRole.Tester]}>
      <AppLayout>
        <BuildsListPageContent />
      </AppLayout>
    </ProtectedRoute>
  );
};

export default BuildsListPage;