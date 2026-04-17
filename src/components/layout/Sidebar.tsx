'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  RedditIconOfficial, 
  GitHubIconOfficial, 
  GmailIconOfficial, 
  NotionIconOfficial, 
  CalendarIconOfficial,
  SlackIconOfficial,
  DiscordIconOfficial
} from '@/components/common/icons/PlatformIcons';
import styles from './Sidebar.module.css';

interface Platform {
  id: 'reddit' | 'gmail' | 'github' | 'notion' | 'google-calendar' | 'slack' | 'discord';
  name: string;
  icon: React.ReactNode;
  items: number;
  timeAgo: string;
  connectionType: 'OAuth';
  requiredScopes: string[];
  optional: boolean;
  deferred: boolean;
  configured: boolean;
  missingEnv: string[];
  connected: boolean;
  status: 'idle' | 'connecting' | 'authenticating' | 'syncing' | 'connected' | 'error';
}

type PlatformReadinessApi = Omit<Platform, 'icon' | 'items' | 'timeAgo'> & {
  totalItems?: number;
  lastSyncAt?: string | null;
};

type PlatformReadinessPayload = {
  platforms?: PlatformReadinessApi[];
};

const formatRelativeTime = (iso: string | null | undefined) => {
  if (!iso) return 'Not connected';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const isTransientFetchInterruption = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();

  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('the user aborted a request')
  );
};

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const connectedPlatforms = useMemo(() => {
    return platforms.filter(p => p.connected);
  }, [platforms]);

  const coverageScore = useMemo(() => {
    if (connectedPlatforms.length === 0) return 0;
    const readyCount = connectedPlatforms.filter(p => p.status !== 'syncing' && p.status !== 'error').length;
    return Math.round((readyCount / connectedPlatforms.length) * 100);
  }, [connectedPlatforms]);

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (coverageScore / 100) * circumference;


  useEffect(() => {
    let active = true;
    let transientWarned = false;

    const loadReadiness = async () => {
      try {
        const response = await fetch('/api/platform-readiness', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as PlatformReadinessPayload;
        if (!active) return;

        const uiPlatforms: Platform[] = (payload.platforms ?? []).map((p) => ({
          ...p,
          icon: p.id === 'reddit' ? <RedditIconOfficial /> : 
                p.id === 'github' ? <GitHubIconOfficial /> : 
                p.id === 'gmail' ? <GmailIconOfficial /> : 
                p.id === 'notion' ? <NotionIconOfficial /> :
                p.id === 'google-calendar' ? <CalendarIconOfficial /> : 
                p.id === 'slack' ? <SlackIconOfficial /> :
                p.id === 'discord' ? <DiscordIconOfficial /> : <GenericIcon />,
          items: p.totalItems || 0,
          timeAgo: p.connected ? formatRelativeTime(p.lastSyncAt) : 'Not connected'
        }));
        setPlatforms(uiPlatforms);
        transientWarned = false;
      } catch (err) {
        if (!active) return;
        if (isTransientFetchInterruption(err)) {
          if (!transientWarned) {
            console.warn('Readiness request was temporarily interrupted. Retrying automatically.');
            transientWarned = true;
          }
          return;
        }
        console.error('Failed to load readiness:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadReadiness();
    const intervalId = setInterval(loadReadiness, 10000);
    return () => { active = false; clearInterval(intervalId); };
  }, []);

  return (
    <aside className={styles.sidebar}>
      <button className={styles.newSearchBtn} onClick={() => router.push('/?view=connectors')}>
        <PlusIcon />
        <span>New Search</span>
      </button>

      <div className={styles.scrollArea}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>CONNECTED</h3>
          <div className={styles.itemList}>
            {isLoading ? (
               <div className={styles.sidebarLoadingPlaceholder}>
                  <div className={styles.pulseBar} />
                  <div className={`${styles.pulseBar} ${styles.pulseBar80}`} />
                  <div className={`${styles.pulseBar} ${styles.pulseBar60}`} />
               </div>
            ) : connectedPlatforms.length > 0 ? (
              connectedPlatforms.map((platform) => (
                <div key={platform.id} className={`${styles.item} ${pathname?.includes(platform.id) ? styles.itemActive : ''}`} onClick={() => router.push(`/connect/${platform.id}`)}>
                  <div className={styles.itemIcon}>{platform.icon}</div>
                  <div className={styles.itemMain}>
                    <span className={styles.itemLabel}>{platform.name}</span>
                    <span className={styles.itemCount}>{platform.items > 0 ? (platform.items > 999 ? `${(platform.items/1000).toFixed(1)}k` : platform.items) : '0'}</span>
                  </div>
                  <div className={`${styles.statusDot} ${styles.statusOnline}`} />
                </div>
              ))
            ) : (
              <div className={styles.emptySidebar}>
                 <span>No platforms active.</span>
                 <p onClick={() => router.push('/?view=connectors')}>Connect now →</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={`${styles.gaugeSection} ${styles.gaugeSectionClickable}`} onClick={() => router.push('/?view=readiness')}>
          <div className={styles.gaugeHeader}>
             <span className={styles.gaugeIcon}><EyeIconSmall /></span>
             <span className={styles.gaugeTitle}>CONNECTOR READINESS</span>
          </div>
          <div className={styles.gaugeWrapper}>
            <div className={styles.gaugeMini}>
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent-purple)" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 50 50)" />
                <text x="50" y="58" textAnchor="middle" className={styles.scoreText}>{coverageScore}%</text>
              </svg>
            </div>
            <div className={styles.gaugeInfo}>
               <div className={styles.gaugeActiveCount}>
                 {connectedPlatforms.length > 0 
                   ? `${connectedPlatforms.filter(p => p.status !== 'syncing' && p.status !== 'error').length}/${connectedPlatforms.length} Platforms`
                   : '0/0 Platforms'
                 }
               </div>
               <div className={styles.gaugeReliability}>Reliability: <span className={styles.highText}>High</span></div>
            </div>
          </div>
        </div>
      </div>

    </aside>
  );
}
// Icons maintained in Sidebar for specific layout needs
function PlusIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>; }
function EyeIconSmall() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }
function GenericIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>; }

