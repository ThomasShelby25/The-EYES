import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/cron/retry-remediation/route';

describe('GET /api/cron/retry-remediation', () => {
  it('returns unauthorized without cron auth header', async () => {
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'unit-test-secret';

    const response = await GET(new Request('http://localhost/api/cron/retry-remediation'));
    const payload = (await response.json()) as { error?: string };

    process.env.CRON_SECRET = prevSecret;

    expect(response.status).toBe(401);
    expect(payload.error).toBe('Unauthorized');
  });

  it('validates remediation action before touching database', async () => {
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'unit-test-secret';

    const response = await GET(
      new Request('http://localhost/api/cron/retry-remediation?action=invalid', {
        headers: {
          'x-cron-secret': 'unit-test-secret',
        },
      })
    );
    const payload = (await response.json()) as { error?: string };

    process.env.CRON_SECRET = prevSecret;

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Invalid action');
  });

  it('requires explicit confirm flag for destructive purge', async () => {
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'unit-test-secret';

    const response = await GET(
      new Request('http://localhost/api/cron/retry-remediation?action=purge', {
        headers: {
          Authorization: 'Bearer unit-test-secret',
        },
      })
    );
    const payload = (await response.json()) as { error?: string };

    process.env.CRON_SECRET = prevSecret;

    expect(response.status).toBe(400);
    expect(payload.error).toContain('confirm=purge');
  });
});
