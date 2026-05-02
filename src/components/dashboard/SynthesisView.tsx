'use client';

import React from 'react';
import styles from '../MainContent.module.css';
import { 
  SearchIcon, 
  ArrowRightIcon, 
  ShieldIcon 
} from '../common/icons/PlatformIcons';
import { ALL_POSSIBLE_PLATFORMS } from '@/config/platforms';
import type { Message } from '@/types/dashboard';

interface SynthesisViewProps {
  query: string;
  setQuery: (q: string) => void;
  messages: Message[];
  isStreaming: boolean;
  onSubmit: (text: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  setView: (v: any) => void;
  totalMemories: number;
  platforms?: any[];
}

export function SynthesisView({
  query,
  setQuery,
  messages,
  isStreaming,
  onSubmit,
  messagesEndRef,
  setView,
  totalMemories,
  platforms = []
}: SynthesisViewProps) {

  const connected = platforms.filter(p => p.isConnected);
  const [digest, setDigest] = React.useState<string[] | null>(null);
  const [loadingDigest, setLoadingDigest] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/actions/digest')
      .then(res => res.json())
      .then(data => {
        if (data.digest) setDigest(data.digest);
        setLoadingDigest(false);
      })
      .catch(() => setLoadingDigest(false));
  }, []);

  return (
    <div className={styles.heroLayout}>
      <div className={styles.heroContent}>
        {/* Exact Logo from Screenshot */}
        <h1 className={styles.brandDisplayTitle}>The EYES</h1>
        
        <div className={styles.heroSummary}>
          <div className={styles.shieldIcon}><ShieldIcon /></div>
          <span>Indexed <strong>{totalMemories.toLocaleString()}</strong> records across your connected sources.</span>
        </div>

        {loadingDigest ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div className={styles.radarScanner} style={{ width: 16, height: 16, border: '1px solid var(--accent-primary)' }} /> Generating Morning Digest...
          </div>
        ) : digest && digest.length > 0 ? (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '16px', margin: '24px auto', maxWidth: '600px', textAlign: 'left' }}>
             <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <span style={{ color: 'var(--accent-primary)' }}>✦</span> MORNING DIGEST
             </h3>
             <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '8px' }}>
               {digest.map((bullet, idx) => (
                 <li key={idx}>{bullet}</li>
               ))}
             </ul>
          </div>
        ) : null}

        <div className={styles.commandContainer}>
          <div className={styles.commandInputBox}>
            <div className={styles.searchIcon}><SearchIcon /></div>
            <input 
              type="text" 
              className={styles.commandInput}
              placeholder="Search digital memories..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSubmit(query)}
              disabled={isStreaming}
            />
            <button 
              className={styles.commandSendBtn} 
              onClick={() => onSubmit(query)}
              disabled={!query.trim() || isStreaming}
              aria-label="Send query"
            >
              <ArrowRightIcon />
            </button>
          </div>
        </div>

        {/* Dynamic Connected Pills */}
        {connected.length > 0 && (
          <div className={styles.connectedRow}>
            <span className={styles.connectedLabel}>CONNECTED</span>
            <div className={styles.connectedPills}>
              {connected.map(p => {
                const config = ALL_POSSIBLE_PLATFORMS.find(ap => ap.id === p.id);
                // Simple heuristic: if sync_progress is 100, we assume it's healthy, else it might be degraded/syncing
                const isHealthy = p.sync_progress === 100;
                
                return (
                  <div key={p.id} className={styles.miniConnectionPill} onClick={() => setView('readiness')} style={{ cursor: 'pointer' }} title={isHealthy ? 'Connection Healthy' : 'Action Required / Syncing'}>
                    <div className={`${styles.statusDot} ${isHealthy ? styles.statusDotHealthy : styles.statusDotDegraded}`} />
                    {config?.icon ? React.cloneElement(config.icon as React.ReactElement<any>, { size: 16 }) : null}
                    <span style={{ textTransform: 'capitalize' }}>{p.id.replace('-', ' ')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {messages.length > 0 && (
        <div className={styles.chatOutput}>
           {messages.map((m, i) => (
             <div key={i} className={`${styles.chatMessage} ${m.role === 'user' ? styles.userMsg : styles.aiMsg}`}>
                <div className={styles.msgBody}>
                  {m.content}
                  {m.pending && <span className={styles.typingCursor}>▊</span>}
                </div>
                {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
                  <div className={styles.citationStrip}>
                    {m.citations.map((c) => (
                      <div key={c.sourceId} className={styles.citationCard} title="Source Reference">
                        <div className={styles.citationCardHeader}>
                          <span className={styles.citationCardId}>[{c.sourceId}]</span>
                          <span className={styles.citationCardPlatform}>{c.platform}</span>
                        </div>
                        {c.title && <div className={styles.citationCardTitle}>{c.title}</div>}
                        <div className={styles.citationCardBody}>"{c.snippet.length > 100 ? c.snippet.slice(0, 100) + '...' : c.snippet}"</div>
                      </div>
                    ))}
                  </div>
                )}

             </div>
           ))}
           <div ref={messagesEndRef} />
        </div>
      )}

      <div className={styles.quickActions}>
         <div className={styles.actionCard} onClick={() => setView('feed')}><span>Memory Feed</span></div>
         <div className={styles.actionCard} onClick={() => setView('timeline')}><span>Time Line</span></div>
         <div className={styles.actionCard} onClick={() => setView('audit')}><span>Audit</span></div>
      </div>
    </div>
  );
}
