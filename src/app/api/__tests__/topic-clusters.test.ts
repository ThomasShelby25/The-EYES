import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/topic-clusters/route';

describe('GET /api/topic-clusters', () => {
  it('returns graceful fallback when Supabase env is missing', async () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await GET();
    const json = (await response.json()) as { clusters: unknown[] };

    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;

    expect(response.status).toBe(200);
    expect(Array.isArray(json.clusters)).toBe(true);
    expect(json.clusters).toHaveLength(0);
  });
});
