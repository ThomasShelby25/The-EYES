'use client';

import React, { useState, useEffect } from 'react';
import styles from '../MainContent.module.css';

interface SavedThread {
  id: string;
  title: string;
  timestamp: string;
  turns: number;
  snippet?: string;
  assistantReplied?: string;
}

export function HistoryView({ onBack }: { onBack: () => void }) {
  const [history, setHistory] = useState<SavedThread[]>([]);

  // Simulate loading from local history or API
  useEffect(() => {
    // Mocking the specific data from your screenshot for the 'Exact UI' look
    setHistory([
      {
        id: '1',
        title: "DZGXFCHGVJHKJLK;L';",
        timestamp: '4/20/2026, 6:14:46 PM',
        turns: 2,
        snippet: "what you know about me according recent github data",
        assistantReplied: "[AI UNAVAILABLE] ANTHROPIC_API_KEY not configured."
      }
    ]);
  }, []);

  return (
    <div className={styles.soloView}>


      <div className={styles.viewHeader}>
        <h1 className={styles.soloTitle}>History</h1>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.miniStatCard}>
          <span className={styles.statLabel}>CONVERSATIONS</span>
          <span className={styles.statValue}>{history.length}</span>
          <span className={styles.statDesc}>Total saved memory search threads.</span>
        </div>
        <div className={styles.miniStatCard}>
          <span className={styles.statLabel}>CHAT TURNS</span>
          <span className={styles.statValue}>{history.reduce((a, b) => a + b.turns, 0)}</span>
          <span className={styles.statDesc}>Question and answer pairs across all saved chats.</span>
        </div>
      </div>

      <div className={styles.historyPanel}>
        <h3 className={styles.subHeader}>SAVED CHATS</h3>
        <p className={styles.sectionDesc}>All questions and assistant responses from memory search.</p>

        <div className={styles.threadList}>
          {history.map((thread) => (
            <div key={thread.id} className={styles.threadCard} onClick={() => onBack()} style={{ cursor: 'pointer' }}>
              <div className={styles.threadHeader}>
                <h4 className={styles.threadTitle}>{thread.title}</h4>
                <span className={styles.turnBadge}>{thread.turns} turns</span>
              </div>
              <div className={styles.threadMeta}>Updated {thread.timestamp}</div>
              
              <div className={styles.threadPreview}>
                <div className={styles.previewStep}>
                  <span className={styles.roleLabel}>YOU ASKED</span>
                  <p className={styles.previewText}>{thread.snippet || thread.title}</p>
                </div>
                {thread.assistantReplied && (
                   <div className={styles.previewStep}>
                    <span className={styles.roleLabel}>ASSISTANT REPLIED</span>
                    <p className={`${styles.previewText} ${thread.assistantReplied.includes('UNAVAILABLE') ? styles.errorText : ''}`}>
                      {thread.assistantReplied}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
