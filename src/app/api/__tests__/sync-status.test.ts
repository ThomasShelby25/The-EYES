import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/sync/status/route';

describe('GET /api/sync/status', () => {
  it('returns graceful fallback when Supabase env is missing', async () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await GET();
    const json = (await response.json()) as {
      error?: string;
      observabilityReady?: boolean;
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;

    expect(response.status).toBe(500);
    expect(json.observabilityReady).toBe(false);
    expect(json.error).toContain('Unable to read sync status');
  });
});
