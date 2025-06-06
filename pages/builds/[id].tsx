
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router'; // Changed from react-router-dom
import { AppVersion, Platform, BuildStatus, Feedback as FeedbackType, UserRole, BuildSource } from '../../types';
import * as apiClient from '../../services/apiClient'; 
import { SubmitFeedbackPayload, ForceRebuildPayload, DeleteBuildPayload } from '../../apiTypes'; 
import { AppleIcon, SmartphoneIcon, MessageSquareIcon, CopyIcon, ExternalLinkIcon, TerminalIcon, DownloadIcon as DownloadActionIcon, RefreshCwIcon, Trash2Icon } from '../../components/icons';
import GlassCard from '../../components/ui/GlassCard';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ChangelogAnalyzer from '../../components/ChangelogAnalyzer';
import QRCodeDisplay from '../../components/QRCodeDisplay';
import SimpleMarkdown from '../../components/common/SimpleMarkdown';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext'; // Import useSettings
import AppLayout from '../../components/layout/AppLayout';
import ProtectedRoute from '../../components/layout/ProtectedRoute';
import Link from 'next/link';


const BuildDetailPageContent: React.FC = () => {
  const router = useRouter();
  const { id } = router.query; // Get id from query parameters
  const { currentUser, hasRole } = useAuth();
  const { getSetting } = useSettings(); // Use settings context

  const feedbackEnabled = getSetting('feedbackEnabled', true);
  const qrCodeMode = getSetting('qrCodeMode', 'DownloadLink');

  const [build, setBuild] = useState<AppVersion | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackUser, setFeedbackUser] = useState(currentUser?.username || 'Tester User');

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // For UDID check
  const [udidToCheck, setUdidToCheck] = useState('');
  const [udidCheckResult, setUdidCheckResult] = useState('');

  // For Force Rebuild
  const [isForcingRebuild, setIsForcingRebuild] = useState(false);
  const [rebuildMessage, setRebuildMessage] = useState<{type: 'success' | 'error', text: string, newBuildId?: string} | null>(null);


  const fetchBuildDetails = useCallback(async () => {
    if (!id || typeof id !== 'string') {
        return;
    }
    setLoading(true);
    try {
        const buildResponse = await apiClient.getBuildById({ id }); 
        if (buildResponse.build) {
          setBuild(buildResponse.build);
          if (feedbackEnabled) { // Only fetch feedbacks if enabled
            const feedbackResponse = await apiClient.getFeedbacksForBuild({ buildId: id }); 
            setFeedbacks(feedbackResponse.feedbacks);
          } else {
            setFeedbacks([]); // Ensure feedbacks are empty if disabled
          }
        } else {
          router.replace('/builds');
        }
    } catch (error) {
        console.error("Failed to fetch build details:", error);
        router.replace('/builds');
    } finally {
        setLoading(false);
    }
  }, [id, router, feedbackEnabled]);

  useEffect(() => {
    if (router.isReady) { 
        fetchBuildDetails();
    }
  }, [router.isReady, fetchBuildDetails]);

  useEffect(() => { 
    setFeedbackUser(currentUser?.username || 'Tester User');
  }, [currentUser]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!build || !feedbackComment.trim() || !feedbackEnabled) return;
    
    const payload: SubmitFeedbackPayload = {
        buildId: build.id,
        user: feedbackUser,
        comment: feedbackComment.trim()
    };

    try {
        await apiClient.submitFeedback(payload); 
        setFeedbackComment('');
        setShowFeedbackModal(false);
        if (router.isReady) fetchBuildDetails(); 
    } catch (error) {
        console.error("Failed to submit feedback:", error);
        alert("Error submitting feedback.");
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Copied to clipboard!");
    }).catch(err => {
      console.error("Failed to copy: ", err);
      alert("Failed to copy to clipboard.");
    });
  };

  const openDeleteConfirmModal = () => {
    if (!build) return;
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDeleteBuild = async () => {
    if (!build) return;
    setIsDeleting(true);
    try {
      const payload: DeleteBuildPayload = { buildId: build.id };
      await apiClient.deleteBuild(payload);
      alert(`Build ${build.appName} v${build.versionName} deleted successfully.`);
      setShowDeleteConfirmModal(false);
      router.push('/builds');
    } catch (error: any) {
      console.error("Failed to delete build:", error);
      alert(`Failed to delete build: ${error.message || 'Unknown error'}`);
      setIsDeleting(false);
      setShowDeleteConfirmModal(false);
    }
  };

  const handleDownload = async () => {
    if (!build) return;
    try {
        await apiClient.incrementDownloadCount({ buildId: build.id }); 
        if (build.downloadUrl && build.downloadUrl !== "#") {
            window.location.href = build.downloadUrl; 
        } else {
            alert(`Downloading ${build.appName} ${build.versionName}... (file may not be available yet)`);
        }
        if(router.isReady) fetchBuildDetails(); 
    } catch (error) {
        console.error("Failed to process download:", error);
        alert("Error processing download.");
    }
  };

  const handleForceRebuild = async () => {
    if (!build || !currentUser) return;
    setIsForcingRebuild(true);
    setRebuildMessage(null);
    try {
        const payload: ForceRebuildPayload = {
            originalBuildId: build.id,
            triggeredByUsername: currentUser.username
        };
        const response = await apiClient.forceRebuild(payload);
        setRebuildMessage({type: 'success', text: response.message, newBuildId: response.newBuild?.id});
        if (router.isReady) fetchBuildDetails(); 
    } catch (error: any) {
        console.error("Failed to force rebuild:", error);
        setRebuildMessage({type: 'error', text: `Failed to force rebuild: ${error.message || 'Unknown error'}`});
    } finally {
        setIsForcingRebuild(false);
    }
  };
  
  const handleCheckUDID = () => {
    if (!build || !build.allowedUDIDs || !udidToCheck.trim()) {
      setUdidCheckResult('Please enter a UDID to check.');
      return;
    }
    const isAllowed = build.allowedUDIDs.map(udid => udid.toLowerCase()).includes(udidToCheck.trim().toLowerCase());
    setUdidCheckResult(isAllowed ? `UDID ${udidToCheck.trim()} is authorized for this build.` : `UDID ${udidToCheck.trim()} is NOT authorized for this build.`);
  };


  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div></div>;
  if (!build) return <GlassCard><p className="text-center text-slate-300 py-8">Build not found or failed to load.</p></GlassCard>;

  const formattedDate = new Date(build.uploadDate).toLocaleString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  const displayStatus = build.source === BuildSource.CI_PIPELINE ? build.pipelineStatus : build.buildStatus;
  const statusText = displayStatus || "Unknown";
  const gitProviderBaseUrl = "https://github.com/example-org/example-repo"; // Placeholder

  const qrUrl = qrCodeMode === 'BuildDetail' ? window.location.href : build.downloadUrl;


  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center mb-1">
            {build.platform === Platform.iOS ? <AppleIcon className="w-7 h-7 text-slate-300" /> : <SmartphoneIcon className="w-7 h-7 text-slate-300" />}
            <h1 className="ml-3 text-3xl font-bold text-sky-300">{build.appName} - v{build.versionName} <span className="text-xl text-slate-400">({build.versionCode})</span></h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
            <span>Channel: {build.channel}</span>
            <span>&bull;</span>
            <span>Uploaded: {formattedDate}</span>
            <span>&bull;</span>
            <span>Size: {build.size}</span>
            <span>&bull;</span>
            <span>Downloads: {build.downloadCount}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button 
            variant="primary" 
            size="md" 
            leftIcon={<DownloadActionIcon className="w-5 h-5"/>} 
            onClick={handleDownload}
            disabled={(displayStatus !== BuildStatus.Success && build.pipelineStatus !== BuildStatus.Success)}
            className="w-full sm:w-auto"
            aria-label={`Download ${build.appName} version ${build.versionName}`}
          >
            Download
          </Button>
          {feedbackEnabled && (
            <Button 
              variant="ghost" 
              size="md" 
              leftIcon={<MessageSquareIcon className="w-5 h-5"/>} 
              onClick={() => setShowFeedbackModal(true)}
              className="w-full sm:w-auto"
              aria-label="Submit Feedback"
            >
              Feedback
            </Button>
          )}
        </div>
      </div>

      {/* QR Code & Build Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <QRCodeDisplay url={qrUrl} altText={`QR Code for ${build.appName} ${build.versionName} (${qrCodeMode === 'BuildDetail' ? 'Details Page' : 'Direct Download'})`}/>
        </div>
        <GlassCard className="lg:col-span-2">
            <h3 className="text-xl font-semibold text-sky-300 mb-3">Build Information</h3>
            <div className="space-y-3 text-sm">
                 <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                        displayStatus === BuildStatus.Success ? 'bg-green-700 text-green-200' :
                        displayStatus === BuildStatus.Failed ? 'bg-red-700 text-red-200' :
                        displayStatus === BuildStatus.InProgress ? 'bg-yellow-700 text-yellow-200 animate-pulse' : 'bg-slate-600 text-slate-200'
                    }`}>{statusText}</span>
                </div>
                <div className="flex justify-between"><span className="text-slate-400">File Name:</span> <span className="truncate" title={build.fileName}>{build.fileName || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">File Type:</span> <span>{build.fileType || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Source:</span> <span>{build.source || 'N/A'}</span></div>
                {build.triggeredBy && <div className="flex justify-between"><span className="text-slate-400">Triggered By:</span> <span>{build.triggeredBy}</span></div>}
                
                {build.commitHash && (
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">Commit:</span>
                        <div className="flex items-center">
                        <span className="mr-2 text-sky-400 font-mono text-xs" title={build.commitHash}>#{build.commitHash.substring(0,7)}</span>
                        <Button 
                            as="a" 
                            href={`${gitProviderBaseUrl}/commit/${build.commitHash}`} // Placeholder base URL
                            target="_blank" 
                            rel="noopener noreferrer" 
                            variant="link" 
                            size="sm" 
                            className="p-0 h-auto text-xs"
                            title="View commit on Git provider"
                            rightIcon={<ExternalLinkIcon className="w-3 h-3"/>}
                        >
                            View Commit
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => copyToClipboard(build.commitHash!)} 
                            className="ml-2 p-1 h-auto"
                            aria-label="Copy commit hash"
                        >
                            <CopyIcon className="w-3 h-3"/>
                        </Button>
                        </div>
                    </div>
                )}
                 {build.source === BuildSource.CI_PIPELINE && (
                    <>
                        {build.ciBuildId && <div className="flex justify-between"><span className="text-slate-400">CI Build ID:</span> <span>{build.ciBuildId}</span></div>}
                        {build.ciLogsUrl && build.ciLogsUrl !== '#' ? (
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">CI Logs:</span>
                                <Button 
                                    as="a" 
                                    href={build.ciLogsUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    variant="link" 
                                    size="sm"
                                    className="p-0 h-auto text-xs"
                                    title="View logs on CI provider"
                                    leftIcon={<TerminalIcon className="w-3 h-3"/>}
                                    rightIcon={<ExternalLinkIcon className="w-3 h-3"/>}
                                >
                                View Logs
                                </Button>
                            </div>
                        ) : (
                             <div className="flex justify-between items-center">
                                <span className="text-slate-400">CI Logs:</span>
                                <span className="text-slate-500 text-xs">Not available</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </GlassCard>
      </div>

      {/* Changelog Section with AI Analysis */}
      <GlassCard>
        <h3 className="text-xl font-semibold text-sky-300 mb-2">Changelog</h3>
        <SimpleMarkdown text={build.changelog} />
        <ChangelogAnalyzer currentChangelog={build.changelog} previousChangelog={build.previousChangelog}/>
      </GlassCard>

      {/* UDID Management Section (iOS only) */}
      {build.platform === Platform.iOS && (
        <GlassCard>
          <h3 className="text-xl font-semibold text-sky-300 mb-3">UDID Management (iOS)</h3>
          {build.allowedUDIDs && build.allowedUDIDs.length > 0 ? (
            <>
              <p className="text-sm text-slate-400 mb-2">This build is restricted to the following UDIDs:</p>
              <ul className="list-disc list-inside bg-slate-800/50 p-3 rounded-md max-h-40 overflow-y-auto text-sm mb-4">
                {build.allowedUDIDs.map(udid => <li key={udid} className="font-mono text-slate-300">{udid}</li>)}
              </ul>
            </>
          ) : (
            <p className="text-sm text-slate-400 mb-3">This build is not restricted by UDID (open for installation on any compatible device).</p>
          )}
          <div className="flex items-end gap-2">
            <Input 
              label="Check UDID Authorization"
              id="udidCheck"
              placeholder="Enter UDID to check"
              value={udidToCheck}
              onChange={(e) => setUdidToCheck(e.target.value)}
              wrapperClassName="flex-grow"
            />
            <Button onClick={handleCheckUDID} variant="secondary" size="md">Check</Button>
          </div>
          {udidCheckResult && <p className={`text-xs mt-2 p-2 rounded-md ${udidCheckResult.includes("NOT") ? "bg-red-900/50 text-red-300" : "bg-green-900/50 text-green-300"}`}>{udidCheckResult}</p>}
        </GlassCard>
      )}
      
      {/* Admin Actions Section */}
       {hasRole([UserRole.Admin]) && (
        <GlassCard>
            <h3 className="text-xl font-semibold text-sky-300 mb-4">Admin Actions</h3>
            <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                    variant="secondary" 
                    onClick={handleForceRebuild} 
                    disabled={isForcingRebuild}
                    leftIcon={isForcingRebuild ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : <RefreshCwIcon className="w-4 h-4"/>}
                >
                    {isForcingRebuild ? 'Rebuilding...' : 'Force Rebuild Iteration'}
                </Button>
                <Button 
                    variant="danger" 
                    onClick={openDeleteConfirmModal}
                    leftIcon={<Trash2Icon className="w-4 h-4"/>}
                >
                    Delete Build
                </Button>
            </div>
            {rebuildMessage && (
                <div className={`mt-3 text-sm p-3 rounded-md ${rebuildMessage.type === 'success' ? 'bg-green-800/60 text-green-200' : 'bg-red-800/60 text-red-200'}`}>
                    {rebuildMessage.text}
                    {rebuildMessage.newBuildId && (
                        <Link href={`/builds/${rebuildMessage.newBuildId}`} legacyBehavior>
                            <a className="ml-2 underline hover:text-sky-300">View new build</a>
                        </Link>
                    )}
                </div>
            )}
        </GlassCard>
       )}


      {/* Feedback Section */}
      {feedbackEnabled && (
        <GlassCard>
          <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-semibold text-sky-300">User Feedback ({feedbacks.length})</h3>
          </div>
          {feedbacks.length > 0 ? (
            <ul className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {feedbacks.map(fb => (
                <li key={fb.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="flex justify-between items-center mb-1">
                    <strong className="text-sky-400">{fb.user}</strong>
                    <small className="text-slate-500">{new Date(fb.timestamp).toLocaleString()}</small>
                  </div>
                  <p className="text-slate-300 whitespace-pre-wrap text-sm">{fb.comment}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-center py-4">No feedback yet for this build.</p>
          )}
        </GlassCard>
      )}

      {/* Feedback Modal */}
      {feedbackEnabled && (
        <Modal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} title="Submit Feedback">
          <form onSubmit={handleFeedbackSubmit} className="space-y-4">
            <Input 
              label="Your Name / Identifier"
              id="feedbackUser"
              value={feedbackUser}
              onChange={e => setFeedbackUser(e.target.value)}
              required
            />
            <div>
              <label htmlFor="feedbackComment" className="block text-sm font-medium text-slate-300 mb-1">Your Feedback</label>
              <textarea
                id="feedbackComment"
                rows={5}
                className="block w-full bg-slate-700/50 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                value={feedbackComment}
                onChange={e => setFeedbackComment(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowFeedbackModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Submit Feedback</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteConfirmModal} onClose={() => setShowDeleteConfirmModal(false)} title="Confirm Deletion">
        <p className="text-slate-300 mb-4">
            Are you sure you want to delete the build: <strong className="text-sky-400">{build?.appName} v{build?.versionName}</strong>? 
            This action is permanent and will also delete associated feedback and the build file from storage.
        </p>
        <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteConfirmModal(false)} disabled={isDeleting}>
                Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDeleteBuild} disabled={isDeleting} leftIcon={isDeleting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : null}>
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
        </div>
      </Modal>

    </div>
  );
};


const BuildDetailPage: React.FC = () => {
  return (
    <ProtectedRoute allowedRoles={[UserRole.Admin, UserRole.Developer, UserRole.Tester]}>
        <AppLayout>
            <BuildDetailPageContent />
        </AppLayout>
    </ProtectedRoute>
  );
};

export default BuildDetailPage;