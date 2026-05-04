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
      }, 5000);
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
          <div className={styles.actionSection}>
            <p className={styles.requirementText}>Requires active neural link with Gmail, Reddit, or LinkedIn.</p>
            <button 
              className={styles.downloadBtn} 
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

  // SCANNING / FAILED STATE
  if (activeAudit.status !== 'completed') {
    const isFailed = activeAudit.status === 'failed';

    return (
      <div className={styles.auditContainer}>
        <div className={styles.scanningContainer}>
          {isFailed ? (
            <div className={styles.errorIcon}>⚠️</div>
          ) : (
            <div className={styles.neuralPulse} />
          )}
          <div className={styles.scanningText}>
            {isFailed ? 'AUDIT FAILED' : 
             activeAudit.status === 'pending' ? 'WAITING FOR QUEUE...' :
             activeAudit.status === 'analysis' ? 'ANALYZING NEURAL TRACE...' :
             'COMPILING REPORT...'}
          </div>
          {isFailed ? (
            <div className={styles.errorDescription}>
              <p>
                The neural link was interrupted during analysis. This may be due to an API service interruption or connectivity issues.
              </p>
              <button 
                className={styles.downloadBtn} 
                onClick={handleStartAudit}
                disabled={isInitiating}
              >
                {isInitiating ? 'INITIATING...' : 'RE-TRY AUDIT'}
              </button>
            </div>
          ) : (
            <p className={styles.waitText}>This typically takes under 60 seconds.</p>
          )}
        </div>
      </div>
    );
  }

  // COMPLETED PREVIEW
  return (
    <div className={styles.auditContainer}>
      <header className={styles.auditHeader}>
        <div>
          <div className={styles.wordmark}>EYES</div>
          <h1 className={styles.auditTitle}>Audit Certificate</h1>
          <div className={styles.auditMeta}>
            ID: {activeAudit.id.slice(0, 8).toUpperCase()} | {new Date(activeAudit.createdAt).toUTCString()}
          </div>
        </div>
        <div className={styles.headerRight}>
          <button 
            className={styles.rerunBtn} 
            onClick={handleStartAudit}
            disabled={isInitiating}
          >
            {isInitiating ? 'INITIATING...' : 'RE-RUN AUDIT'}
          </button>
          <div className={styles.confidentialMark}>CONFIDENTIAL</div>
          <div className={styles.propertyMark}>Property of Subject</div>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.mainContent}>
          <section className={styles.summaryBox}>
            <h2 className={styles.sectionHeading}>Executive Summary</h2>
            <p className={styles.narrative}>
              {activeAudit.summaryNarrative || 'No summary generated.'}
            </p>

            <div className={styles.metricsRow}>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{activeAudit.mentionsCount || 0}</span>
                <span className={styles.metricLabel}>Mentions Discovered</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{((activeAudit.metadata?.sentimentBalance || 0) * 100).toFixed(0)}%</span>
                <span className={styles.metricLabel}>Sentiment Balance</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{activeAudit.commitmentsCount || 0}</span>
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
             <h2 className={styles.sectionHeading}>Methodology</h2>
             <p className={styles.methodologyText}>
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
            <p className={styles.downloadHint}>
              The live preview reveals summary signals only. Full citations, raw quotes, and platform breakdowns are contained in the official PDF report.
            </p>
            <button 
              className={styles.downloadBtn}
              onClick={() => {
                // In demo mode, we use window.print() to generate a professional PDF of the certificate instantly.
                window.print();
              }}
              disabled={activeAudit.status === 'generating'}
            >
              DOWNLOAD FULL REPORT
            </button>
          </div>
          
          <div className={styles.legalNotice}>
            This certificate is bound to the identifier above and is non-transferable.
          </div>
        </aside>
      </div>
    </div>
  );
}
