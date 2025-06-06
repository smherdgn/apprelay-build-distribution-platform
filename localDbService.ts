
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { AppVersion, Feedback, DashboardStats, BuildStatus, Platform, Channel, AppSettings, BuildSource, MonitoredRepository, DEFAULT_SETTINGS } from './types';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join((process as NodeJS.Process).cwd(), 'local.db');

let db: Database.Database;

try {
  db = new Database(DB_PATH, { /* verbose: console.log */ }); 
  console.log('[LocalDbService] Connected to SQLite database at:', DB_PATH);
} catch (error) {
  console.error('[LocalDbService] Error connecting to SQLite database:', error);
  throw new Error(`Failed to initialize SQLite database: ${(error as Error).message}`);
}


const initializeSchema = () => {
  console.log('[LocalDbService] Initializing SQLite schema...');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS builds (
        id TEXT PRIMARY KEY,
        appName TEXT NOT NULL,
        versionName TEXT NOT NULL,
        versionCode TEXT NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('iOS', 'Android')),
        channel TEXT NOT NULL CHECK (channel IN ('Beta', 'Staging', 'Production')),
        changelog TEXT NOT NULL,
        previousChangelog TEXT,
        uploadDate TEXT NOT NULL,
        buildStatus TEXT NOT NULL CHECK (buildStatus IN ('Success', 'Failed', 'In Progress')),
        commitHash TEXT,
        downloadUrl TEXT,
        qrCodeUrl TEXT,
        size TEXT,
        fileName TEXT,
        fileType TEXT,
        downloadCount INTEGER DEFAULT 0 NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('Manual Upload', 'CI Pipeline')),
        ciBuildId TEXT,
        pipelineStatus TEXT CHECK (pipelineStatus IN ('Success', 'Failed', 'In Progress')),
        ciLogsUrl TEXT,
        triggeredBy TEXT,
        allowedUDIDs TEXT -- Stored as JSON string
      );

      CREATE TABLE IF NOT EXISTS feedbacks (
        id TEXT PRIMARY KEY,
        build_id TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
        user_name TEXT NOT NULL,
        comment TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monitored_repositories (
        id TEXT PRIMARY KEY,
        repo_url TEXT NOT NULL UNIQUE,
        default_branch TEXT NOT NULL,
        default_platform TEXT NOT NULL CHECK (default_platform IN ('iOS', 'Android')),
        default_channel TEXT NOT NULL CHECK (default_channel IN ('Beta', 'Staging', 'Production')),
        auto_trigger_enabled INTEGER NOT NULL DEFAULT 1, -- SQLite uses 0/1 for BOOLEAN
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        useSupabase INTEGER NOT NULL,
        useSupabaseStorage INTEGER NOT NULL,
        apiBaseUrl TEXT NOT NULL,
        localBuildPath TEXT NOT NULL,
        maxBuildsPerGroup INTEGER NOT NULL,
        deletePolicy TEXT NOT NULL,
        enableAutoClean INTEGER NOT NULL,
        geminiEnabled INTEGER NOT NULL,
        feedbackEnabled INTEGER NOT NULL,
        notifyOnNewBuild INTEGER NOT NULL,
        ciIntegrationEnabled INTEGER NOT NULL,
        buildApprovalRequired INTEGER NOT NULL,
        qrCodeMode TEXT NOT NULL,
        defaultChannel TEXT NOT NULL,
        maxUploadSizeMB INTEGER NOT NULL,
        uiTheme TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_builds_platform_channel ON builds (platform, channel);
      CREATE INDEX IF NOT EXISTS idx_builds_upload_date ON builds (uploadDate DESC);
      CREATE INDEX IF NOT EXISTS idx_builds_appname ON builds (appName);
      CREATE INDEX IF NOT EXISTS idx_feedbacks_build_id ON feedbacks (build_id);
      CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_monitored_repo_url ON monitored_repositories (repo_url);
    `);
    console.log('[LocalDbService] SQLite schema initialized successfully.');
  } catch (error) {
    console.error('[LocalDbService] Error initializing SQLite schema:', error);
    throw error; 
  }
};

initializeSchema();

const mapRowToAppVersion = (row: any): AppVersion => {
  return {
    ...row,
    allowedUDIDs: row.allowedUDIDs ? JSON.parse(row.allowedUDIDs) : undefined,
    downloadCount: Number(row.downloadCount),
  } as AppVersion;
};

const mapRowToFeedback = (row: any): Feedback => {
  return {
    id: row.id,
    buildId: row.build_id,
    user: row.user_name,
    comment: row.comment,
    timestamp: row.created_at,
  };
};

const mapRowToMonitoredRepository = (row: any): MonitoredRepository => {
  return {
    ...row,
    auto_trigger_enabled: Boolean(row.auto_trigger_enabled), 
  } as MonitoredRepository;
};

const mapRowToAppSettings = (row: any): AppSettings => {
  if (!row) return DEFAULT_SETTINGS; 
  return {
    id: row.id,
    useSupabase: Boolean(row.useSupabase),
    useSupabaseStorage: Boolean(row.useSupabaseStorage),
    apiBaseUrl: row.apiBaseUrl,
    localBuildPath: row.localBuildPath,
    maxBuildsPerGroup: Number(row.maxBuildsPerGroup),
    deletePolicy: row.deletePolicy as 'CIOnly' | 'All',
    enableAutoClean: Boolean(row.enableAutoClean),
    geminiEnabled: Boolean(row.geminiEnabled),
    feedbackEnabled: Boolean(row.feedbackEnabled),
    notifyOnNewBuild: Boolean(row.notifyOnNewBuild),
    ciIntegrationEnabled: Boolean(row.ciIntegrationEnabled),
    buildApprovalRequired: Boolean(row.buildApprovalRequired),
    qrCodeMode: row.qrCodeMode as 'DownloadLink' | 'BuildDetail',
    defaultChannel: row.defaultChannel as Channel,
    maxUploadSizeMB: Number(row.maxUploadSizeMB),
    uiTheme: row.uiTheme as 'light' | 'dark' | 'system',
    created_at: row.created_at,
  };
};

const appSettingsToDbRow = (settings: AppSettings): any => {
    return {
        ...settings,
        useSupabase: settings.useSupabase ? 1 : 0,
        useSupabaseStorage: settings.useSupabaseStorage ? 1 : 0,
        enableAutoClean: settings.enableAutoClean ? 1 : 0,
        geminiEnabled: settings.geminiEnabled ? 1 : 0,
        feedbackEnabled: settings.feedbackEnabled ? 1 : 0,
        notifyOnNewBuild: settings.notifyOnNewBuild ? 1 : 0,
        ciIntegrationEnabled: settings.ciIntegrationEnabled ? 1 : 0,
        buildApprovalRequired: settings.buildApprovalRequired ? 1 : 0,
    };
};


export const initializeLocalSettings = (): AppSettings => {
  const stmt = db.prepare('SELECT * FROM settings WHERE id = ?');
  let settingsRow = stmt.get(DEFAULT_SETTINGS.id);

  if (!settingsRow) {
    console.warn('[LocalDbService] No local settings found. Initializing with defaults.');
    
    let initialSettingsForDb = { ...DEFAULT_SETTINGS };
    if (process.env.APP_SETTINGS_SOURCE === 'local') {
        console.log('[LocalDbService] APP_SETTINGS_SOURCE is local. Overriding defaults for initial local DB setup: useSupabase=false, useSupabaseStorage=false.');
        initialSettingsForDb.useSupabase = false;
        initialSettingsForDb.useSupabaseStorage = false;
    }

    const defaultDbRow = appSettingsToDbRow(initialSettingsForDb);
    const insertStmt = db.prepare(`
      INSERT INTO settings (
        id, useSupabase, useSupabaseStorage, apiBaseUrl, localBuildPath,
        maxBuildsPerGroup, deletePolicy, enableAutoClean, geminiEnabled,
        feedbackEnabled, notifyOnNewBuild, ciIntegrationEnabled, buildApprovalRequired,
        qrCodeMode, defaultChannel, maxUploadSizeMB, uiTheme, created_at
      ) VALUES (
        @id, @useSupabase, @useSupabaseStorage, @apiBaseUrl, @localBuildPath,
        @maxBuildsPerGroup, @deletePolicy, @enableAutoClean, @geminiEnabled,
        @feedbackEnabled, @notifyOnNewBuild, @ciIntegrationEnabled, @buildApprovalRequired,
        @qrCodeMode, @defaultChannel, @maxUploadSizeMB, @uiTheme, @created_at
      )`);
    insertStmt.run(defaultDbRow);
    settingsRow = stmt.get(DEFAULT_SETTINGS.id);
  }
  return mapRowToAppSettings(settingsRow);
};

export const updateLocalSettings = (settingsToUpdate: Partial<Omit<AppSettings, 'id' | 'created_at'>>): AppSettings => {
  const stmtRead = db.prepare('SELECT * FROM settings WHERE id = ?');
  let currentSettingsRow = stmtRead.get(DEFAULT_SETTINGS.id);

  if (!currentSettingsRow) {
    console.warn("[LocalDbService] updateLocalSettings: No settings row found, attempting to initialize first.");
    initializeLocalSettings(); 
    currentSettingsRow = stmtRead.get(DEFAULT_SETTINGS.id);
    if (!currentSettingsRow) {
        console.error("[LocalDbService] CRITICAL: Failed to find or initialize settings row for update. Returning un-updated defaults.");
        return DEFAULT_SETTINGS; 
    }
  }
  
  const currentMappedSettings = mapRowToAppSettings(currentSettingsRow);
  // Ensure created_at is updated, and other fields from settingsToUpdate are applied
  const newSettingsData = { ...currentMappedSettings, ...settingsToUpdate, created_at: new Date().toISOString() };
  const dbRowDataForUpdate = appSettingsToDbRow(newSettingsData);

  // Determine which fields are actually being changed by settingsToUpdate
  const settableFields = Object.keys(settingsToUpdate)
    .filter(key => key !== 'id' && key !== 'created_at' && (settingsToUpdate as any)[key] !== undefined);

  if (settableFields.length === 0) {
    // If only timestamp needs updating, or no explicit fields changed
    const touchStmt = db.prepare(`UPDATE settings SET created_at = @created_at WHERE id = @id`);
    touchStmt.run({ created_at: newSettingsData.created_at, id: DEFAULT_SETTINGS.id });
  } else {
    let setClauses = settableFields
      .map(key => `${key} = @${key}`)
      .join(', ');
    setClauses += ', created_at = @created_at'; // Always update created_at

    const stmtUpdate = db.prepare(`UPDATE settings SET ${setClauses} WHERE id = @id`);
    
    const paramsForUpdate: any = { id: DEFAULT_SETTINGS.id, created_at: newSettingsData.created_at };
    for (const key of settableFields) {
        paramsForUpdate[key] = (dbRowDataForUpdate as any)[key];
    }
    stmtUpdate.run(paramsForUpdate);
  }
  
  const updatedSettingsRowAfterUpdate = stmtRead.get(DEFAULT_SETTINGS.id);
  if (!updatedSettingsRowAfterUpdate) {
      console.error("[LocalDbService] CRITICAL: Settings row not found after attempting update. Returning defaults.");
      return DEFAULT_SETTINGS;
  }
  return mapRowToAppSettings(updatedSettingsRowAfterUpdate);
};

export const getLocalSettings = (): AppSettings => {
  let settings = initializeLocalSettings(); 

  if (process.env.APP_SETTINGS_SOURCE === 'local') {
    const updatesToForce: Partial<AppSettings> = {};
    if (settings.useSupabase === true) {
      updatesToForce.useSupabase = false;
    }
    if (settings.useSupabaseStorage === true) {
      updatesToForce.useSupabaseStorage = false;
    }

    if (Object.keys(updatesToForce).length > 0) {
      console.warn(
        `[LocalDbService] APP_SETTINGS_SOURCE is 'local', but DB settings had Supabase flags enabled. Forcing local mode settings in DB.`
      );
      settings = updateLocalSettings(updatesToForce);
    }
  }
  return settings;
};


// Build Operations
export const getLocalBuilds = (params?: { platform?: Platform; channel?: Channel }): AppVersion[] => {
  let query = 'SELECT * FROM builds';
  const conditions: string[] = [];
  const queryParams: any[] = [];

  if (params?.platform) {
    conditions.push('platform = ?');
    queryParams.push(params.platform);
  }
  if (params?.channel) {
    conditions.push('channel = ?');
    queryParams.push(params.channel);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY uploadDate DESC';
  
  const stmt = db.prepare(query);
  const rows = stmt.all(...queryParams);
  return rows.map(mapRowToAppVersion);
};

export const getLocalBuildById = (id: string): AppVersion | null => {
  const stmt = db.prepare('SELECT * FROM builds WHERE id = ?');
  const row = stmt.get(id);
  return row ? mapRowToAppVersion(row) : null;
};

export const addLocalBuild = (buildData: Omit<AppVersion, 'id' | 'qrCodeUrl'> & { qrCodeUrl?: string } ): AppVersion => {
  const id = uuidv4();
  const currentSettings = getLocalSettings(); // Get current settings to form QR code URL based on apiBaseUrl
  const newBuild: AppVersion = {
    ...buildData,
    id,
    // Use apiBaseUrl from local settings for QR code if needed
    qrCodeUrl: buildData.qrCodeUrl || `${currentSettings.apiBaseUrl}/builds/${id}/qr`, 
    allowedUDIDs: buildData.allowedUDIDs || undefined, 
  };

  const stmt = db.prepare(`
    INSERT INTO builds (
      id, appName, versionName, versionCode, platform, channel, changelog, previousChangelog,
      uploadDate, buildStatus, commitHash, downloadUrl, qrCodeUrl, size, fileName, fileType,
      downloadCount, source, ciBuildId, pipelineStatus, ciLogsUrl, triggeredBy, allowedUDIDs
    ) VALUES (
      @id, @appName, @versionName, @versionCode, @platform, @channel, @changelog, @previousChangelog,
      @uploadDate, @buildStatus, @commitHash, @downloadUrl, @qrCodeUrl, @size, @fileName, @fileType,
      @downloadCount, @source, @ciBuildId, @pipelineStatus, @ciLogsUrl, @triggeredBy, @allowedUDIDs
    )`);
  
  stmt.run({
    ...newBuild,
    allowedUDIDs: newBuild.allowedUDIDs ? JSON.stringify(newBuild.allowedUDIDs) : null,
  });
  return newBuild;
};

export const deleteLocalBuild = (id: string, localBuildPathSetting: string, useSupabaseStorageCurrently: boolean): boolean => {
  const build = getLocalBuildById(id);
  if (build && build.fileName && !useSupabaseStorageCurrently) { 
    const filePath = path.join((process as NodeJS.Process).cwd(), localBuildPathSetting, build.fileName);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[LocalDbService] Deleted local file: ${filePath}`);
      } else {
        console.warn(`[LocalDbService] Local file not found for deletion: ${filePath}`);
      }
    } catch (err) {
      console.error(`[LocalDbService] Error deleting local file ${filePath}:`, err);
    }
  }

  const stmt = db.prepare('DELETE FROM builds WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

export const incrementLocalDownloadCount = (id: string): AppVersion | null => {
  db.prepare('UPDATE builds SET downloadCount = downloadCount + 1 WHERE id = ?').run(id);
  return getLocalBuildById(id);
};

// Feedback Operations
export const getLocalFeedbacksForBuild = (buildId: string): Feedback[] => {
  const stmt = db.prepare('SELECT * FROM feedbacks WHERE build_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(buildId);
  return rows.map(mapRowToFeedback);
};

export const addLocalFeedback = (feedbackData: Omit<Feedback, 'id' | 'timestamp'>): Feedback => {
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  const newFeedback = { ...feedbackData, id, timestamp };

  const stmt = db.prepare('INSERT INTO feedbacks (id, build_id, user_name, comment, created_at) VALUES (?, ?, ?, ?, ?)');
  stmt.run(id, feedbackData.buildId, feedbackData.user, feedbackData.comment, timestamp);
  return newFeedback;
};

// Dashboard Stats
export const getLocalDashboardStats = (): DashboardStats => {
  const builds = getLocalBuilds();
  const totalBuilds = builds.length;

  const successfulBuilds = builds.filter(
    (build) => build.buildStatus === BuildStatus.Success || (build.source === BuildSource.CI_PIPELINE && build.pipelineStatus === BuildStatus.Success)
  ).length;
  
  const buildSuccessRatio = totalBuilds > 0 ? successfulBuilds / totalBuilds : 0;

  const channelDistribution = builds.reduce((acc, build) => {
    acc[build.channel] = (acc[build.channel] || 0) + 1;
    return acc;
  }, {} as Record<Channel, number>);
  Object.values(Channel).forEach(ch => { if (!channelDistribution[ch]) channelDistribution[ch] = 0; });


  const platformDistribution = builds.reduce((acc, build) => {
    acc[build.platform] = (acc[build.platform] || 0) + 1;
    return acc;
  }, {} as Record<Platform, number>);
  Object.values(Platform).forEach(p => { if (!platformDistribution[p]) platformDistribution[p] = 0; });


  const downloadsByVersion = builds
    .filter(build => (build.downloadCount || 0) > 0)
    .sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0))
    .slice(0, 5)
    .map(build => ({
      versionId: build.id,
      appName: build.appName,
      versionName: build.versionName,
      platform: build.platform,
      count: build.downloadCount || 0,
    }));

  return {
    totalBuilds,
    downloadsByVersion,
    buildSuccessRatio,
    channelDistribution,
    platformDistribution,
  };
};

