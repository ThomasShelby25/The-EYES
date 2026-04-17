import { describe, expect, it } from "vitest";

import { toSyncRoutePlatform } from "@/app/api/sync/all/route";

describe("toSyncRoutePlatform", () => {
  it("maps google_calendar to google-calendar", () => {
    expect(toSyncRoutePlatform("google_calendar")).toBe("google-calendar");
  });

  it("normalizes underscores for generic platform ids", () => {
    expect(toSyncRoutePlatform("custom_platform_name")).toBe("custom-platform-name");
  });

  it("leaves hyphenated ids unchanged", () => {
    expect(toSyncRoutePlatform("google-calendar")).toBe("google-calendar");
  });
});
