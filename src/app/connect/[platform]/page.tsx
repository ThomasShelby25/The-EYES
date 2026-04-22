'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  RedditIconOfficial, 
  GitHubIconOfficial, 
  GmailIconOfficial, 
  CalendarIconOfficial, 
  NotionIconOfficial, 
  SlackIconOfficial, 
  DiscordIconOfficial 
} from '@/components/common/icons/PlatformIcons';
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
    icon: <RedditIconOfficial />,
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
    icon: <GmailIconOfficial />,
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
    icon: <GitHubIconOfficial />,
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
      <button className={styles.backLink} onClick={() => router.push('/?view=readiness')}>← Back to Dashboard</button>

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


