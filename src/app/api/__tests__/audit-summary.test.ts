import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/audit-summary/route";

describe("GET /api/audit-summary", () => {
  it("returns explicit error when Supabase env is missing", async () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await GET();
    const json = (await response.json()) as {
      error?: string;
      fallback?: {
        totalMemories: number;
        flaggedItems: Array<{ id: string }>;
        riskCounts: { heavy: number; direct: number; light: number };
      };
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;

    expect(response.status).toBe(503);
    expect(json.error).toContain("Supabase");
    expect(json.fallback?.totalMemories).toBe(0);
    expect(json.fallback?.flaggedItems).toHaveLength(0);
    expect(json.fallback?.riskCounts).toEqual({ heavy: 0, direct: 0, light: 0 });
  });
});
