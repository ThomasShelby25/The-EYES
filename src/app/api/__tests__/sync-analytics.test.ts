import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { GET } from '@/app/api/sync/analytics/route';
import { createClient } from '@/utils/supabase/server';

const createClientMock = vi.mocked(createClient);

type QueryResult<T> = {
  data: T;
  error: { code?: string; message?: string } | null;
};

function createSupabaseFixture(params?: {
  syncLogs?: QueryResult<
    Array<{
      status: 'success' | 'error' | 'skipped';
      duration_ms: number;
      created_at: string;
    }>
  >;
  deadLetters?: QueryResult<Array<{ created_at: string }>>;
  refreshLogs?: QueryResult<Array<{ status: 'success' | 'error' | 'skipped'; created_at: string }>>;
}) {
  const syncLogs =
    params?.syncLogs ??
    ({
      data: [],
      error: null,
    } as QueryResult<Array<{ status: 'success' | 'error' | 'skipped'; duration_ms: number; created_at: string }>>);
  const deadLetters =
    params?.deadLetters ??
    ({
      data: [],
      error: null,
    } as QueryResult<Array<{ created_at: string }>>);
  const refreshLogs =
    params?.refreshLogs ??
    ({
      data: [],
      error: null,
    } as QueryResult<Array<{ status: 'success' | 'error' | 'skipped'; created_at: string }>>);

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: '11111111-1111-4111-8111-111111111111',
          },
        },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      const result =
        table === 'sync_run_logs'
          ? syncLogs
          : table === 'sync_retry_dead_letters'
            ? deadLetters
            : refreshLogs;

      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(async () => result),
      };

      return builder;
    }),
  };
}

describe('GET /api/sync/analytics', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('returns CSV analytics export with summary and trend rows', async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0).toISOString();

    createClientMock.mockResolvedValue(
      createSupabaseFixture({
        syncLogs: {
          data: [
            { status: 'success', duration_ms: 1000, created_at: today },
            { status: 'error', duration_ms: 2000, created_at: yesterday },
          ],
          error: null,
        },
        deadLetters: {
          data: [{ created_at: today }],
          error: null,
        },
        refreshLogs: {
          data: [
            { status: 'error', created_at: today },
            { status: 'success', created_at: yesterday },
          ],
          error: null,
        },
      }) as never
    );

    const response = await GET(new Request('http://localhost/api/sync/analytics?days=14&format=csv'));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('sync-analytics-14d');
    expect(csv).toContain('date,runs,failures,deadLetters,refreshAttempts,refreshFailures,avgDurationMs,failureRate,refreshFailureRate');
    expect(csv).toContain('SUMMARY,2,1,1,2,1,1500,0.5,0.5');
  });

  it('returns warnings when analytics tables are missing', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseFixture({
        syncLogs: {
          data: [],
          error: { code: '42P01', message: 'relation "sync_run_logs" does not exist' },
        },
        deadLetters: {
          data: [],
          error: { code: '42P01', message: 'relation "sync_retry_dead_letters" does not exist' },
        },
        refreshLogs: {
          data: [],
          error: null,
        },
      }) as never
    );

    const response = await GET(new Request('http://localhost/api/sync/analytics?days=30'));
    const payload = (await response.json()) as {
      warnings?: string[];
      summary: {
        totalRuns: number;
        totalFailures: number;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.warnings?.join(' | ')).toContain('sync_run_logs table is unavailable');
    expect(payload.warnings?.join(' | ')).toContain('sync_retry_dead_letters table is unavailable');
    expect(payload.summary.totalRuns).toBe(0);
    expect(payload.summary.totalFailures).toBe(0);
  });
});
