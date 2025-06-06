import React from 'react';
import Link from 'next/link'; // Changed from react-router-dom
import { AppVersion, Platform, BuildStatus, UserRole, BuildSource } from '../types';
import { AppleIcon, SmartphoneIcon, CheckCircleIcon, AlertTriangleIcon, ZapIcon, DownloadIcon, Trash2Icon, GitBranchIcon } from './icons'; // Changed CloseIcon to Trash2Icon for delete
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';
import { useAuth } from '../contexts/AuthContext'; 

interface BuildListItemProps {
  build: AppVersion;
  onDelete?: (buildId: string) => void; 
  onDownload: (buildId: string) => Promise<void>; 
}

const PlatformIcon: React.FC<{ platform: Platform }> = ({ platform }) => {
  if (platform === Platform.iOS) return <AppleIcon className="w-5 h-5 text-slate-400" />;
  return <SmartphoneIcon className="w-5 h-5 text-slate-400" />;
};

const StatusIndicator: React.FC<{ status?: BuildStatus }> = ({ status }) => {
  if (!status) return null;
  switch (status) {
    case BuildStatus.Success:
      return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
    case BuildStatus.Failed:
      return <AlertTriangleIcon className="w-5 h-5 text-red-400" />;
    case BuildStatus.InProgress:
      return <ZapIcon className="w-5 h-5 text-yellow-400 animate-pulse" />;
    default:
      return null;
  }
};

const BuildListItem: React.FC<BuildListItemProps> = ({ build, onDelete, onDownload }) => {
  const { hasRole } = useAuth(); 

  const formattedDate = new Date(build.uploadDate).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const handleDeleteClick = () => {
    if (window.confirm(`Are you sure you want to delete build ${build.appName} v${build.versionName}? This action is permanent.`)) {
      if (onDelete) onDelete(build.id);
    }
  };

  const handleDownloadClick = async () => {
    await onDownload(build.id); 
    
    if (build.downloadUrl && build.downloadUrl !== "#") {
        window.location.href = build.downloadUrl; 
    } else {
        alert(`Processing download for ${build.appName} ${build.versionName}. If download doesn't start, the file may not be available yet.`);
    }
  };

  const displayStatus = build.source === BuildSource.CI_PIPELINE ? build.pipelineStatus : build.buildStatus;
  const statusText = displayStatus || "Unknown";


  return (
    <GlassCard className="hover:border-sky-500/70 transition-all duration-200 ease-in-out group">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="flex-grow mb-4 sm:mb-0">
          <div className="flex items-center mb-1">
            <PlatformIcon platform={build.platform} />
            <h3 className="ml-2 text-xl font-semibold text-sky-400 group-hover:text-sky-300 transition-colors">
              {build.appName} - v{build.versionName} ({build.versionCode})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400 mb-2">
            <span>{build.channel}</span>
            <span>&bull;</span>
            <span>{formattedDate}</span>
            <span>&bull;</span>
            <span>{build.size}</span>
             {build.commitHash && (
              <>
                <span>&bull;</span>
                <span title={`Commit: ${build.commitHash}`}>#{build.commitHash.substring(0, 7)}</span>
              </>
            )}
          </div>
           <div className="flex items-center space-x-2">
            <StatusIndicator status={displayStatus} />
            <span className={`text-sm ${
              displayStatus === BuildStatus.Success ? 'text-green-400' :
              displayStatus === BuildStatus.Failed ? 'text-red-400' : 
              displayStatus === BuildStatus.InProgress ? 'text-yellow-400' : 'text-slate-400'
            }`}>{statusText}</span>
            {build.source === BuildSource.CI_PIPELINE && (
                <div className="flex items-center text-xs text-sky-400 bg-sky-900/50 px-2 py-0.5 rounded-full">
                    <GitBranchIcon className="w-3 h-3 mr-1"/> 
                    From CI
                </div>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto mt-3 sm:mt-0">
          <Link href={`/builds/${build.id}`} passHref legacyBehavior>
            <Button as="a" variant="secondary" size="sm" className="w-full sm:w-auto">
              Details
            </Button>
          </Link>
          <Button 
            variant="primary" 
            size="sm" 
            leftIcon={<DownloadIcon className="w-4 h-4"/>}
            onClick={handleDownloadClick}
            disabled={(displayStatus !== BuildStatus.Success && build.pipelineStatus !== BuildStatus.Success)}
            className="w-full sm:w-auto"
          >
            Download
          </Button>
          {hasRole([UserRole.Admin]) && onDelete && (
            <Button 
              variant="danger" 
              size="sm" 
              leftIcon={<Trash2Icon className="w-4 h-4"/>} 
              onClick={handleDeleteClick}
              className="w-full sm:w-auto"
              title="Delete Build (Admin)"
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
};

export default BuildListItem;