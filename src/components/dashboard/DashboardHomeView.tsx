'use client';

import React from 'react';
import styles from '../MainContent.module.css';
import { ALL_POSSIBLE_PLATFORMS } from '@/config/platforms';
import type { PlatformStatus } from '@/types/dashboard';

interface DashboardHomeViewProps {
  platforms: PlatformStatus[];
}

export function DashboardHomeView({ platforms }: DashboardHomeViewProps) {
  const connectedCount = platforms.filter(p => p.connected).length;
  const availableCount = ALL_POSSIBLE_PLATFORMS.length - connectedCount;
  const connectedList = platforms.filter(p => p.connected);
  const remainingPlatforms = ALL_POSSIBLE_PLATFORMS.filter(p => !platforms.find(ap => ap.id === p.id)?.connected);

  const handleDisconnect = async (platformId: string, platformName: string) => {
    if (!window.confirm(`Disconnect ${platformName} and remove its active tokens?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/data/platform/${platformId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disconnect: true }),
      });

      if (!response.ok) {
        throw new Error(`Failed to disconnect (${response.status})`);
      }

      // Trigger a global UI refresh
      window.dispatchEvent(new CustomEvent('eyes-realtime-refresh'));
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('Failed to disconnect platform.');
    }
  };

  return (
    <div className={styles.readinessContainer}>
      {/* Intro Block (from Screenshot) */}
      <h1 className={styles.pageHeroTitle}>Manage every connected platform from one hub.</h1>
      <p className={styles.pageHeroSub}>Review what is already connected, check readiness, and open the auth flow for any platform that is still missing.</p>

      {/* KPI Metric Grid */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>CONNECTED PLATFORMS</span>
          <span className={styles.kpiValue}>{connectedCount}</span>
          <span className={styles.kpiDesc}>Platforms ready for sync or already active.</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>AVAILABLE CONNECTORS</span>
          <span className={styles.kpiValue}>{availableCount}</span>
          <span className={styles.kpiDesc}>Platforms you can connect next.</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardFocus}`}>
          <span className={styles.kpiLabel}>FOCUS</span>
          <span className={styles.kpiValue}>Direct connect</span>
          <span className={styles.kpiDesc}>New connectors start OAuth immediately from this page.</span>
        </div>
      </div>

      <div className={styles.readinessSection}>
        <h3 className={styles.subHeader}>● CONNECTED PLATFORMS ({connectedCount})</h3>
        <div className={styles.readinessGrid}>
          {connectedList.map(p => {
             const isSyncing = p.status === 'syncing';
             const isError = p.status === 'error';
             const config = ALL_POSSIBLE_PLATFORMS.find(ap => ap.id === p.id);
             
             return (
              <div key={p.id} className={`${styles.readinessCard} ${styles.connectedCard} ${isSyncing ? styles.cardSyncing : ''} ${isError ? styles.cardError : ''}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.readinessIcon}>
                    {config?.icon ? React.cloneElement(config.icon as React.ReactElement<any>, { size: 20 }) : null}
                  </div>
                  <div className={styles.readinessInfo}>
                    <strong>{p.name}</strong>
                    <span className={isError ? styles.errorStatusText : (isSyncing ? styles.syncStatusText : styles.readyStatusText)}>
                      {isError ? 'Something went wrong' : (isSyncing ? 'Synchronizing...' : 'Connected and ready')}
                    </span>
                  </div>
                </div>
                <div className={styles.cardActions}>
                   <div className={styles.itemBadge}>{p.items || 0} items</div>
                   <button 
                     className={styles.inlineDisconnectBtn} 
                     onClick={(e) => { e.stopPropagation(); handleDisconnect(p.id, p.name); }}
                   >
                     Disconnect
                   </button>
                </div>
                {isSyncing && <div className={styles.syncPulse} />}
              </div>
             );
          })}
        </div>
      </div>

      <div className={styles.readinessSection}>
        <h3 className={styles.subHeader}>● AVAILABLE CONNECTORS ({availableCount})</h3>
        <div className={styles.readinessGrid}>
          {remainingPlatforms.map(p => {
             const startAuth = () => {
               // Map IDs to their respective API start routes
               let startUrl = `/api/connect/${p.id}/start`;
               if (p.id === 'gmail' || p.id === 'google-calendar') {
                 startUrl = `/api/connect/google/start?platform=${p.id}`;
               }
               
               // Direct browser redirect to kick off OAuth
               window.location.href = startUrl;
             };

             return (
              <div key={p.id} className={styles.readinessCard} onClick={startAuth}>
                <div className={styles.cardHeader}>
                  <div className={styles.readinessIcon}>
                    {p.icon ? React.cloneElement(p.icon as React.ReactElement<any>, { size: 24 }) : null}
                  </div>
                  <div className={styles.readinessInfo}>
                    <strong>{p.name}</strong>
                    <span className={styles.availStatusText}>Connect now</span>
                  </div>
                  <span className={styles.addIndicator}>+</span>
                </div>
                <p className={styles.platformDesc}>{(p as any).description}</p>
              </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}
