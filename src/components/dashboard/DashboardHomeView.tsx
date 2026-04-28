'use client';

import React from 'react';
import styles from '../MainContent.module.css';
import { ALL_POSSIBLE_PLATFORMS } from '@/config/platforms';
import type { PlatformStatus } from '@/types/dashboard';

interface DashboardHomeViewProps {
  platforms: PlatformStatus[];
}

export function DashboardHomeView({ platforms }: DashboardHomeViewProps) {
  const [activeCategory, setActiveCategory] = React.useState<string>('All');
  const [liveStatus, setLiveStatus] = React.useState<{ memoriesIndexed: number; isSyncing: boolean; activeSyncs: string[] } | null>(null);

  React.useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/sync/status');
        if (res.ok) {
          const data = await res.json();
          setLiveStatus({
            memoriesIndexed: data.memoriesIndexed || 0,
            isSyncing: data.isSyncing,
            activeSyncs: data.activeSyncs || [],
          });
        }
      } catch (e) {
        console.error('Failed to fetch live sync status', e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 8000); // Poll every 8s
    return () => clearInterval(interval);
  }, []);
  
  const remainingPlatforms = ALL_POSSIBLE_PLATFORMS.filter(p => !platforms.find(ap => ap.id === p.id)?.connected);
  const categories = ['All', 'Productivity', 'Development', 'Social', 'Creative', 'Health'];

  const filteredRemaining = activeCategory === 'All' 
    ? remainingPlatforms 
    : remainingPlatforms.filter(p => (p as any).category === activeCategory);

  return (
    <div className={styles.readinessContainer}>
      {/* High-Contrast Live Indexing Counter Hero */}
      <div style={{ marginBottom: '48px', paddingBottom: '32px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className={styles.pageHeroTitle} style={{ textAlign: 'left', marginBottom: '24px' }}>Neural Archive</h1>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ padding: '20px 32px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
             <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px' }}>Total Memories Indexed</span>
             <div style={{ fontSize: '42px', fontWeight: '900', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>
               {liveStatus ? liveStatus.memoriesIndexed.toLocaleString() : '---'}
             </div>
          </div>
          
          {liveStatus?.isSyncing && (
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', borderRadius: '99px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: '700', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
               <span className={styles.typingCursor} style={{ background: '#10b981', width: '10px', height: '10px', borderRadius: '50%' }}></span>
               Engine Active: Syncing {liveStatus.activeSyncs.length} stream(s)...
             </div>
          )}
        </div>
      </div>

      {/* The "First 60 Seconds" Onboarding Flow */}
      {platforms.filter(p => p.connected).length === 0 && (
        <div style={{ background: 'var(--bg-secondary)', padding: '48px', borderRadius: '24px', marginBottom: '48px', border: '2px solid var(--text-primary)', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '16px', color: 'var(--text-primary)' }}>Welcome to The EYES</h2>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
            Your neural archive is currently empty. To unleash the full power of your digital memory, connect your primary communication stream to begin the deep-sync process.
          </p>
          <button 
            onClick={() => { window.location.href = '/api/connect/google/start?platform=gmail'; }}
            style={{ padding: '16px 32px', fontSize: '16px', fontWeight: '800', background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'transform 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Connect Google (Gmail & Calendar)
          </button>
        </div>
      )}

      {/* Discovery Hub Layout */}
      <div className={styles.readinessSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
          <h3 className={styles.subHeader} style={{ marginBottom: 0 }}>● BROWSE CONNECTORS ({filteredRemaining.length})</h3>
          
          <div className={styles.filterBar} style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            {categories.map(cat => (
              <button 
                key={cat}
                className={`${styles.filterChip} ${activeCategory === cat ? styles.filterChipActive : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.readinessGrid}>
          {filteredRemaining.map(p => {
             const isLive = ['gmail', 'google-calendar', 'notion', 'slack', 'github', 'discord'].includes(p.id);

             const startAuth = () => {
               if (!isLive) {
                 alert(`The ${p.name} integration is currently in closed beta. Please check back soon!`);
                 return;
               }

               let startUrl = `/api/connect/${p.id}/start`;
               if (p.id === 'gmail' || p.id === 'google-calendar') {
                 startUrl = `/api/connect/google/start?platform=${p.id}`;
               }
               window.location.href = startUrl;
             };

             return (
              <div key={p.id} className={styles.readinessCard} onClick={startAuth} style={!isLive ? { cursor: 'pointer' } : {}}>
                <div className={styles.cardHeader}>
                  <div 
                    className={styles.readinessIcon} 
                    style={{ 
                      backgroundColor: (p as any).color?.startsWith('#') ? `${(p as any).color}15` : 'var(--bg-secondary)',
                      border: (p as any).color?.startsWith('#') ? `1px solid ${(p as any).color}30` : '1px solid var(--border-subtle)'
                    }}
                  >
                    {p.icon ? React.cloneElement(p.icon as React.ReactElement<any>, { size: 24 }) : null}
                  </div>
                  <div className={styles.readinessInfo}>
                    <strong>{p.name}</strong>
                    <span className={styles.availStatusText}>{isLive ? 'Connect Now' : 'Coming Soon'}</span>
                  </div>
                  {isLive && <span className={styles.addIndicator}>+</span>}
                </div>
                <p className={styles.platformDesc}>{(p as any).description || 'Integrate this platform to expand your neural knowledge base.'}</p>
              </div>
             );
          })}
        </div>

      </div>
    </div>
  );
}
