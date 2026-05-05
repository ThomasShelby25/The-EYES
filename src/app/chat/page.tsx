'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import styles from './ChatPage.module.css';
import { 
  SearchIcon, 
  ArrowRightIcon
} from '@/components/common/icons/PlatformIcons';
import type { Message, PlatformStatus } from '@/types/dashboard';

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [threadId, setThreadId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeStreamRef = useRef<AbortController | null>(null);
  const hasSubmittedRef = useRef(false);

  // Initialize
  useEffect(() => {
    setThreadId(Math.random().toString(36).substring(7));
    
    // Load platforms for metadata
    fetch('/api/platform-readiness')
      .then(res => res.json())
      .then(data => {
        if (data.platforms) setPlatforms(data.platforms);
      })
      .catch(err => console.error('Failed to load platforms:', err));

    // If there's an initial query, trigger it (once)
    if (initialQuery && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;
      handleSubmit(initialQuery);
    }
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (text: string) => {
    const prompt = text.trim();
    if (!prompt) return;
    
    activeStreamRef.current?.abort();
    const controller = new AbortController();
    activeStreamRef.current = controller;
    
    setMessages((prev) => [...prev, { role: 'user', content: prompt }, { role: 'assistant', content: '', pending: true }]);
    setQuery('');
    setIsStreaming(true);

    try {
      const response = await fetch('/api/chat?stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ 
          message: prompt,
          history: messages.map(m => ({ role: m.role, content: m.content })) 
        }),
      });

      if (response.ok && response.body) {
        const citationsHeader = response.headers.get('X-Citations');
        let citations: any[] = [];
        if (citationsHeader) {
          try {
            citations = JSON.parse(atob(citationsHeader.replace(/-/g, '+').replace(/_/g, '/')));
          } catch (e) {
            console.warn('[Chat] Failed to parse citations header:', e);
          }
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedReply = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          streamedReply += chunk;
          
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last.role === 'assistant') {
              return [...prev.slice(0, -1), { 
                role: 'assistant', 
                content: streamedReply, 
                pending: true,
                citations: citations.length > 0 ? citations : undefined
              }];
            }
            return prev;
          });
        }
        
        setMessages((prev) => {
          return [...prev.slice(0, -1), { 
            role: 'assistant', 
            content: streamedReply, 
            pending: false,
            citations: citations.length > 0 ? citations : undefined
          }];
        });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Chat Stream Failed:', err);
      }
    } finally {
      setIsStreaming(false);
      activeStreamRef.current = null;
    }
  };

  return (
    <div className={styles.chatRoot}>
      <div className={styles.sidebarWrapper}>
        <Sidebar />
      </div>
      <div className={styles.mainWrapper}>
        <div className={styles.headerWrapper}>
          <Header />
        </div>
        
        <div className={styles.chatContentContainer}>
          <div className={styles.chatColumn}>
            {messages.length === 0 ? (
              <div className={styles.emptyState}>
                <h1 className={styles.brandTitle}>The EYES</h1>
                <p className={styles.brandSubtitle}>How can the neural index assist you today?</p>
              </div>
            ) : (
              <div className={styles.messageList}>
                {messages.map((m, i) => (
                  <div key={i} className={`${styles.messageRow} ${m.role === 'user' ? styles.userRow : styles.aiRow}`}>
                    <div className={styles.messageBubble}>
                      <div className={styles.msgBody}>
                        {m.content}
                        {m.pending && <span className={styles.typingCursor}>▊</span>}
                      </div>
                      
                      {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
                        <div className={styles.citationArea}>
                          <div className={styles.citationLabel}>SOURCES</div>
                          <div className={styles.citationGrid}>
                            {m.citations.map((c) => (
                              <div key={c.sourceId} className={styles.citationPill}>
                                <span className={styles.citeId}>[{c.sourceId}]</span>
                                <span className={styles.citePlatform}>{c.platform}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Floating Input Area */}
            <div className={styles.inputStickyContainer}>
              <div className={styles.inputBox}>
                <SearchIcon />
                <input 
                  type="text" 
                  className={styles.input}
                  placeholder="Continue the investigation..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit(query)}
                  disabled={isStreaming}
                />
                <button 
                  className={styles.sendBtn}
                  onClick={() => handleSubmit(query)}
                  disabled={!query.trim() || isStreaming}
                >
                  <ArrowRightIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="loading-screen">INITIALIZING LINK...</div>}>
      <ChatPageInner />
    </Suspense>
  );
}
