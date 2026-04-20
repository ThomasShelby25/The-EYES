import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/ai-readiness/route";

describe("GET /api/ai-readiness", () => {
  it("returns offline when ANTHROPIC_API_KEY is missing", async () => {
    const request = new Request("http://localhost:3000/api/ai-readiness");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.status).toBe("offline");
    expect(json.reason).toContain("ANTHROPIC_API_KEY");
  });
});
