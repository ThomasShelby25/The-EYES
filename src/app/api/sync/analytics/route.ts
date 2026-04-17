import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';

type SyncRunRow = {
  status: 'success' | 'error' | 'skipped';
  duration_ms: number;
  created_at: string;
};

type DeadLetterRow = {
  created_at: string;
};

type RefreshLogRow = {
  status: 'success' | 'error' | 'skipped';
  created_at: string;
};

type TrendPoint = {
  date: string;
  runs: number;
  failures: number;
  deadLetters: number;
  refreshAttempts: number;
  refreshFailures: number;
  avgDurationMs: number;
};

function isMissingTable(errorCode?: string) {
  return errorCode === '42P01';
}

function parseWindowDays(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get('days') || 30);
  if (!Number.isFinite(raw)) {
    return 30;
  }

  return Math.min(180, Math.max(7, Math.floor(raw)));
}

function readFormat(request: Request) {
  const value = new URL(request.url).searchParams.get('format')?.toLowerCase();
  return value === 'csv' ? 'csv' : 'json';
}

function toCsv(columns: string[], rows: Array<Record<string, unknown>>) {
  const header = columns.join(',');
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const value = row[column];
          if (value === null || value === undefined) return '';
          const text = typeof value === 'string' ? value : String(value);
          if (/[,"\n\r]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
          }
          return text;
        })
        .join(',')
    )
    .join('\n');

  return `${header}\n${body}`;
}

function analyticsCsvFileName(windowDays: number) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `sync-analytics-${windowDays}d-${yyyy}-${mm}-${dd}.csv`;
}

function buildTrendWindow(days: number) {
  const buckets = new Map<string, TrendPoint>();
  const today = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = date.toISOString().slice(0, 10);

    buckets.set(key, {
      date: key,
      runs: 0,
      failures: 0,
      deadLetters: 0,
      refreshAttempts: 0,
      refreshFailures: 0,
      avgDurationMs: 0,
    });
  }

  return buckets;
}

