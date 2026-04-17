'use client';

import React from 'react';
import styles from '../MainContent.module.css';
import { SearchIcon, ArrowRightIcon, ShieldIcon } from '../common/icons/PlatformIcons';
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
}

export function SynthesisView({
  query,
  setQuery,
  messages,
  isStreaming,
  onSubmit,
  messagesEndRef,
  setView,
  totalMemories
}: SynthesisViewProps) {

  return (
    <div className={styles.heroLayout}>
      <div className={styles.heroContent}>
        <h1 className={`${styles.megaTitle} pulse-subtle`}>EYES</h1>
        <div className={styles.heroSummary}>
          <div className={styles.shieldIcon}><ShieldIcon /></div>
          <span>I&apos;ve indexed <strong>{totalMemories.toLocaleString()}</strong> things you&apos;ve said since 2018.</span>
        </div>

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
                       aria-label="Send memory query"
                       title="Send memory query"
            >
              <ArrowRightIcon />
            </button>
          </div>
        </div>
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
                      <div key={c.sourceId} className={styles.citationChip} title={c.snippet}>
                        <span className={styles.sourceId}>[{c.sourceId}]</span>
                        <span className={styles.sourcePlatform}>{c.platform}</span>
                        {c.title && <span className={styles.sourceTitle}>- {c.title.slice(0, 20)}...</span>}
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

