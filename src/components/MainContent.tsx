'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from './MainContent.module.css';
import type { AuditSummary, PlatformStatus, FeedItem, Message } from '@/types/dashboard';

// Modular View Components
import { DashboardHomeView } from './dashboard/DashboardHomeView';
import { MemoryFeedView } from './dashboard/MemoryFeedView';
import { TimelineView } from './dashboard/TimelineView';
import { AuditView } from './dashboard/AuditView';
import { SynthesisView } from './dashboard/SynthesisView';


type ViewMode = 'dashboard' | 'synthesis' | 'audit' | 'timeline' | 'feed' | 'readiness' | 'connectors';

function MainContentInner({ onLoaded }: { onLoaded?: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewParam = searchParams.get('view') as ViewMode | null;
  const activeView = viewParam || 'dashboard';

  const [summary, setSummary] = useState<AuditSummary>({ 
    totalMemories: 0, 
    overallRisk: 'LOW', 
    riskCounts: { high: 0, med: 0, low: 0 }, 
    flaggedItems: [], 
    comparisonData: [] 
  });
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [feedEvents, setFeedEvents] = useState<FeedItem[]>([]);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [, setIsLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeStreamRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [sumRes, platRes, feedRes] = await Promise.all([
          fetch('/api/audit-summary', { cache: 'no-store' }),
          fetch('/api/platform-readiness', { cache: 'no-store' }),
          fetch('/api/memory-feed', { cache: 'no-store' })
        ]);
        const sP = await sumRes.json();
        const pP = await platRes.json();
        const fP = await feedRes.json();

        if (sP?.totalMemories !== undefined) setSummary(sP);
        if (pP?.platforms) setPlatforms(pP.platforms);
        if (fP?.events) setFeedEvents(fP.events);
      } catch (err) { 
        console.error('Core Dashboard Load Failure:', err); 
      } finally { 
        setIsLoading(false);
        if (onLoaded) {
           setTimeout(onLoaded, 100);
        }
      }
    };

    load();

    // Real-time UI synchronization listener
    const handleRefresh = () => {
      console.log('[Dashboard] Real-time pulse detected. Refreshing neural state...');
      load();
    };

    window.addEventListener('eyes-realtime-refresh', handleRefresh);
    return () => window.removeEventListener('eyes-realtime-refresh', handleRefresh);
  }, [onLoaded]);

  // Handle Scroll to Bottom for Chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const setView = (v: string) => {
    router.push(`?view=${v}`, { scroll: false });
  };

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
        body: JSON.stringify({ message: prompt }),
      });

      if (response.ok && response.body) {
        const citationsHeader = response.headers.get('X-Citations');
        let citations: any[] = [];
        if (citationsHeader) {
          try {
            citations = JSON.parse(atob(citationsHeader.replace(/-/g, '+').replace(/_/g, '/')));
          } catch (e) {
            console.warn('[Dashboard] Failed to parse citations header:', e);
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
    <main className={styles.main}>
      {activeView === 'dashboard' && (
        <SynthesisView 
          query={query}
          setQuery={setQuery}
          messages={messages}
          isStreaming={isStreaming}

          onSubmit={handleSubmit}
          messagesEndRef={messagesEndRef}
          setView={setView}
          totalMemories={summary.totalMemories}
        />
      )}

      {activeView === 'feed' && (
        <MemoryFeedView 
          onBack={() => setView('dashboard')}
          feedEvents={feedEvents}
          platforms={platforms}
          filterPlatform={filterPlatform}
          setFilterPlatform={setFilterPlatform}
        />
      )}

      {activeView === 'timeline' && (
        <TimelineView onBack={() => setView('dashboard')} />
      )}

      {activeView === 'audit' && (
        <AuditView onBack={() => setView('dashboard')} summary={summary} />
      )}

      {(activeView === 'readiness' || activeView === 'connectors') && (
        <DashboardHomeView platforms={platforms} />
      )}
    </main>
  );
}

export default function MainContent(props: { onLoaded?: () => void }) { 
  return (
    <Suspense fallback={null}>
      <MainContentInner {...props} />
    </Suspense>
  ); 
}

