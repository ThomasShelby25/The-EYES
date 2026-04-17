import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/ai-readiness/route";

describe("GET /api/ai-readiness", () => {
  it("returns offline when ANTHROPIC_API_KEY is missing", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const response = await GET();
    const json = (await response.json()) as { status: string; reason: string };

    process.env.ANTHROPIC_API_KEY = prev;

    expect(response.status).toBe(200);
    expect(json.status).toBe("offline");
    expect(json.reason).toContain("ANTHROPIC_API_KEY");
  });
});
