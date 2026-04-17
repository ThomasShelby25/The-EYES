import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/memory-chat/route";

describe("POST /api/memory-chat", () => {
  it("returns a compatibility reply payload", async () => {
    const request = new Request("http://localhost/api/memory-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "What did I think about AI in 2022?" }),
    });

    const response = await POST(request);
    const json = (await response.json()) as { reply: string };

    expect(response.status).toBe(200);
    expect(typeof json.reply).toBe("string");
    expect(json.reply.length).toBeGreaterThan(0);
  });

  it("returns 400 when prompt is missing", async () => {
    const request = new Request("http://localhost/api/memory-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "   " }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
