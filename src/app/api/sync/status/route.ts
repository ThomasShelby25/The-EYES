import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';

type SyncRunLogRow = {
  run_id: string;
  platform: string;
  status: 'success' | 'error' | 'skipped';
  duration_ms: number;
  error_message: string | null;
  created_at: string;
};

type SyncStatusRow = {
  platform: string;
  status: string | null;
  last_sync_at: string | null;
  error_message: string | null;
  sync_progress: number | null;
  total_items: number | null;
};

type RetryQueueRow = {
  platform: string;
  retry_attempt: number;
  next_attempt_at: string;
};

type RetryDeadLetterRow = {
  platform: string;
  retry_attempt: number;
  created_at: string;
  failure_reason: 'max_attempts_exceeded' | 'non_retriable_status';
};

type SyncEscalationRow = {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'resolved';
  owner: string;
  message: string;
  trigger_count: number;
  last_triggered_at: string;
  resolved_at: string | null;
  last_dispatched_at: string | null;
  dispatch_count: number;
  last_observed: number;
  threshold: number;
};

type SchedulerEscalation = {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'resolved';
  owner: string;
  message: string;
  triggerCount: number;
  lastTriggeredAt: string;
  resolvedAt: string | null;
  lastDispatchedAt: string | null;
  dispatchCount: number;
  observed: number;
  threshold: number;
};

type SchedulerAlertSeverity = 'info' | 'warning' | 'critical';

type SchedulerAlert = {
  code: string;
  severity: SchedulerAlertSeverity;
  message: string;
  observed: number;
  threshold: number;
};

type AlertThresholds = {
  pendingRetries: number;
  deadLetters24h: number;
  maxRetryAttempt: number;
  failureRate24h: number;
};

