'use client';

import React from 'react';
import styles from '../MainContent.module.css';
import { ALL_POSSIBLE_PLATFORMS } from '@/config/platforms';
import type { FeedItem, PlatformStatus } from '@/types/dashboard';

interface MemoryFeedViewProps {
  onBack: () => void;
  feedEvents: FeedItem[];
  platforms: PlatformStatus[];
  filterPlatform: string;
  setFilterPlatform: (id: string) => void;
}

export function MemoryFeedView({ 
  onBack, 
  feedEvents, 
  platforms, 
  filterPlatform, 
  setFilterPlatform 
}: MemoryFeedViewProps) {
  return (
    <div className={styles.soloView}>
       <div className={styles.viewHeader}>
          <div className={styles.headerTop}>
             <button className={styles.backBtn} onClick={onBack}>← Back</button>
             <h1 className={styles.soloTitle}>MEMORY FEED</h1>
          </div>
          
          <div className={styles.filterBar}>
             <button 
               className={`${styles.filterChip} ${filterPlatform === 'all' ? styles.filterChipActive : ''}`}
               onClick={() => setFilterPlatform('all')}
             >
                All Activities
             </button>
             {platforms.filter(p => p.connected).map(p => (
                <button 
                  key={p.id}
                  className={`${styles.filterChip} ${filterPlatform === p.id ? styles.filterChipActive : ''}`}
                  onClick={() => setFilterPlatform(p.id)}
                >
                   {p.name}
                </button>
             ))}
          </div>
       </div>
       
       <div className={styles.feedScrollArea}>
          {feedEvents
            .filter(e => filterPlatform === 'all' || e.platform.toLowerCase() === filterPlatform.toLowerCase())
            .map((e) => {
            const platform = ALL_POSSIBLE_PLATFORMS.find(p => p.id === e.platform.toLowerCase());
            const hasRisk = e.is_flagged || e.flag_severity;
            
            return (
              <div key={e.id} className={`${styles.feedEventCard} ${hasRisk ? styles.cardHasRisk : ''}`}>
                 <div className={styles.eventIconWrapper}>
                    {platform?.icon ? React.cloneElement(platform.icon as React.ReactElement, { size: 18 }) : <div className={styles.fallbackIcon}>{e.platform[0]}</div>}
                 </div>
                 <div className={styles.eventMain}>
                    <div className={styles.eventMeta}>
                       <div className={styles.metaLeft}>
                         <span className={styles.platformBadge}>{e.platform}</span>
                         <span className={styles.eventTime}>{e.timestamp ? new Date(e.timestamp).toLocaleDateString() : 'Recent'}</span>
                       </div>
                       {hasRisk && (
                         <span className={`${styles.riskTag} ${styles['risk' + (e.flag_severity || 'LOW')]}`}>
                           {e.flag_severity || 'FLAGGED'}
                         </span>
                       )}
                    </div>
                    <h3 className={styles.eventTitle}>{e.title || 'Indexed Discovery'}</h3>
                    <p className={styles.eventBody}>{e.content}</p>
                    {e.flag_reason && (
                      <div className={styles.riskReasonOuter}>
                        <span className={styles.riskReasonLabel}>Reputation Signal:</span>
                        <span className={styles.riskReasonText}>{e.flag_reason}</span>
                      </div>
                    )}
                    <div className={styles.eventFooter}>
                       <span className={styles.categoryTag}>MEMORY INDEX</span>
                       <span className={styles.typeTag}>{e.event_type || 'Event'}</span>
                    </div>
                 </div>
              </div>
            );
          })}
          {feedEvents.length === 0 && (
            <div className={styles.emptyFeed}>
               <div className={styles.emptyIcon}>∅</div>
               <p>The neural index is currently empty. Connect a platform to begin ingestion.</p>
            </div>
          )}
       </div>
    </div>
  );
}

