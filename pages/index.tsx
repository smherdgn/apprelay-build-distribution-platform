
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DashboardStats, UserRole, Platform, DEFAULT_SETTINGS } from '../types';
import * as apiClient from '../services/apiClient';
import { SmartphoneIcon, AppleIcon } from '../components/icons';
import GlassCard from '../components/ui/GlassCard';
// Button, Input, Select for CI trigger form are no longer needed here
import { useSettings } from '../contexts/SettingsContext'; // Import useSettings
import AppLayout from '../components/layout/AppLayout';
import ProtectedRoute from '../components/layout/ProtectedRoute';


const StatCard: React.FC<{ title: string; value: string | number; description?: string, children?: React.ReactNode }> = ({ title, value, description, children }) => (
  <GlassCard className="flex flex-col">
    <h3 className="text-lg font-semibold text-sky-400 mb-1">{title}</h3>
    {children || <p className="text-4xl font-bold text-slate-100">{value}</p>}
    {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
  </GlassCard>
);

const DistributionChartPlaceholder: React.FC<{ title: string; data: Record<string, number>; iconMap?: Record<string, React.ReactNode> }> = ({ title, data, iconMap }) => (
  <GlassCard className="flex-1 min-w-[280px]">
    <h3 className="text-lg font-semibold text-sky-400 mb-3">{title}</h3>
    <div className="space-y-2">
      {Object.entries(data).map(([key, count]: [string, number]) => (
        <div key={key} className="flex items-center justify-between text-sm">
          <div className="flex items-center">
            {iconMap && iconMap[key] && <span className="mr-2">{iconMap[key]}</span>}
            <span className="text-slate-300">{key}:</span>
          </div>
          <span className="font-semibold text-slate-100 bg-slate-700 px-2 py-0.5 rounded">{count}</span>
        </div>
      ))}
      {Object.keys(data).length === 0 && <p className="text-slate-400">No data available.</p>}
    </div>
    <div className="mt-4 text-center text-xs text-slate-500 italic">(Chart placeholder for {title})</div>
  </GlassCard>
);

const SuccessRatioPlaceholder: React.FC<{ ratio: number }> = ({ ratio }) => (
  <GlassCard>
    <h3 className="text-lg font-semibold text-sky-400 mb-2">Build Success Ratio</h3>
    <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden">
      <div
        className="bg-green-500 h-full flex items-center justify-center text-sm font-medium text-white transition-all duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
        role="progressbar"
        aria-valuenow={Math.round(ratio*100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {(ratio * 100).toFixed(0)}%
      </div>
    </div>
    {ratio * 100 < 100 && ratio * 100 > 0 && (
         <div className="text-xs text-slate-400 text-right mt-1">
            ({((1-ratio) * 100).toFixed(0)}% issues/in-progress)
        </div>
    )}
    <div className="mt-3 text-center text-xs text-slate-500 italic">(Visual placeholder for success ratio)</div>
  </GlassCard>
);


const DashboardPageContent: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const { getSetting } = useSettings();
  const ciIntegrationEnabled = getSetting('ciIntegrationEnabled', DEFAULT_SETTINGS.ciIntegrationEnabled);


  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const response = await apiClient.getDashboardStats();
      setStats(response.stats);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoadingStats(false);
    }
  },[]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loadingStats) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div></div>;
  if (!stats) return <GlassCard><p>No dashboard data available. Try refreshing or check console for errors.</p></GlassCard>;

  const platformIconMap: Record<string, React.ReactNode> = {
    [Platform.Android]: <SmartphoneIcon className="w-4 h-4 text-green-400" />,
    [Platform.iOS]: <AppleIcon className="w-4 h-4 text-slate-300" />,
  };

  const totalDownloads = stats.downloadsByVersion.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-sky-300">Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title="Total Builds" value={stats.totalBuilds} description="All builds across platforms and channels."/>
        <StatCard title="Total Downloads" value={totalDownloads} description="Across all successful versions."/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <SuccessRatioPlaceholder ratio={stats.buildSuccessRatio} />
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <DistributionChartPlaceholder title="Builds by Channel" data={stats.channelDistribution} />
            <DistributionChartPlaceholder title="Builds by Platform" data={stats.platformDistribution} iconMap={platformIconMap} />
        </div>
      </div>

      {/* Manual CI Build Trigger section was removed, but if it were here, its visibility would be: */}
      {/* {ciIntegrationEnabled && hasRole([UserRole.Admin, UserRole.Developer]) && ( ... CI Trigger Form ... )} */}
      {!ciIntegrationEnabled && (
        <GlassCard>
            <p className="text-sm text-slate-400">Manual CI Build Triggering is currently disabled by the administrator.</p>
        </GlassCard>
      )}


      <GlassCard>
        <h3 className="text-xl font-semibold text-sky-400 mb-3">Top Downloaded Versions</h3>
          {stats.downloadsByVersion.length > 0 ? (
            <ul className="space-y-2">
              {stats.downloadsByVersion.map(item => (
                <li key={item.versionId} className="flex justify-between items-center p-2 bg-slate-700/50 rounded-md hover:bg-slate-600/50 transition-colors">
                  <Link href={`/builds/${item.versionId}`} legacyBehavior>
                    <a className="truncate hover:text-sky-300 flex items-center">
                        {item.platform === Platform.iOS ? <AppleIcon className="w-4 h-4 mr-2 text-slate-400"/> : <SmartphoneIcon className="w-4 h-4 mr-2 text-green-400"/>}
                        {item.appName} v{item.versionName}
                    </a>
                  </Link>
                  <span className="font-semibold text-sky-300 bg-sky-800/70 px-2.5 py-1 rounded-full text-xs">{item.count} downloads</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-slate-400">No download data yet for any version.</p>}
        <div className="mt-4 text-center text-xs text-slate-500 italic">(List of top 5 downloaded builds)</div>
      </GlassCard>

    </div>
  );
};

const DashboardPage: React.FC = () => {
    return (
        <ProtectedRoute allowedRoles={[UserRole.Admin, UserRole.Developer, UserRole.Tester]}>
            <AppLayout>
                <DashboardPageContent/>
            </AppLayout>
        </ProtectedRoute>
    )
}

export default DashboardPage;