export async function GET(request: Request) {
  try {
    const windowDays = parseWindowDays(request);
    const format = readFormat(request);
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [syncLogsResult, deadLetterResult, refreshResult] = await Promise.all([
      supabase
        .from('sync_run_logs')
        .select('status,duration_ms,created_at')
        .eq('user_id', user.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(4000),
      supabase
        .from('sync_retry_dead_letters')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2500),
      supabase
        .from('oauth_refresh_logs')
        .select('status,created_at')
        .eq('user_id', user.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2500),
    ]);

    const warnings: string[] = [];
    const syncRows: SyncRunRow[] = [];
    const deadLetterRows: DeadLetterRow[] = [];
    const refreshRows: RefreshLogRow[] = [];

    if (syncLogsResult.error) {
      if (isMissingTable(syncLogsResult.error.code)) {
        warnings.push('sync_run_logs table is unavailable. Apply migration 005_sync_run_logs.sql.');
      } else {
        throw syncLogsResult.error;
      }
    } else {
      syncRows.push(...((syncLogsResult.data ?? []) as SyncRunRow[]));
    }

    if (deadLetterResult.error) {
      if (isMissingTable(deadLetterResult.error.code)) {
        warnings.push('sync_retry_dead_letters table is unavailable. Apply migration 007_sync_retry_dead_letters.sql.');
      } else {
        throw deadLetterResult.error;
      }
    } else {
      deadLetterRows.push(...((deadLetterResult.data ?? []) as DeadLetterRow[]));
    }

    if (refreshResult.error) {
      if (isMissingTable(refreshResult.error.code)) {
        warnings.push('oauth_refresh_logs table is unavailable. Apply migration 009_oauth_refresh_logs.sql.');
      } else {
        throw refreshResult.error;
      }
    } else {
      refreshRows.push(...((refreshResult.data ?? []) as RefreshLogRow[]));
    }

    const trendWindow = buildTrendWindow(windowDays);
    const durationSums = new Map<string, number>();

    for (const row of syncRows) {
      const key = row.created_at.slice(0, 10);
      const point = trendWindow.get(key);
      if (!point) continue;

      point.runs += 1;
      if (row.status === 'error') {
        point.failures += 1;
      }

      durationSums.set(key, (durationSums.get(key) ?? 0) + Math.max(0, row.duration_ms || 0));
    }

    for (const row of deadLetterRows) {
      const key = row.created_at.slice(0, 10);
      const point = trendWindow.get(key);
      if (!point) continue;
      point.deadLetters += 1;
    }

    for (const row of refreshRows) {
      const key = row.created_at.slice(0, 10);
      const point = trendWindow.get(key);
      if (!point) continue;
      point.refreshAttempts += 1;
      if (row.status === 'error') {
        point.refreshFailures += 1;
      }
    }

    for (const [key, point] of trendWindow.entries()) {
      const sum = durationSums.get(key) ?? 0;
      point.avgDurationMs = point.runs > 0 ? Math.round(sum / point.runs) : 0;
    }

    const trend = Array.from(trendWindow.values());
    const totalRuns = trend.reduce((total, point) => total + point.runs, 0);
    const totalFailures = trend.reduce((total, point) => total + point.failures, 0);
    const totalDeadLetters = trend.reduce((total, point) => total + point.deadLetters, 0);
    const totalRefreshAttempts = trend.reduce((total, point) => total + point.refreshAttempts, 0);
    const totalRefreshFailures = trend.reduce((total, point) => total + point.refreshFailures, 0);

    const totalDurationMs = trend.reduce((total, point) => total + point.avgDurationMs * point.runs, 0);

    const payload = {
      generatedAt: new Date().toISOString(),
      windowDays,
      warnings,
      summary: {
        totalRuns,
        totalFailures,
        failureRate: totalRuns > 0 ? Number((totalFailures / totalRuns).toFixed(4)) : 0,
        avgDurationMs: totalRuns > 0 ? Math.round(totalDurationMs / totalRuns) : 0,
        totalDeadLetters,
        totalRefreshAttempts,
        totalRefreshFailures,
        refreshFailureRate:
          totalRefreshAttempts > 0 ? Number((totalRefreshFailures / totalRefreshAttempts).toFixed(4)) : 0,
      },
      trend,
    };

    if (format === 'csv') {
      const summaryRows = [
        {
          date: 'SUMMARY',
          runs: payload.summary.totalRuns,
          failures: payload.summary.totalFailures,
          deadLetters: payload.summary.totalDeadLetters,
          refreshAttempts: payload.summary.totalRefreshAttempts,
          refreshFailures: payload.summary.totalRefreshFailures,
          avgDurationMs: payload.summary.avgDurationMs,
          failureRate: payload.summary.failureRate,
          refreshFailureRate: payload.summary.refreshFailureRate,
        },
      ];

      const trendRows = payload.trend.map((point) => ({
        date: point.date,
        runs: point.runs,
        failures: point.failures,
        deadLetters: point.deadLetters,
        refreshAttempts: point.refreshAttempts,
        refreshFailures: point.refreshFailures,
        avgDurationMs: point.avgDurationMs,
        failureRate: point.runs > 0 ? Number((point.failures / point.runs).toFixed(4)) : 0,
        refreshFailureRate:
          point.refreshAttempts > 0 ? Number((point.refreshFailures / point.refreshAttempts).toFixed(4)) : 0,
      }));

      const csv = toCsv(
        [
          'date',
          'runs',
          'failures',
          'deadLetters',
          'refreshAttempts',
          'refreshFailures',
          'avgDurationMs',
          'failureRate',
          'refreshFailureRate',
        ],
        [...summaryRows, ...trendRows]
      );

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${analyticsCsvFileName(windowDays)}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('sync analytics error:', error);
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        windowDays: 30,
        warnings: ['Failed to compute sync analytics.'],
        summary: {
          totalRuns: 0,
          totalFailures: 0,
          failureRate: 0,
          avgDurationMs: 0,
          totalDeadLetters: 0,
          totalRefreshAttempts: 0,
          totalRefreshFailures: 0,
          refreshFailureRate: 0,
        },
        trend: [] as TrendPoint[],
      },
      { status: 200 }
    );
  }
}