export const applyLocalRetentionPolicy = (appName: string, platform: Platform, channel: Channel, settings: AppSettings) => {
  console.info(`[LocalRetention] Checking for builds to prune for group: ${appName} | ${platform} | ${channel}`);
  if (!settings.enableAutoClean) {
    console.info(`[LocalRetention] Auto-cleaning is disabled. Skipping prune for group: ${appName} | ${platform} | ${channel}`);
    return;
  }

  let query = 'SELECT id, fileName, uploadDate, source FROM builds WHERE appName = ? AND platform = ? AND channel = ?';
  const queryParams: any[] = [appName, platform, channel];

  if (settings.deletePolicy === 'CIOnly') {
    query += ' AND source = ?';
    queryParams.push(BuildSource.CI_PIPELINE);
  }
  query += ' ORDER BY uploadDate DESC';

  const groupBuilds = db.prepare(query).all(...queryParams).map(mapRowToAppVersion);

  if (groupBuilds.length > settings.maxBuildsPerGroup) {
    const buildsToDelete = groupBuilds.slice(settings.maxBuildsPerGroup);
    console.warn(`[LocalRetention] Found ${groupBuilds.length} builds (policy: ${settings.deletePolicy}) for group. Max allowed: ${settings.maxBuildsPerGroup}. Deleting ${buildsToDelete.length} oldest builds.`);

    for (const build of buildsToDelete) {
      console.info(`[LocalRetention] Pruning build ID: ${build.id}, FileName: ${build.fileName}`);
      deleteLocalBuild(build.id, settings.localBuildPath, settings.useSupabaseStorage); 
    }
  } else {
      console.info(`[LocalRetention] No builds to prune. Current: ${groupBuilds.length}, Max: ${settings.maxBuildsPerGroup}`);
  }
};

