'use client';

import React, { useState, useEffect } from 'react';
import styles from '../MainContent.module.css';
import { ALL_POSSIBLE_PLATFORMS } from '@/config/platforms';

interface ActionItem {
  id: string;
  memoryId: string;
  platform: string;
  title: string;
  description: string;
  suggestedAction: string;
  actionType: string;
  confidence: number;
}

interface ActionQueueViewProps {
  onBack: () => void;
}

export function ActionQueueView({ onBack }: ActionQueueViewProps) {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchActions = async () => {
      try {
        const res = await fetch('/api/actions/extract');
        const data = await res.json();
        if (data.actions) {
          setActions(data.actions);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchActions();
  }, []);

  const handleApprove = async (action: ActionItem) => {
    setProcessingId(action.id);
    
    try {
      const response = await fetch('/api/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403) {
          alert(`Execution Blocked:\n\n${errorData.details}`);
        } else {
          alert('Failed to execute action.');
        }
      }
    } catch (e) {
      console.error(e);
      alert('Network error while executing action.');
    } finally {
      setActions((prev) => prev.filter(a => a.id !== action.id));
      setProcessingId(null);
    }
  };

  const handleDismiss = (id: string) => {
    setActions((prev) => prev.filter(a => a.id !== id));
  };

  return (
     <div className={styles.soloView}>
       <div className={styles.viewHeader}>
          <div className={styles.headerTop}>
             <h1 className={styles.soloTitle}>AUTONOMOUS ACTION QUEUE</h1>
          </div>
       </div>
       
       <div className={styles.actionQueueContainer}>
          <p className={styles.actionQueueDescription}>
            The Neural Engine continuously scans your incoming data stream for actionable events (meetings, PRs, high-priority tasks). 
            Approve an action below to allow The EYES to execute it autonomously.
          </p>

          {loading ? (
             <div className={styles.loadingState}>
                <div className={styles.loadingLogo}>
                   EYES
                </div>
                <span className={styles.loadingText}>EXTRACTING ACTIONS FROM NEURAL INDEX...</span>
             </div>
          ) : actions.length === 0 ? (
             <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>✨</span>
                <h3 className={styles.emptyTitle}>Inbox Zero</h3>
                <p className={styles.emptyDescription}>No pending automated actions required at this time.</p>
             </div>
          ) : (
             <div className={styles.actionQueueList}>
                {actions.map(action => {
                   const platformObj = ALL_POSSIBLE_PLATFORMS.find(p => p.id === action.platform.toLowerCase());
                   const isProcessing = processingId === action.id;

                   return (
                     <div key={action.id} className={styles.actionQueueCard}>
                        {isProcessing && (
                          <div className={styles.executionOverlay}>
                            <span>EXECUTING ACTION...</span>
                          </div>
                        )}

                        <div className={styles.actionCardMain}>
                           <div className={styles.actionIconBox}>
                              {platformObj?.icon ? React.cloneElement(platformObj.icon as any, { size: 28 }) : <span>{action.platform[0]?.toUpperCase()}</span>}
                           </div>
                           <div className={styles.actionContentBox}>
                              <div className={styles.actionTitleRow}>
                                 <h3 className={styles.actionTitle}>{action.title}</h3>
                                 <span className={styles.confidenceBadge}>
                                    {action.confidence}% CONFIDENCE
                                 </span>
                              </div>
                              <p className={styles.actionDescription}>{action.description}</p>
                              
                              <div className={styles.proposedActionBox}>
                                 <span className={styles.proposedLabel}>PROPOSED ACTION</span>
                                 <span className={styles.proposedText}>{action.suggestedAction}</span>
                              </div>

                              <div className={styles.actionButtons}>
                                 <button 
                                   onClick={() => handleApprove(action)}
                                   className={styles.approveBtn}
                                 >
                                   Approve & Execute
                                 </button>
                                 <button 
                                   onClick={() => handleDismiss(action.id)}
                                   className={styles.dismissBtn}
                                 >
                                   Dismiss
                                 </button>
                              </div>
                           </div>
                        </div>
                     </div>
                   );
                })}
             </div>
          )}
       </div>
    </div>
  );
}
