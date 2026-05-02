'use client';

import React, { useEffect, useState } from 'react';
import styles from './AuditView.module.css';
import type { ReputationAudit, AuditSummary } from '@/types/dashboard';

interface AuditViewProps {
  onBack: () => void;
  summary: AuditSummary; // Legacy summary for fallback or context
}

export function AuditView({ onBack }: AuditViewProps) {
  const [activeAudit, setActiveAudit] = useState<ReputationAudit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitiating, setIsInitiating] = useState(false);

  // Fetch the latest audit on mount
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await fetch('/api/audit-summary'); // We'll update this or use a new one
        // For now, let's assume we fetch the latest from reputation_audits table
        // But since we need the most recent one, I'll use a direct fetch
        const auditRes = await fetch('/api/audit/latest'); 
        if (auditRes.ok) {
          const data = await auditRes.json();
          setActiveAudit(data);
        }
      } catch (err) {
        console.error('Failed to fetch latest audit:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLatest();
  }, []);

  // Polling logic for running audits
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeAudit && (activeAudit.status === 'pending' || activeAudit.status === 'analysis' || activeAudit.status === 'generating')) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/audit/${activeAudit.id}`);
          if (res.ok) {
            const data = await res.json();
            setActiveAudit(data);
            if (data.status === 'completed' || data.status === 'failed') {
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error('Polling failed:', err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeAudit]);

  const handleStartAudit = async () => {
    setIsInitiating(true);
    try {
      const res = await fetch('/api/audit/create', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setActiveAudit({
          id: data.auditId,
          status: 'pending',
          riskScore: 0,
          mentionsCount: 0,
          commitmentsCount: 0,
          summaryNarrative: null,
          connectorsCovered: [],
          reportUrl: null,
          createdAt: new Date().toISOString(),
          metadata: {
            sentimentBalance: 0,
            unfulfilledCommitments: 0,
            commitments: [],
            opportunities: [],
            topEntities: [],
            riskFindings: []
          }
        });
      }
    } catch (err) {
      console.error('Initiation failed:', err);
    } finally {
      setIsInitiating(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.auditContainer}>
        <div className={styles.scanningContainer}>
          <div className={styles.neuralPulse} />
          <div className={styles.scanningText}>ESTABLISHING NEURAL LINK...</div>
        </div>
      </div>
    );
  }

  // START SCREEN
  if (!activeAudit) {
    return (
      <div className={styles.auditContainer}>
        <button onClick={onBack} style={{ marginBottom: '20px', cursor: 'pointer', background: 'none', border: 'none', color: '#1F4D3F', fontWeight: 700 }}>← BACK TO DASHBOARD</button>
        <div className={styles.auditHeader}>
          <div>
            <div className={styles.wordmark}>EYES</div>
            <h1 className={styles.auditTitle}>Audit</h1>
          </div>
        </div>
        
        <div className={styles.summaryBox} style={{ maxWidth: '800px', margin: '0 auto' }}>
          <p className={styles.narrative}>
            The Reputation Audit is a clinical intelligence report on your digital trace. 
            It analyzes your active connectors to detect unfulfilled commitments, 
            reputational risks, and operational opportunities.
          </p>
          <div style={{ borderTop: '1px solid #EEE', paddingTop: '30px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>Requires active neural link with Gmail, Reddit, or LinkedIn.</p>
            <button 
              className={styles.downloadBtn} 
              style={{ background: '#1F4D3F', color: 'white', maxWidth: '300px' }}
              onClick={handleStartAudit}
              disabled={isInitiating}
            >
              {isInitiating ? 'INITIATING...' : 'START PREMIUM AUDIT'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SCANNING STATE
  if (activeAudit.status !== 'completed' && activeAudit.status !== 'failed') {
    return (
      <div className={styles.auditContainer}>
        <div className={styles.scanningContainer}>
          <div className={styles.neuralPulse} />
          <div className={styles.scanningText}>
            {activeAudit.status === 'pending' && 'WAITING FOR QUEUE...'}
            {activeAudit.status === 'analysis' && 'ANALYZING NEURAL TRACE...'}
            {activeAudit.status === 'generating' && 'COMPILING REPORT...'}
          </div>
          <p style={{ opacity: 0.6, fontSize: '12px' }}>This typically takes under 60 seconds.</p>
        </div>
      </div>
    );
  }

  // COMPLETED PREVIEW
  return (
    <div className={styles.auditContainer}>
      <button onClick={onBack} style={{ marginBottom: '20px', cursor: 'pointer', background: 'none', border: 'none', color: '#1F4D3F', fontWeight: 700 }}>← BACK TO DASHBOARD</button>
      
      <header className={styles.auditHeader}>
        <div>
          <div className={styles.wordmark}>EYES</div>
          <h1 className={styles.auditTitle}>Audit Certificate</h1>
          <div className={styles.auditMeta}>
            ID: {activeAudit.id.slice(0, 8).toUpperCase()} | {new Date(activeAudit.createdAt).toUTCString()}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#8B2E2E', fontWeight: 700 }}>CONFIDENTIAL</div>
          <div style={{ fontSize: '11px', color: '#666' }}>Property of Subject</div>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.mainContent}>
          <section className={styles.summaryBox}>
            <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '20px', borderBottom: '1px solid #EEE', paddingBottom: '10px' }}>Executive Summary</h2>
            <p className={styles.narrative}>
              {activeAudit.summaryNarrative || 'No summary generated.'}
            </p>

            <div className={styles.metricsRow}>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{activeAudit.mentionsCount}</span>
                <span className={styles.metricLabel}>Mentions Discovered</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{(activeAudit.metadata.sentimentBalance * 100).toFixed(0)}%</span>
                <span className={styles.metricLabel}>Sentiment Balance</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{activeAudit.commitmentsCount}</span>
                <span className={styles.metricLabel}>Unfulfilled Commitments</span>
              </div>
            </div>

            {activeAudit.metadata.unfulfilledCommitments > 0 && (
              <div className={styles.findingTeaser}>
                ⚠️ HEADLINE FINDING: You have {activeAudit.metadata.unfulfilledCommitments} unfulfilled commitments referenced in active communications.
              </div>
            )}
          </section>

          <section className={styles.summaryBox}>
             <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '20px', borderBottom: '1px solid #EEE', paddingBottom: '10px' }}>Methodology</h2>
             <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.6 }}>
               Risk score = ((negative_mentions × 2) + (neutral_mentions × 0.5) + (unfulfilled_commitments × 3)) ÷ total_mentions × 10.
               Recency weighting: last 30 days (1.0), last 6 months (0.5), older (0.2).
             </p>
          </section>
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.riskScoreSection}>
            <div className={styles.riskNumber}>{activeAudit.riskScore}</div>
            <div className={styles.riskInfo}>
              <span className={styles.riskHeadline}>RISK SCORE</span>
              <span className={styles.riskInterpretation}>
                {activeAudit.riskScore > 7 ? 'Critical Exposure' : activeAudit.riskScore > 4 ? 'Moderate Risk' : 'Low Trace'}
              </span>
            </div>
          </div>

          <div className={styles.downloadSection}>
            <p style={{ fontSize: '13px', lineHeight: 1.5, opacity: 0.9 }}>
              The live preview reveals summary signals only. Full citations, raw quotes, and platform breakdowns are contained in the official PDF report.
            </p>
            <button 
              className={styles.downloadBtn}
              onClick={() => window.open(activeAudit.reportUrl || '#', '_blank')}
              disabled={!activeAudit.reportUrl}
            >
              DOWNLOAD FULL REPORT
            </button>
          </div>
          
          <div style={{ fontSize: '10px', color: '#888', fontStyle: 'italic' }}>
            This certificate is bound to the identifier above and is non-transferable.
          </div>
        </aside>
      </div>
    </div>
  );
}
