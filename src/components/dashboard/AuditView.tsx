'use client';

import React from 'react';
import styles from '../MainContent.module.css';
import type { AuditSummary } from '@/types/dashboard';
import { ShieldIcon } from '../common/icons/PlatformIcons';

interface AuditViewProps {
  onBack: () => void;
  summary: AuditSummary;
}

export function AuditView({ onBack, summary }: AuditViewProps) {
  const [items, setItems] = React.useState(summary.flaggedItems);
  
  // Calculate a "Health Score" based on risk density
  const totalRisks = summary.riskCounts.heavy * 3 + summary.riskCounts.direct;
  const healthScore = Math.max(0, 100 - Math.floor((totalRisks / (summary.totalMemories || 1)) * 500));

  const handleRemediate = async (id: string) => {
    try {
      const response = await fetch('/api/audit/remediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('Failed to remediate:', err);
    }
  };

  const handleExport = () => {
    const csvRows = [
      ['ID', 'Severity', 'Platform', 'Date', 'Risk Detected', 'Content Snippet']
    ];
    
    items.forEach(item => {
      csvRows.push([
        item.id || '',
        item.severity,
        item.platform,
        new Date(item.date).toISOString(),
        item.reason ? item.reason.replace(/"/g, '""') : '',
        (item.snippet || item.content || '').replace(/"/g, '""').replace(/\n/g, ' ')
      ]);
    });

    const csvContent = csvRows.map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `neural-audit-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.soloView}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <h1 className={styles.soloTitle}>NEURAL REPUTATION AUDIT</h1>
        
        <div className={styles.auditGrid}>
           <div className={styles.auditSidebar}>
              <div className={styles.radarCard}>
                 <div className={styles.radarScanner} />
                 <div className={styles.radarCircles} />
                 <div className={styles.gaugeContainer}>
                    <svg width="200" height="200" viewBox="0 0 100 100">
                       <circle 
                         cx="50" cy="50" r="45" 
                         fill="none" 
                         stroke="var(--bg-secondary)" 
                         strokeWidth="8" 
                       />
                       <circle 
                         cx="50" cy="50" r="45" 
                         fill="none" 
                         stroke="var(--accent-primary)" 
                         strokeWidth="8" 
                         strokeDasharray={2 * Math.PI * 45}
                         strokeDashoffset={2 * Math.PI * 45 * (1 - healthScore / 100)}
                         strokeLinecap="round"
                         style={{ transition: 'stroke-dashoffset 2s ease-out' }}
                       />
                    </svg>
                    <div className={styles.gaugeValue}>{healthScore}</div>
                    <div className={styles.gaugeLabel}>HEALTH SCORE</div>
                 </div>
              </div>

              <div className={styles.riskMeterPanel}>
                 <div className={styles.meterItem}>
                    <div className={styles.meterInfo}><span>HEAVY EXPOSURE</span><span className={styles.meterValue}>{summary.riskCounts.heavy}</span></div>
                    <div className={styles.meterBar}><div className={styles.meterFillRed} style={{ width: `${(summary.riskCounts.heavy / (summary.totalMemories || 1)) * 100}%` }} /></div>
                    <div className={styles.meterDesc}>Leaked PII, credentials, or dangerous data.</div>
                 </div>
                 <div className={styles.meterItem}>
                    <div className={styles.meterInfo}><span>DIRECT EXPOSURE</span><span className={styles.meterValue}>{summary.riskCounts.direct}</span></div>
                    <div className={styles.meterBar}><div className={styles.meterFillYellow} style={{ width: `${(summary.riskCounts.direct / (summary.totalMemories || 1)) * 100}%` }} /></div>
                    <div className={styles.meterDesc}>Aggressive or controversial communications.</div>
                 </div>
                 <div className={styles.meterItem}>
                    <div className={styles.meterInfo}><span>LIGHT EXPOSURE</span><span className={styles.meterValue}>{summary.riskCounts.light}</span></div>
                    <div className={styles.meterBar}><div className={styles.meterFillGreen} style={{ width: `${(summary.riskCounts.light / (summary.totalMemories || 1)) * 100}%` }} /></div>
                    <div className={styles.meterDesc}>Sensitive personal or employer information.</div>
                 </div>
              </div>
           </div>

           <div className={styles.flaggedSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                 <h2 className={styles.sectionHeader} style={{ marginBottom: 0 }}>PRIORITY REMEDIATION QUEUE ({items.length})</h2>
                 <button 
                   onClick={handleExport}
                   style={{ 
                     background: 'transparent', 
                     border: '1px solid var(--border-primary)', 
                     color: 'var(--text-secondary)', 
                     padding: '8px 16px', 
                     borderRadius: '8px', 
                     cursor: 'pointer', 
                     fontSize: '12px', 
                     fontWeight: 600,
                     letterSpacing: '1px'
                   }}
                 >
                   EXPORT TO CSV
                 </button>
              </div>
              <div className={styles.flaggedList}>
                  {items.map((item, idx) => (
                     <div key={item.id || idx} className={styles.flaggedCard}>
                        <div className={styles.flaggedMain}>
                           <div className={styles.flaggedHeader}>
                              <span className={styles.flaggedPlatform}>{item.platform.toUpperCase()}</span>
                              <span className={styles.flaggedDate}>{new Date(item.date).toLocaleDateString()}</span>
                           </div>
                           <p className={styles.flaggedContent}>&quot;{item.snippet || item.content}&quot;</p>
                           <div className={styles.flaggedReason}>RISK DETECTED: {item.reason}</div>
                        </div>
                        <div className={styles.flaggedAction}>
                           <button 
                             className={styles.remediateBtn}
                             onClick={() => handleRemediate(item.id)}
                           >
                             RESOLVE
                           </button>
                        </div>
                     </div>
                  ))}
                  {items.length === 0 && (
                    <div className={styles.auditCleanState}>
                       <ShieldIcon />
                       <span>Neural integrity is 100%. No risks detected.</span>
                    </div>
                 )}
              </div>
           </div>
        </div>
    </div>
  );
}

