'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './connect.module.css';

/* ────────────────────────────────────────────────────────── */
/* Platform metadata                                           */
/* ────────────────────────────────────────────────────────── */
interface PlatformMeta {
  name: string;
  color: string;
  gradient: string;
  description: string;
  icon: React.ReactNode;
  permissions: string[];
  dataTypes: string[];
  syncFrequency: string;
  privacyNote: string;
  oauthUrl: string;
}

const platformMeta: Record<string, PlatformMeta> = {
  reddit: {
    name: 'Reddit',
    color: '#ff4500',
    gradient: 'linear-gradient(135deg, #ff4500 0%, #ff6b35 100%)',
    description: 'Connect your Reddit account to index comments, posts, upvotes, and saved items for full memory coverage.',
    icon: <RedditIcon />,
    permissions: ['Read your posts and comments', 'Access your saved items', 'Read your profile information', 'View your subscribed subreddits'],
    dataTypes: ['Comments', 'Posts', 'Saved items', 'Profile data'],
    syncFrequency: 'Every 6 hours',
    privacyNote: 'EYES uses read-only access. We never post, comment, or modify your account.',
    oauthUrl: '/api/connect/reddit/start',
  },
  gmail: {
    name: 'Gmail',
    color: '#ea4335',
    gradient: 'linear-gradient(135deg, #ea4335 0%, #ff6b6b 100%)',
    description: 'Connect Gmail to index email threads, attachments, and contacts for comprehensive memory mapping.',
    icon: <GoogleIcon />,
    permissions: ['Read your email messages', 'Read email metadata and headers', 'Access contact information'],
    dataTypes: ['Email threads', 'Sent messages', 'Attachments', 'Contacts'],
    syncFrequency: 'Every 4 hours',
    privacyNote: 'EYES reads email metadata and content for indexing only. We never send or delete emails.',
    oauthUrl: '/api/connect/google/start?platform=gmail',
  },
  github: {
    name: 'GitHub',
    color: '#58a6ff',
    gradient: 'linear-gradient(135deg, #58a6ff 0%, #79c0ff 100%)',
    description: 'Connect GitHub to index repositories, commits, issues, PRs, and code review comments.',
    icon: <GitHubIcon />,
    permissions: ['Read repository information', 'Read commits and branches', 'Read issues and pull requests'],
    dataTypes: ['Commits', 'Pull requests', 'Issues', 'Repositories'],
    syncFrequency: 'Every 2 hours',
    privacyNote: 'EYES uses read-only access. We never push code or create issues.',
    oauthUrl: '/api/connect/github/start',
  },
  'google-calendar': {
    name: 'Google Calendar',
    color: '#4285f4',
    gradient: 'linear-gradient(135deg, #4285f4 0%, #669df6 100%)',
    description: 'Connect Google Calendar to index events and meetings for time-based memory mapping.',
    icon: <GoogleIcon />,
    permissions: ['Read calendar events', 'Read attendee lists', 'Access calendar metadata'],
    dataTypes: ['Events', 'Meeting Details', 'Recurring Patterns'],
    syncFrequency: 'Every 1 hour',
    privacyNote: 'EYES reads calendar data only. We never create or delete events.',
    oauthUrl: '/api/connect/google/start?platform=google-calendar',
  },
  notion: {
    name: 'Notion',
    color: '#000000',
    gradient: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
    description: 'Connect Notion to index your pages, databases, and workspace content for deep knowledge retrieval.',
    icon: <NotionIcon />,
    permissions: ['Read workspace content', 'Read pages and databases', 'Access user information', 'View workspace metadata'],
    dataTypes: ['Pages', 'Databases', 'Comments', 'Block content'],
    syncFrequency: 'Every 2 hours',
    privacyNote: 'EYES uses the Notion API for read-only access. We only index content you explicitly share with our integration.',
    oauthUrl: '/api/connect/notion/start',
  },
  slack: {
    name: 'Slack',
    color: '#4a154b',
    gradient: 'linear-gradient(135deg, #4a154b 0%, #611f69 100%)',
    description: 'Connect Slack to index workspace messages, threads, and files from your channels.',
    icon: <SlackIcon />,
    permissions: ['Read public channels', 'Read private channels (with user token)', 'Read direct messages', 'Access files'],
    dataTypes: ['Messages', 'Threads', 'Channel Metadata', 'Files'],
    syncFrequency: 'Every 30 minutes',
    privacyNote: 'EYES uses user-scoped tokens. We only index messages you have access to.',
    oauthUrl: '/api/connect/slack/start',
  },
  discord: {
    name: 'Discord',
    color: '#5865f2',
    gradient: 'linear-gradient(135deg, #5865f2 0%, #7289da 100%)',
    description: 'Connect Discord to index server messages, DM threads (where available), and interactions.',
    icon: <DiscordIcon />,
    permissions: ['Read messages via OAuth', 'View your profile and servers', 'Read channel history'],
    dataTypes: ['Server Messages', 'Personal activity', 'Metadata'],
    syncFrequency: 'Every 30 minutes',
    privacyNote: 'EYES respects Discord privacy settings. We never store non-public user data without consent.',
    oauthUrl: '/api/connect/discord/start',
  }
};

