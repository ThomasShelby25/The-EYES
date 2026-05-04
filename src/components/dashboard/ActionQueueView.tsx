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
       
       <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '16px', lineHeight: 1.6 }}>
            The Neural Engine continuously scans your incoming data stream for actionable events (meetings, PRs, high-priority tasks). 
            Approve an action below to allow The EYES to execute it autonomously.
          </p>

          {loading ? (
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', gap: '24px' }}>
                <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', color: 'var(--text-primary)', opacity: 0.8, animation: 'pulse 2s infinite ease-in-out' }}>
                  EYES
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>EXTRACTING ACTIONS FROM NEURAL INDEX...</span>
             </div>
          ) : actions.length === 0 ? (
             <div style={{ padding: '64px', textAlign: 'center', border: '1px dashed var(--border-subtle)', borderRadius: '16px' }}>
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '16px' }}>✨</span>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Inbox Zero</h3>
                <p style={{ color: 'var(--text-secondary)' }}>No pending automated actions required at this time.</p>
             </div>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {actions.map(action => {
                  const platformObj = ALL_POSSIBLE_PLATFORMS.find(p => p.id === action.platform.toLowerCase());
                  const isProcessing = processingId === action.id;

                  return (
                    <div key={action.id} style={{ 
                      background: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-primary)', 
                      borderRadius: '16px', 
                      padding: '24px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                       {isProcessing && (
                         <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                           <span style={{ color: 'var(--accent-green)', fontWeight: 800, letterSpacing: '2px' }}>EXECUTING ACTION...</span>
                         </div>
                       )}

                       <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                             {platformObj?.icon ? React.cloneElement(platformObj.icon as any, { size: 24 }) : <span>{action.platform[0]?.toUpperCase()}</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>{action.title}</h3>
                                <span style={{ background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '1px' }}>
                                   {action.confidence}% CONFIDENCE
                                </span>
                             </div>
                             <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 16px 0' }}>{action.description}</p>
                             
                             <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--accent-green)', marginBottom: '24px' }}>
                                <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: '4px', letterSpacing: '1px' }}>PROPOSED ACTION</span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{action.suggestedAction}</span>
                             </div>

                             <div style={{ display: 'flex', gap: '12px' }}>
                                <button 
                                  onClick={() => handleApprove(action)}
                                  style={{ 
                                    background: 'var(--text-primary)', color: 'var(--bg-primary)', 
                                    border: 'none', padding: '10px 24px', borderRadius: '8px', 
                                    fontWeight: 700, cursor: 'pointer' 
                                  }}
                                >
                                  Approve & Execute
                                </button>
                                <button 
                                  onClick={() => handleDismiss(action.id)}
                                  style={{ 
                                    background: 'transparent', color: 'var(--text-secondary)', 
                                    border: '1px solid var(--border-subtle)', padding: '10px 24px', 
                                    borderRadius: '8px', fontWeight: 600, cursor: 'pointer' 
                                  }}
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
