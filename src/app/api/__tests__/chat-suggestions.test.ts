import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/chat-suggestions/route';

describe('GET /api/chat-suggestions', () => {
  it('returns suggestions payload even when unauthenticated', async () => {
    const response = await GET();
    const json = (await response.json()) as { suggestions: string[] };

    expect(response.status).toBe(200);
    expect(Array.isArray(json.suggestions)).toBe(true);
    expect(json.suggestions.length).toBeGreaterThan(0);
  });
});
