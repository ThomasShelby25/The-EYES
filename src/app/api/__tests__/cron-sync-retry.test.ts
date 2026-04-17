import { describe, expect, it } from 'vitest';

import { GET, computeRetryDelayMs, computeRetryDelayWithJitterMs } from '@/app/api/cron/sync/route';

describe('cron retry backoff', () => {
  it('uses exponential retry delay with cap', () => {
    expect(computeRetryDelayMs(1)).toBe(60_000);
    expect(computeRetryDelayMs(2)).toBe(120_000);
    expect(computeRetryDelayMs(10)).toBe(3_600_000);
  });

  it('applies bounded jitter around base retry delay', () => {
    expect(computeRetryDelayWithJitterMs(2, 0)).toBe(96_000);
    expect(computeRetryDelayWithJitterMs(2, 0.5)).toBe(120_000);
    expect(computeRetryDelayWithJitterMs(2, 1)).toBe(144_000);
    expect(computeRetryDelayWithJitterMs(10, 1)).toBe(3_600_000);
  });
});

describe('GET /api/cron/sync', () => {
  it('returns unauthorized without cron auth header', async () => {
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'unit-test-secret';

    const response = await GET(new Request('http://localhost/api/cron/sync'));
    const payload = (await response.json()) as { error?: string };

    process.env.CRON_SECRET = prevSecret;

    expect(response.status).toBe(401);
    expect(payload.error).toBe('Unauthorized');
  });

  it('returns bad request for invalid forced user id', async () => {
    const prevSecret = process.env.CRON_SECRET;
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevService = process.env.SUPABASE_SERVICE_ROLE_KEY;

    process.env.CRON_SECRET = 'unit-test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-service-role-key';

    const response = await GET(
      new Request('http://localhost/api/cron/sync?userId=not-a-uuid', {
        headers: {
          'x-cron-secret': 'unit-test-secret',
        },
      })
    );
    const payload = (await response.json()) as { error?: string };

    process.env.CRON_SECRET = prevSecret;
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevService;

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid userId query parameter.');
  });
});
