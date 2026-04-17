import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { DELETE } from '@/app/api/data/account/route';
import { createClient } from '@/utils/supabase/server';

const createClientMock = vi.mocked(createClient);

describe('DELETE /api/data/account', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('requires explicit confirmation token before purge', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/data/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('DELETE_ALL_DATA');
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('blocks purge when session is outside recent re-auth window', async () => {
    const staleSignIn = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: '11111111-1111-4111-8111-111111111111',
              last_sign_in_at: staleSignIn,
            },
          },
          error: null,
        })),
        getSession: vi.fn(async () => ({
          data: {
            session: {
              user: {
                last_sign_in_at: staleSignIn,
              },
            },
          },
          error: null,
        })),
      },
    } as never);

    const response = await DELETE(
      new Request('http://localhost/api/data/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE_ALL_DATA' }),
      })
    );

    const payload = (await response.json()) as {
      error?: string;
      reauthRequired?: boolean;
      reauthWindowMinutes?: number;
    };

    expect(response.status).toBe(428);
    expect(payload.reauthRequired).toBe(true);
    expect(payload.reauthWindowMinutes).toBe(30);
    expect(payload.error).toContain('Recent re-authentication required');
  });
});
