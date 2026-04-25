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
  
  const remainingPlatforms = ALL_POSSIBLE_PLATFORMS.filter(p => !platforms.find(ap => ap.id === p.id)?.connected);
  const categories = ['All', 'Productivity', 'Development', 'Social', 'Creative', 'Health'];

  const filteredRemaining = activeCategory === 'All' 
    ? remainingPlatforms 
    : remainingPlatforms.filter(p => (p as any).category === activeCategory);

  return (
    <div className={styles.readinessContainer}>
      {/* Intro Block - Marketplace Style */}
      <h1 className={styles.pageHeroTitle}>Expand your Neural Network</h1>
      <p className={styles.pageHeroSub}>Explore and integrate new data streams into your digital memory. Every connection expands the context and intelligence of The EYES.</p>

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
             const startAuth = () => {
               let startUrl = `/api/connect/${p.id}/start`;
               if (p.id === 'gmail' || p.id === 'google-calendar') {
                 startUrl = `/api/connect/google/start?platform=${p.id}`;
               }
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
                    <span className={styles.availStatusText}>Connect Now</span>
                  </div>
                  <span className={styles.addIndicator}>+</span>
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