export const forceRebuildLocal = (originalBuildId: string, triggeredByUsername: string): AppVersion | null => {
    const originalBuild = getLocalBuildById(originalBuildId);
    if (!originalBuild) return null;

    const getNextVersion = (currentVersion: string, suffix: string): string => {
        const rebuildSuffixRegex = new RegExp(`-${suffix}-(\\d+)$`);
        const match = currentVersion.match(rebuildSuffixRegex);
        if (match) {
            const nextNum = parseInt(match[1], 10) + 1;
            return currentVersion.replace(rebuildSuffixRegex, `-${suffix}-${nextNum}`);
        }
        return `${currentVersion}-${suffix}-1`;
    };
    
    const newBuildData: Omit<AppVersion, 'id' | 'qrCodeUrl'> & { qrCodeUrl?: string } = {
        ...originalBuild,
        versionName: getNextVersion(originalBuild.versionName, 'rbld'),
        versionCode: getNextVersion(originalBuild.versionCode, 'RBLD'),
        changelog: `Forced rebuild of v${originalBuild.versionName}. Triggered by ${triggeredByUsername}.\n---\nOriginal Changelog:\n${originalBuild.changelog}`,
        previousChangelog: originalBuild.changelog,
        uploadDate: new Date().toISOString(),
        buildStatus: BuildStatus.Success,
        downloadCount: 0,
        source: BuildSource.MANUAL_UPLOAD, 
        triggeredBy: triggeredByUsername,
        ciBuildId: undefined,
        pipelineStatus: undefined,
        ciLogsUrl: undefined,
        downloadUrl: originalBuild.downloadUrl, 
        fileName: originalBuild.fileName, 
    };
    return addLocalBuild(newBuildData); // addLocalBuild will handle qrCodeUrl
};


