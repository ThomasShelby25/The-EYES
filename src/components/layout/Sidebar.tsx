'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { 
  ChatIcon, 
  ConnectorsIcon, 
  HistoryIcon,
  PlusIcon,
  EyeIconSmall
} from '../common/icons/SidebarIcons';
import styles from './Sidebar.module.css';

interface Platform {
  id: string;
  connected: boolean;
  status: string;
}

export default function Sidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = searchParams.get('view') || 'dashboard';
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync readiness score for the bottom gauge
  useEffect(() => {
    const loadReadiness = async () => {
      try {
        const response = await fetch('/api/platform-readiness', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          setPlatforms(data.platforms || []);
        }
      } catch (err) {
        console.error('Sidebar readiness sync failed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadReadiness();
    const interval = setInterval(loadReadiness, 20000);
    return () => clearInterval(interval);
  }, []);

  const connectedCount = platforms.filter(p => p.connected).length;
  const coverageScore = useMemo(() => {
    if (connectedCount === 0) return 0;
    const readyCount = platforms.filter(p => p.connected && p.status !== 'error').length;
    return Math.round((readyCount / connectedCount) * 100);
  }, [platforms, connectedCount]);

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (coverageScore / 100) * circumference;

  const navigateToView = (view: string) => {
    router.push(`/?view=${view}`);
  };

  return (
    <aside className={styles.sidebar}>
      {/* Brand Header / New Chat */}
      <button className={styles.newChatBtn} onClick={() => navigateToView('dashboard')}>
        <PlusIcon />
        <span>New Chat</span>
      </button>

      <div className={styles.scrollArea}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>WORKSPACE</h3>
          <div className={styles.itemList}>
            
            <div 
              className={`${styles.item} ${activeView === 'dashboard' ? styles.itemActive : ''}`} 
              onClick={() => navigateToView('dashboard')}
            >
              <div className={styles.itemIcon}><ChatIcon /></div>
              <div className={styles.itemMain}>
                <span className={styles.itemLabel}>Chat</span>
                <span className={styles.itemDesc}>Start a new thread</span>
              </div>
            </div>

            <div 
              className={`${styles.item} ${activeView === 'connectors' ? styles.itemActive : ''}`} 
              onClick={() => navigateToView('connectors')}
            >
              <div className={styles.itemIcon}><ConnectorsIcon /></div>
              <div className={styles.itemMain}>
                <span className={styles.itemLabel}>Connectors</span>
                <span className={styles.itemDesc}>Manage connected sources</span>
              </div>
            </div>

            <div 
              className={`${styles.item} ${activeView === 'history' ? styles.itemActive : ''}`} 
              onClick={() => navigateToView('history')}
            >
              <div className={styles.itemIcon}><HistoryIcon /></div>
              <div className={styles.itemMain}>
                <span className={styles.itemLabel}>History</span>
                <span className={styles.itemDesc}>Review runs and activity</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Bottom Readiness Gauge (from Screenshot) */}
      <div className={styles.footer}>
        <div className={styles.readinessCard} onClick={() => navigateToView('connectors')}>
          <div className={styles.readinessHeader}>
             <span className={styles.readinessIcon}><EyeIconSmall /></span>
             <span className={styles.readinessTitle}>SOURCE READINESS</span>
          </div>
          <div className={styles.readinessContent}>
            <div className={styles.gaugeWrapper}>
              <svg viewBox="0 0 100 100" className={styles.gaugeSvg}>
                <circle cx="50" cy="50" r="45" className={styles.gaugeBg} />
                <circle 
                  cx="50" cy="50" r="45" 
                  className={styles.gaugeFill}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                />
                <text x="50" y="58" textAnchor="middle" className={styles.gaugeText}>{coverageScore}%</text>
              </svg>
            </div>
            <div className={styles.readinessInfo}>
               <div className={styles.platformsCount}>
                 {connectedCount}/{platforms.length || 0} Platforms
               </div>
               <div className={styles.reliabilityLabel}>
                 Reliability: <span className={styles.reliabilityHigh}>High</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
