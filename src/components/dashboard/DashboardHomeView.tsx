'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import styles from '../MainContent.module.css';
import { ALL_POSSIBLE_PLATFORMS } from '@/config/platforms';
import type { PlatformStatus } from '@/types/dashboard';

interface DashboardHomeViewProps {
  platforms: PlatformStatus[];
}

export function DashboardHomeView({ platforms }: DashboardHomeViewProps) {
  const router = useRouter();
  const connectedCount = platforms.filter(p => p.connected).length;
  const remainingPlatforms = ALL_POSSIBLE_PLATFORMS.filter(p => !platforms.find(ap => ap.id === p.id)?.connected);

  return (
    <div className={styles.readinessContainer}>
      <button className={styles.backBtn} onClick={() => router.push('/?view=dashboard')}>← Back</button>

      <div className={styles.readinessSection}>
        <h2 className={styles.subHeader}>● NEURAL CORE BRIDGES ({platforms.filter(p => p.connected).length})</h2>
        <div className={styles.readinessGrid}>
          {platforms.filter(p => p.connected).map(p => {
             const isSyncing = p.status === 'syncing';
             const isError = p.status === 'error';
             const config = ALL_POSSIBLE_PLATFORMS.find(ap => ap.id === p.id);
             
             return (
              <div key={p.id} className={`${styles.readinessCard} ${isSyncing ? styles.cardSyncing : ''} ${isError ? styles.cardError : ''}`}>
                <div className={styles.cardHeader} onClick={() => router.push(`/connect/${p.id}`)}>
                  <div className={styles.readinessIcon}>{config?.icon}</div>
                  <div className={styles.readinessInfo}>
                    <strong>{p.name}</strong>
                    <span className={isError ? styles.errorStatusText : (isSyncing ? styles.syncStatusText : styles.readyStatusText)}>
                      {isError ? 'Neural Connection Fragmented' : (isSyncing ? 'Synchronizing Neural Path...' : 'Neural Matrix Optimized')}
                    </span>
                  </div>
                </div>
                <div className={styles.itemBadge}>{p.items > 999 ? `${(p.items/1000).toFixed(1)}k` : p.items}</div>
                {isSyncing && <div className={styles.syncPulse} />}
              </div>
             );
          })}
        </div>
      </div>

      <div className={styles.readinessSection}>
        <h2 className={styles.subHeader}>● PENDING NEURAL CONFIGURATION ({remainingPlatforms.length})</h2>
        <div className={styles.readinessGrid}>
          {remainingPlatforms.map(p => (
            <div key={p.id} className={styles.readinessCard} onClick={() => router.push(`/connect/${p.id}`)}>
              <div className={styles.readinessIcon}>{p.icon}</div>
              <div className={styles.readinessInfo}>
                <strong>{p.name}</strong>
                <span className={styles.availStatusText}>Ready for Discovery</span>
              </div>
              <span className={styles.addIndicator}>+</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