// Monitored Repository Operations
export const getLocalMonitoredRepositories = (): MonitoredRepository[] => {
  const stmt = db.prepare('SELECT * FROM monitored_repositories ORDER BY repo_url ASC');
  const rows = stmt.all();
  return rows.map(mapRowToMonitoredRepository);
};

export const getLocalMonitoredRepositoryById = (id: string): MonitoredRepository | null => {
  const stmt = db.prepare('SELECT * FROM monitored_repositories WHERE id = ?');
  const row = stmt.get(id);
  return row ? mapRowToMonitoredRepository(row) : null;
};

export const addLocalMonitoredRepository = (repoData: Omit<MonitoredRepository, 'id' | 'created_at' | 'updated_at'>): MonitoredRepository => {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const newRepo: MonitoredRepository = {
    ...repoData,
    id,
    created_at: createdAt,
    auto_trigger_enabled: repoData.auto_trigger_enabled !== undefined ? repoData.auto_trigger_enabled : true,
  };

  const stmt = db.prepare(`
    INSERT INTO monitored_repositories (
      id, repo_url, default_branch, default_platform, default_channel, auto_trigger_enabled, created_at
    ) VALUES (
      @id, @repo_url, @default_branch, @default_platform, @default_channel, @auto_trigger_enabled, @created_at
    )`);
  
  stmt.run({
    ...newRepo,
    auto_trigger_enabled: newRepo.auto_trigger_enabled ? 1 : 0, 
  });
  return newRepo;
};

