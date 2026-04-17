import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const state = {
    userId: '11111111-1111-4111-8111-111111111111',
    authenticated: true,
    missingTable: false,
    row: null as null | {
      platform: string;
      data_types: string[];
      sync_enabled: boolean;
      updated_at: string;
    },
  };

  function createSupabase() {
    return {
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: state.authenticated
              ? {
                  id: state.userId,
                }
              : null,
          },
          error: state.authenticated ? null : { message: 'unauthorized' },
        })),
      },
      from: vi.fn((table: string) => {
        if (table !== 'connector_settings') {
          throw new Error(`Unexpected table ${table}`);
        }

        let selectedPlatform = '';

        const selectBuilder = {
          select: vi.fn(() => selectBuilder),
          eq: vi.fn((column: string, value: string) => {
            if (column === 'platform') {
              selectedPlatform = value;
            }
            return selectBuilder;
          }),
          maybeSingle: vi.fn(async () => {
            if (state.missingTable) {
              return {
                data: null,
                error: { code: '42P01', message: 'missing connector_settings table' },
              };
            }

            if (!state.row || state.row.platform !== selectedPlatform) {
              return { data: null, error: null };
            }

            return {
              data: state.row,
              error: null,
            };
          }),
        };

        const upsertBuilder = {
          select: vi.fn(() => upsertBuilder),
          maybeSingle: vi.fn(async () => {
            if (state.missingTable) {
              return {
                data: null,
                error: { code: '42P01', message: 'missing connector_settings table' },
              };
            }

            return { data: state.row, error: null };
          }),
        };

        return {
          ...selectBuilder,
          upsert: vi.fn((payload: { platform: string; data_types: string[]; sync_enabled: boolean }) => {
            if (!state.missingTable) {
              state.row = {
                platform: payload.platform,
                data_types: payload.data_types,
                sync_enabled: payload.sync_enabled,
                updated_at: '2026-04-08T10:00:00.000Z',
              };
            }
            return upsertBuilder;
          }),
        };
      }),
    };
  }

  return {
    state,
    createSupabase,
  };
});

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => hoisted.createSupabase()),
}));

import { GET, PUT } from '@/app/api/connector-settings/[platform]/route';

describe('connector settings route', () => {
  beforeEach(() => {
    hoisted.state.authenticated = true;
    hoisted.state.missingTable = false;
    hoisted.state.row = null;
  });

  it('returns warning payload when connector settings table is missing', async () => {
    hoisted.state.missingTable = true;

    const response = await GET(new Request('http://localhost/api/connector-settings/github'), {
      params: Promise.resolve({ platform: 'github' }),
    });
    const payload = (await response.json()) as { warning?: string; dataTypes?: string[]; syncEnabled?: boolean };

    expect(response.status).toBe(200);
    expect(payload.warning).toContain('migration 011_connector_settings.sql');
    expect(payload.dataTypes).toEqual([]);
    expect(payload.syncEnabled).toBe(true);
  });

  it('persists and returns connector settings', async () => {
    const putResponse = await PUT(
      new Request('http://localhost/api/connector-settings/github', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataTypes: ['Issues', 'PRs'],
          syncEnabled: false,
        }),
      }),
      {
        params: Promise.resolve({ platform: 'github' }),
      }
    );

    expect(putResponse.status).toBe(200);

    const getResponse = await GET(new Request('http://localhost/api/connector-settings/github'), {
      params: Promise.resolve({ platform: 'github' }),
    });
    const payload = (await getResponse.json()) as {
      dataTypes?: string[];
      syncEnabled?: boolean;
      platform?: string;
    };

    expect(getResponse.status).toBe(200);
    expect(payload.platform).toBe('github');
    expect(payload.dataTypes).toEqual(['Issues', 'PRs']);
    expect(payload.syncEnabled).toBe(false);
  });
});