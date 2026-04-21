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
  const availableCount = ALL_POSSIBLE_PLATFORMS.length - connectedCount;
  const connectedList = platforms.filter(p => p.connected);
  const remainingPlatforms = ALL_POSSIBLE_PLATFORMS.filter(p => !platforms.find(ap => ap.id === p.id)?.connected);

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
              <div key={p.id} className={`${styles.readinessCard} ${isSyncing ? styles.cardSyncing : ''} ${isError ? styles.cardError : ''}`} onClick={() => router.push(`/connect/${p.id}`)}>
                <div className={styles.cardHeader}>
                  <div className={styles.readinessIcon}>{config?.icon}</div>
                  <div className={styles.readinessInfo}>
                    <strong>{p.name}</strong>
                    <span className={isError ? styles.errorStatusText : (isSyncing ? styles.syncStatusText : styles.readyStatusText)}>
                      {isError ? 'Something went wrong' : (isSyncing ? 'Synchronizing...' : 'Connected and ready')}
                    </span>
                  </div>
                </div>
                <div className={styles.itemBadge}>{p.items || 0}</div>
                {isSyncing && <div className={styles.syncPulse} />}
              </div>
             );
          })}
        </div>
      </div>

      <div className={styles.readinessSection}>
        <h3 className={styles.subHeader}>● AVAILABLE CONNECTORS ({availableCount})</h3>
        <div className={styles.readinessGrid}>
          {remainingPlatforms.map(p => (
            <div key={p.id} className={styles.readinessCard} onClick={() => router.push(`/connect/${p.id}`)}>
              <div className={styles.readinessIcon}>{p.icon}</div>
              <div className={styles.readinessInfo}>
                <strong>{p.name}</strong>
                <span className={styles.availStatusText}>Connect now</span>
              </div>
              <span className={styles.addIndicator}>+</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