export const updateLocalMonitoredRepository = (id: string, repoData: Partial<Omit<MonitoredRepository, 'id' | 'created_at' | 'updated_at'>>): MonitoredRepository | null => {
  const existingRepo = getLocalMonitoredRepositoryById(id);
  if (!existingRepo) return null;

  const updatedAt = new Date().toISOString();
  const updatePayload: any = { ...repoData, updated_at: updatedAt };

  if (updatePayload.auto_trigger_enabled !== undefined) {
    updatePayload.auto_trigger_enabled = updatePayload.auto_trigger_enabled ? 1 : 0;
  }
  
  let setClauses = Object.keys(repoData).map(key => `${key} = @${key}`).join(', ');
  if (setClauses) { // Add updated_at if other fields are being updated
      setClauses += ', updated_at = @updated_at';
  } else { // If only updated_at needs to be set (e.g. a "touch" operation, though unlikely here)
      setClauses = 'updated_at = @updated_at';
  }
  
  const stmt = db.prepare(`UPDATE monitored_repositories SET ${setClauses} WHERE id = @id`);
  stmt.run({ ...updatePayload, id }); // Pass all keys from updatePayload which includes updated_at
  
  return getLocalMonitoredRepositoryById(id);
};

export const deleteLocalMonitoredRepository = (id: string): boolean => {
  const stmt = db.prepare('DELETE FROM monitored_repositories WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};


const nodeProcess = process as NodeJS.Process;
nodeProcess.on('exit', () => {
  if (db && db.open) {
    try {
      db.close(); 
      console.log('[LocalDbService] SQLite database connection closed.');
    } catch (err: any) {
      console.error('[LocalDbService] Error closing SQLite database:', err.message);
    }
  }
});
nodeProcess.on('SIGINT', () => nodeProcess.exit()); 
nodeProcess.on('SIGTERM', () => nodeProcess.exit());
