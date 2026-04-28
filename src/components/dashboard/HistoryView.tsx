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
  messages: any[];
}

export function HistoryView({ onBack, onLoadThread }: { onBack: () => void, onLoadThread: (msgs: any[]) => void }) {
  const [history, setHistory] = useState<SavedThread[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('eyes_chat_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear all chat history?")) {
      localStorage.removeItem('eyes_chat_history');
      setHistory([]);
    }
  };

  return (
    <div className={styles.soloView}>


      <div className={styles.viewHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className={styles.soloTitle} style={{ margin: 0 }}>History</h1>
        {history.length > 0 && (
          <button 
            onClick={handleClear}
            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            Clear History
          </button>
        )}
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
          {history.length === 0 && (
            <p style={{ color: 'var(--text-secondary)' }}>No chat history found.</p>
          )}
          {history.map((thread) => (
            <div key={thread.id} className={styles.threadCard} onClick={() => onLoadThread(thread.messages)} style={{ cursor: 'pointer' }}>
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