function toFiniteNumber(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function clampFailureRate(value: number) {
  return Math.max(0, Math.min(1, value));
}

const ALERT_THRESHOLDS: AlertThresholds = {
  pendingRetries: Math.max(1, Math.floor(toFiniteNumber(process.env.SYNC_ALERT_PENDING_RETRY_THRESHOLD, 8))),
  deadLetters24h: Math.max(1, Math.floor(toFiniteNumber(process.env.SYNC_ALERT_DEAD_LETTER_24H_THRESHOLD, 3))),
  maxRetryAttempt: Math.max(1, Math.floor(toFiniteNumber(process.env.SYNC_ALERT_MAX_RETRY_ATTEMPT_THRESHOLD, 3))),
  failureRate24h: clampFailureRate(toFiniteNumber(process.env.SYNC_ALERT_FAILURE_RATE_24H_THRESHOLD, 0.25)),
};

function toHealth(params: {
  latestRunStatus: 'success' | 'error' | 'skipped' | 'none';
  runs24h: number;
  failures24h: number;
}): 'ok' | 'degraded' | 'unknown' {
  const { latestRunStatus, runs24h, failures24h } = params;

  if (latestRunStatus === 'none') {
    return 'unknown';
  }

  if (latestRunStatus === 'error') {
    return 'degraded';
  }

  if (runs24h <= 0) {
    return 'ok';
  }

  const failureRate = failures24h / runs24h;
  if (failureRate >= 0.25) {
    return 'degraded';
  }

  return 'ok';
}

function isMissingTable(errorCode?: string) {
  // Postgres undefined_table
  return errorCode === '42P01';
}

function toRetrySummary(params: {
  retryRows: RetryQueueRow[];
  queueReady: boolean;
  deadLetterRows: RetryDeadLetterRow[];
  deadLetterReady: boolean;
}) {
  const { retryRows, queueReady, deadLetterRows, deadLetterReady } = params;
  const pendingPlatforms = Array.from(new Set(retryRows.map((row) => row.platform)));
  const maxRetryAttempt = retryRows.reduce((max, row) => Math.max(max, row.retry_attempt || 0), 0);
  const nextAttemptAt = retryRows[0]?.next_attempt_at ?? null;

  const nowMs = Date.now();
  const since24hMs = nowMs - 24 * 60 * 60 * 1000;
  const deadLetters24h = deadLetterRows.filter((row) => new Date(row.created_at).getTime() >= since24hMs).length;
  const lastDeadLetterAt = deadLetterRows[0]?.created_at ?? null;
  const deadLetterPlatforms = Array.from(new Set(deadLetterRows.map((row) => row.platform)));

  return {
    queueReady,
    pendingCount: retryRows.length,
    nextAttemptAt,
    maxRetryAttempt,
    pendingPlatforms,
    deadLetterReady,
    deadLetters24h,
    lastDeadLetterAt,
    deadLetterPlatforms,
  };
}

function toSchedulerAlerts(params: {
  retrySummary: ReturnType<typeof toRetrySummary>;
  failureRate24h: number;
  runs24h: number;
}) {
  const { retrySummary, failureRate24h, runs24h } = params;
  const alerts: SchedulerAlert[] = [];

  if (!retrySummary.queueReady) {
    alerts.push({
      code: 'retry_queue_missing',
      severity: 'critical',
      message: 'Retry queue table is unavailable. Apply migration 006_sync_retry_queue.sql.',
      observed: 0,
      threshold: 1,
    });
  }

  if (!retrySummary.deadLetterReady) {
    alerts.push({
      code: 'dead_letter_table_missing',
      severity: 'critical',
      message: 'Dead-letter table is unavailable. Apply migration 007_sync_retry_dead_letters.sql.',
      observed: 0,
      threshold: 1,
    });
  }

  if (retrySummary.pendingCount >= ALERT_THRESHOLDS.pendingRetries) {
    alerts.push({
      code: 'retry_queue_backlog',
      severity: 'warning',
      message: `Retry queue backlog is elevated (${retrySummary.pendingCount} pending).`,
      observed: retrySummary.pendingCount,
      threshold: ALERT_THRESHOLDS.pendingRetries,
    });
  }

  if (retrySummary.maxRetryAttempt >= ALERT_THRESHOLDS.maxRetryAttempt) {
    alerts.push({
      code: 'high_retry_attempts',
      severity: 'warning',
      message: `Retry attempts are climbing (max attempt ${retrySummary.maxRetryAttempt}).`,
      observed: retrySummary.maxRetryAttempt,
      threshold: ALERT_THRESHOLDS.maxRetryAttempt,
    });
  }

  if (retrySummary.deadLetters24h >= ALERT_THRESHOLDS.deadLetters24h) {
    alerts.push({
      code: 'dead_letter_volume',
      severity: 'critical',
      message: `Dead-letter volume in 24h exceeded threshold (${retrySummary.deadLetters24h}).`,
      observed: retrySummary.deadLetters24h,
      threshold: ALERT_THRESHOLDS.deadLetters24h,
    });
  }

  if (runs24h > 0 && failureRate24h >= ALERT_THRESHOLDS.failureRate24h) {
    alerts.push({
      code: 'scheduler_failure_rate',
      severity: 'critical',
      message: `Scheduler failure rate is high (${Math.round(failureRate24h * 100)}%).`,
      observed: Number((failureRate24h * 100).toFixed(2)),
      threshold: Number((ALERT_THRESHOLDS.failureRate24h * 100).toFixed(2)),
    });
  }

  const severityRank: Record<SchedulerAlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

function toSchedulerEscalations(rows: SyncEscalationRow[]): SchedulerEscalation[] {
  return rows.map((row) => ({
    code: row.code,
    severity: row.severity,
    status: row.status,
    owner: row.owner,
    message: row.message,
    triggerCount: row.trigger_count,
    lastTriggeredAt: row.last_triggered_at,
    resolvedAt: row.resolved_at,
    lastDispatchedAt: row.last_dispatched_at,
    dispatchCount: row.dispatch_count,
    observed: row.last_observed,
    threshold: row.threshold,
  }));
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authData.user.id;
    const [logsResult, syncResult, retryResult, deadLetterResult, escalationResult] = await Promise.all([
      supabase
        .from('sync_run_logs')
        .select('run_id,platform,status,duration_ms,error_message,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('sync_status')
        .select('platform,status,last_sync_at,error_message,sync_progress,total_items')
        .eq('user_id', userId),
      supabase
        .from('sync_retry_queue')
        .select('platform,retry_attempt,next_attempt_at')
        .eq('user_id', userId)
        .order('next_attempt_at', { ascending: true })
        .limit(200),
      supabase
        .from('sync_retry_dead_letters')
        .select('platform,retry_attempt,created_at,failure_reason')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('sync_escalation_events')
        .select('code,severity,status,owner,message,trigger_count,last_triggered_at,resolved_at,last_dispatched_at,dispatch_count,last_observed,threshold')
        .eq('user_id', userId)
        .order('last_triggered_at', { ascending: false })
        .limit(50),
    ]);

    const syncRows = (syncResult.data ?? []) as SyncStatusRow[];
    let retryQueueReady = true;
    let retryRows: RetryQueueRow[] = [];
    let deadLetterReady = true;
    let deadLetterRows: RetryDeadLetterRow[] = [];

    if (retryResult.error) {
      if (isMissingTable(retryResult.error.code)) {
        retryQueueReady = false;
      } else {
        throw retryResult.error;
      }
    } else {
      retryRows = (retryResult.data ?? []) as RetryQueueRow[];
    }

    if (deadLetterResult.error) {
      if (isMissingTable(deadLetterResult.error.code)) {
        deadLetterReady = false;
      } else {
        throw deadLetterResult.error;
      }
    } else {
      deadLetterRows = (deadLetterResult.data ?? []) as RetryDeadLetterRow[];
    }

    let escalationReady = true;
    let escalationWarning: string | null = null;
    let escalationRows: SyncEscalationRow[] = [];

    if (escalationResult.error) {
      if (isMissingTable(escalationResult.error.code)) {
        escalationReady = false;
        escalationWarning =
          'sync_escalation_events table is not available. Apply migration 008_sync_escalation_events.sql.';
      } else {
        throw escalationResult.error;
      }
    } else {
      escalationRows = (escalationResult.data ?? []) as SyncEscalationRow[];
    }

    const escalations = toSchedulerEscalations(escalationRows);
    const activeEscalationCount = escalations.filter((escalation) => escalation.status === 'open').length;

    const retrySummary = toRetrySummary({
      retryRows,
      queueReady: retryQueueReady,
      deadLetterRows,
      deadLetterReady,
    });

    if (logsResult.error) {
      if (isMissingTable(logsResult.error.code)) {
        const alerts = toSchedulerAlerts({
          retrySummary,
          failureRate24h: 0,
          runs24h: 0,
        });

        return NextResponse.json({
          observabilityReady: false,
          scheduler: {
            health: 'unknown',
            reason: 'sync_run_logs table is not available. Apply migration 005_sync_run_logs.sql.',
            lastRunAt: null,
            lastSuccessAt: null,
            lastErrorAt: null,
            runs24h: 0,
            failures24h: 0,
            failureRate24h: 0,
            latestRun: null,
            retry: retrySummary,
            alerts,
            alertThresholds: ALERT_THRESHOLDS,
            escalationReady,
            escalationWarning,
            escalations,
            activeEscalationCount,
          },
          platforms: syncRows,
        });
      }

      throw logsResult.error;
    }

    const logs = (logsResult.data ?? []) as SyncRunLogRow[];
    const nowMs = Date.now();
    const since24hMs = nowMs - 24 * 60 * 60 * 1000;

    const runMap = new Map<string, SyncRunLogRow[]>();
    for (const row of logs) {
      const existing = runMap.get(row.run_id);
      if (existing) {
        existing.push(row);
      } else {
        runMap.set(row.run_id, [row]);
      }
    }

    const orderedRuns = Array.from(runMap.entries())
      .map(([runId, rows]) => {
        const createdAt = rows
          .map((row) => row.created_at)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

        return {
          runId,
          createdAt,
          rows,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const latestRun = orderedRuns[0];
    const latestRunRows = latestRun?.rows ?? [];

    const latestRunStatus: 'success' | 'error' | 'skipped' | 'none' = latestRun
      ? latestRunRows.some((row) => row.status === 'error')
        ? 'error'
        : latestRunRows.some((row) => row.status === 'success')
          ? 'success'
          : 'skipped'
      : 'none';

    const runs24h = orderedRuns.filter((run) => new Date(run.createdAt).getTime() >= since24hMs).length;
    const failures24h = orderedRuns.filter((run) => {
      const inWindow = new Date(run.createdAt).getTime() >= since24hMs;
      if (!inWindow) return false;
      return run.rows.some((row) => row.status === 'error');
    }).length;

    const lastSuccessAt = logs.find((row) => row.status === 'success')?.created_at ?? null;
    const lastErrorAt = logs.find((row) => row.status === 'error')?.created_at ?? null;

    const latestRunFailedPlatforms = latestRunRows
      .filter((row) => row.status === 'error')
      .map((row) => row.platform);

    const latestRunDurationMs = latestRunRows.reduce((total, row) => total + Math.max(0, row.duration_ms || 0), 0);

    const failureRate24h = runs24h > 0 ? failures24h / runs24h : 0;
    const alerts = toSchedulerAlerts({
      retrySummary,
      failureRate24h,
      runs24h,
    });

    return NextResponse.json({
      observabilityReady: true,
      scheduler: {
        health: toHealth({ latestRunStatus, runs24h, failures24h }),
        lastRunAt: latestRun?.createdAt ?? null,
        lastSuccessAt,
        lastErrorAt,
        runs24h,
        failures24h,
        failureRate24h,
        latestRun: latestRun
          ? {
              runId: latestRun.runId,
              status: latestRunStatus,
              failedPlatforms: latestRunFailedPlatforms,
              platformCount: latestRunRows.length,
              durationMs: latestRunDurationMs,
            }
          : null,
        retry: retrySummary,
        alerts,
        alertThresholds: ALERT_THRESHOLDS,
        escalationReady,
        escalationWarning,
        escalations,
        activeEscalationCount,
      },
      platforms: syncRows,
    });
  } catch (error) {
    console.error('sync status error:', error);
    return NextResponse.json(
      {
        error: 'Unable to read sync status right now.',
        observabilityReady: false,
      },
      { status: 500 }
    );
  }
}