type ConnectionState = 'idle' | 'connecting' | 'authenticating' | 'syncing' | 'connected' | 'error';

interface PlatformReadiness {
  id: string;
  connected: boolean;
  status: ConnectionState;
  totalItems?: number;
  lastSyncAt?: string | null;
  errorMessage?: string | null;
}

interface PlatformReadinessPayload {
  platforms?: PlatformReadiness[];
}

interface ConnectorSettingsPayload {
  dataTypes?: string[];
  syncEnabled?: boolean;
}

async function parseResponseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) {
      return payload.error;
    }
  } catch {
    // ignored
  }

  return fallback;
}

export default function ConnectPlatformPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, supabase } = useAuth();
  const platformId = (params.platform as string)?.toLowerCase();
  const meta = platformMeta[platformId];
  
  const [activeSection, setActiveSection] = useState('overview');
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [platformReadiness, setPlatformReadiness] = useState<PlatformReadiness | null>(null);
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [actionError, setActionError] = useState('');
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const refreshPlatformReadiness = useCallback(async () => {
    const response = await fetch('/api/platform-readiness', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load platform readiness (${response.status})`);
    }

    const payload = (await response.json()) as PlatformReadinessPayload;
    const target = payload.platforms?.find((platform) => platform.id === platformId) ?? null;
    setPlatformReadiness(target);

    if (target) {
      setConnectionState(target.status);
    }
  }, [platformId]);

  const runPlatformAction = useCallback(
    async (request: { url: string; method: 'POST' | 'DELETE'; body?: Record<string, unknown> }) => {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.body ? { 'Content-Type': 'application/json' } : undefined,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      if (!response.ok) {
        const fallback = `Action failed (${response.status})`;
        const message = await parseResponseError(response, fallback);
        throw new Error(message);
      }

      await refreshPlatformReadiness();
    },
    [refreshPlatformReadiness]
  );
  
  // ─── Initial Load ──────────────────────────────────────────
  useEffect(() => {
    if (!meta || !platformId) return;
    
    // Load readiness stats
    refreshPlatformReadiness().catch((err) => {
      console.error('Failed to load readiness stats:', err);
    });

    // Load actual settings from database
    fetch(`/api/connector-settings/${platformId}`)
      .then(res => res.json() as Promise<ConnectorSettingsPayload>)
      .then(data => {
        if (data.dataTypes) setSelectedDataTypes(data.dataTypes);
        if (typeof data.syncEnabled === 'boolean') setSyncEnabled(data.syncEnabled);
      })
      .catch(err => console.error('Failed to load settings:', err));

    // Parse potential OAuth errors from the URL
    if (searchParams.get('oauth') === 'error') {
      const reason = searchParams.get('reason') || 'Unknown error occurred during authentication.';
      setActionError(`OAuth Error: ${reason.replace(/_/g, ' ')}`);
    }

  }, [meta, platformId, refreshPlatformReadiness, searchParams]);

  // ─── Sync Status Polling ───────────────────────────────────
  useEffect(() => {
    if (!user?.id || !meta || !platformId) return;
    const loadState = async () => {
      const dbId = platformId === 'google-calendar' ? 'google_calendar' : platformId;
      const { data } = await supabase.from('sync_status').select('*').eq('user_id', user.id).eq('platform', dbId).maybeSingle();
      if (data) setConnectionState(data.status as ConnectionState);
    };
    loadState();
    const interval = setInterval(loadState, 5000);
    return () => clearInterval(interval);
  }, [meta, platformId, supabase, user?.id]);

  // ─── Saving Logic ──────────────────────────────────────────
  const saveSettings = useCallback(async (updatedDataTypes: string[], updatedSyncEnabled: boolean) => {
    setSaveStatus('saving');
    try {
      const response = await fetch(`/api/connector-settings/${platformId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataTypes: updatedDataTypes,
          syncEnabled: updatedSyncEnabled
        })
      });
      if (response.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  }, [platformId]);

  const handleToggleDataType = (type: string) => {
    const newList = selectedDataTypes.includes(type) 
      ? selectedDataTypes.filter(t => t !== type) 
      : [...selectedDataTypes, type];
    setSelectedDataTypes(newList);
    saveSettings(newList, syncEnabled);
  };

  const handleToggleSync = () => {
    const newState = !syncEnabled;
    setSyncEnabled(newState);
    saveSettings(selectedDataTypes, newState);
  };

  const handleSyncNow = useCallback(async () => {
    setActionError('');
    setIsSyncingNow(true);
    setConnectionState('syncing');

    try {
      await runPlatformAction({
        url: `/api/sync/${platformId}?depth=deep`,
        method: 'POST',
      });
    } catch (error) {
      setConnectionState('error');
      setActionError(error instanceof Error ? error.message : 'Failed to trigger sync.');
    } finally {
      setIsSyncingNow(false);
    }
  }, [platformId, runPlatformAction]);

  const platformLabel = meta?.name || 'this platform';

  const handleDisconnect = useCallback(async () => {
    if (!window.confirm(`Disconnect ${platformLabel} and remove its active tokens?`)) {
      return;
    }

    setActionError('');
    setIsDisconnecting(true);

    try {
      await runPlatformAction({
        url: `/api/data/platform/${platformId}`,
        method: 'DELETE',
        body: { disconnect: true },
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to disconnect platform.');
    } finally {
      setIsDisconnecting(false);
    }
  }, [platformLabel, platformId, runPlatformAction]);

  const handlePurge = useCallback(async () => {
    if (!window.confirm(`Permanently purge all indexed ${platformLabel} memories? This cannot be undone.`)) {
      return;
    }

    setActionError('');
    setIsPurging(true);

    try {
      await runPlatformAction({
        url: `/api/data/platform/${platformId}`,
        method: 'DELETE',
        body: { disconnect: false },
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to purge platform data.');
    } finally {
      setIsPurging(false);
    }
  }, [platformLabel, platformId, runPlatformAction]);

  // ─── Hydration / Selection Guard ───────────────────────────
  if (!platformId || !meta) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.loadingInner}>
          <div className={styles.spinner} />
          <p>INITIALIZING SECURE LINK...</p>
        </div>
      </div>
    );
  }

  if (!meta) return <div className={styles.errorPage}>Platform not found</div>;

  const hasTokens = platformReadiness ? platformReadiness.connected : false;
  const isConnected = hasTokens || connectionState === 'connected';
  const isProcessing = ['connecting', 'authenticating', 'syncing'].includes(connectionState);

  return (
    <div className={styles.page}>
      <button className={styles.backLink} onClick={() => router.push('/')}>← Back to Dashboard</button>

      <div className={styles.hero}>
        <div className={styles.heroIcon}>{meta.icon}</div>
        <div className={styles.heroInfo}>
          <div className={styles.heroTitleRow}>
            <h1 className={styles.heroTitle}>{meta.name}</h1>
            <span className={`${styles.statusChip} ${isConnected ? styles.statusConnected : isProcessing ? styles.statusProcessing : styles.statusDisconnected}`}>
              <span className={styles.statusChipDot} />
              {isConnected ? 'Connected & syncing' : isProcessing ? 'Processing...' : 'Not connected'}
            </span>
            <button className={isConnected ? styles.heroReconnectBtn : styles.heroConnectBtn} onClick={() => window.location.href = meta.oauthUrl}>
              {isConnected ? 'Reconnect' : 'Connect Platform'}
            </button>
          </div>
          <p className={styles.heroDesc}>{meta.description}</p>
        </div>
      </div>

      <div className={styles.sectionTabs}>
        {['overview', 'permissions', 'data', 'settings'].map(tab => (
          <button key={tab} className={`${styles.sectionTab} ${activeSection === tab ? styles.sectionTabActive : ''}`} onClick={() => setActiveSection(tab)}>
            {tab.toUpperCase()}
          </button>
        ))}
        {saveStatus !== 'idle' && (
          <div className={`${styles.saveStatus} ${styles['status' + saveStatus.charAt(0).toUpperCase() + saveStatus.slice(1)]}`}>
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Settings Saved' : 'Error Saving'}
          </div>
        )}
      </div>

      <div className={styles.sectionContent}>
        {activeSection === 'overview' && (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{(platformReadiness?.totalItems || 0).toLocaleString()}</span>
                <span className={styles.statLabel}>Items Indexed</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{isConnected ? 'Active' : 'Idle'}</span>
                <span className={styles.statLabel}>Status</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{meta.syncFrequency}</span>
                <span className={styles.statLabel}>Frequency</span>
              </div>
            </div>
            <div className={styles.recentCard}>
              <h3 className={styles.cardTitle}>Recent Activity</h3>
              <div className={styles.activityList}>
                 {!isConnected ? (
                   <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>No recent activity. Connect platform to begin indexing.</p>
                 ) : (
                   <>
                     {platformReadiness?.lastSyncAt ? (
                       <div className={styles.activityItem}>
                         <span>Last sync completed</span>
                         <span className={styles.activityTime}>{new Date(platformReadiness.lastSyncAt).toLocaleTimeString()}</span>
                       </div>
                     ) : (
                       <div className={styles.activityItem}>
                         <span>Waiting for first memory sync...</span>
                         <span className={styles.activityTime}>Pending</span>
                       </div>
                     )}
                     <div className={styles.activityItem}>
                       <span>Secure connection verified</span>
                       <span className={styles.activityTime}>Active</span>
                     </div>
                   </>
                 )}
              </div>
              <div className={styles.actions}>
                {isConnected && (
                  <>
                    <button className={styles.syncNowBtn} onClick={handleSyncNow} disabled={isSyncingNow || isDisconnecting || isPurging}>
                      {isSyncingNow ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button className={styles.disconnectBtn} onClick={handleDisconnect} disabled={isDisconnecting || isPurging || isSyncingNow}>
                      {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </>
                )}
              </div>
              {actionError && <p className={styles.oauthErrorReason}>{actionError}</p>}
            </div>
          </>
        )}

        {activeSection === 'permissions' && (
          <div className={styles.permissionsCard}>
            <h3 className={styles.cardTitle}>Platform Permissions</h3>
            <p className={styles.sectionSubtitle}>We request the following scopes to process your memory data.</p>
            <div className={styles.permissionsList}>
              {meta.permissions.map(p => (
                <div key={p} className={styles.permissionItem}>
                  <div className={styles.permissionCheck}>✓</div>
                  <span className={styles.permissionText}>{p}</span>
                </div>
              ))}
            </div>
            <div className={styles.privacyNote}>{meta.privacyNote}</div>
          </div>
        )}

        {activeSection === 'data' && (
          <div className={styles.dataCard}>
            <h3 className={styles.cardTitle}>Data Selection</h3>
            <p className={styles.sectionSubtitle}>Choose which categories of data to include in your index.</p>
            <div className={styles.dataTypesList}>
              {meta.dataTypes.map(type => (
                <div key={type} className={styles.dataTypeItem} onClick={() => handleToggleDataType(type)}>
                  <span className={styles.dataTypeLabel}>{type}</span>
                  <label className={styles.toggleSwitch} onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className={styles.toggleInput}
                      aria-label={`Toggle ${type} data`}
                      title={`Toggle ${type} data`}
                      checked={selectedDataTypes.includes(type)} 
                      onChange={() => handleToggleDataType(type)} 
                    />
                    <span className={styles.toggleSlider}></span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'settings' && (
          <div className={styles.settingsCard}>
            <h3 className={styles.cardTitle}>Sync Settings</h3>
            <div className={styles.settingRow} onClick={handleToggleSync}>
              <div>
                <span className={styles.settingLabel}>Automatic Synchronization</span>
                <span className={styles.settingDesc}>Allow background indexing of new data.</span>
              </div>
              <label className={styles.toggleSwitch} onClick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  className={styles.toggleInput}
                  aria-label="Toggle automatic synchronization"
                  title="Toggle automatic synchronization"
                  checked={syncEnabled} 
                  onChange={handleToggleSync} 
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>
            <div className={styles.settingRow}>
               <div>
                 <span className={styles.settingLabel}>Data Retention</span>
                 <span className={styles.settingDesc}>How long to keep private index copies.</span>
               </div>
               <span className={styles.settingValue}>Indefinite</span>
            </div>
            <div className={styles.dangerZone}>
               <h4 className={styles.dangerTitle}>Danger Zone</h4>
              <p className={styles.dangerDescription}>Purging will permanently remove all indexed memory for this platform.</p>
               <button className={styles.purgeBtn} onClick={handlePurge} disabled={isPurging || isDisconnecting || isSyncingNow}>
                 {isPurging ? 'Purging...' : 'Purge All Data'}
               </button>
               {actionError && <p className={styles.oauthErrorReason}>{actionError}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Icons (preserved)
function RedditIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#ff4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>; }
function GoogleIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>; }
function GitHubIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>; }

function NotionIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 256 268">
      <path fill="var(--text-primary)" d="M16.092 11.538L164.09.608c18.179-1.56 22.85-.508 34.28 7.801l47.243 33.282C253.406 47.414 256 48.975 256 55.207v182.527c0 11.439-4.155 18.205-18.696 19.24L65.44 267.378c-10.913.517-16.11-1.043-21.825-8.327L8.826 213.814C2.586 205.487 0 199.254 0 191.97V29.726c0-9.352 4.155-17.153 16.092-18.188" />
      <path d="M47.794 24.363l135.297-9.528c4.675-.312 6.223.738 8.309 3.125l45.69 54.102c2.076 2.083 3.114 4.678 3.114 8.323v146.439c0 4.157-1.558 7.282-5.713 7.803l-132.68 8.847c-5.722.52-8.319-1.041-10.916-4.162L41.564 186.1c-2.076-3.123-3.114-5.204-3.114-10.404V32.167c0-4.682 2.076-7.287 9.344-7.804m21.815 152.05h3.114V72.937l-15.06 9.363V155.15c0 7.28 5.713 14.564 11.946 21.263m118.675 6.764c4.156-3.12 7.272-8.843 7.272-13.003V65.13l-13.504-9.363l-45.185 71.01l-24.928-40.046l-41.028 10.404v93.376c0 6.241-3.636 10.404-9.344 14.044s-8.828 2.597-8.828 6.76c0 2.08.519 4.161 2.077 5.723l8.828 6.763c3.635 3.12 7.272-2.599 15.06 2.08l109.58-7.803" />
      <path d="M129.278 143.666l44.664-71.012l6.233 4.161v112.357h-3.114l-4.155.52v-91.037L152.128 131.7" />
    </svg>
  );
}

function SlackIcon() { 
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 122.8 122.8">
      <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a"/>
      <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0"/>
      <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d"/>
      <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e"/>
    </svg>
  ); 
}
function DiscordIcon() { 
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="var(--text-primary)">
      <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.33-.35-.76-.53-1.09a.09.09 0 0 0-.07-.03c-1.5.26-2.94.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09a10.49 10.49 0 0 1-1.59-.73.08.08 0 0 1-.01-.13c.11-.08.22-.16.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09.01.12-.52.31-1.07.57-1.63.79-.04.01-.06.06-.04.09.32.61.68 1.19 1.07 1.74.02.03.05.04.08.02 1.71-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.03-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" />
    </svg>
  ); 
}
