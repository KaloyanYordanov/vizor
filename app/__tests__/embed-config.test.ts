import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMBED_CONFIG,
  mergeEmbedConfig,
} from "~/utils/embed-config";

describe("mergeEmbedConfig", () => {
  it("deep-merges URL overrides over stored settings", () => {
    const result = mergeEmbedConfig(
      {
        theme: {
          ...DEFAULT_EMBED_CONFIG.theme,
          backgroundColor: "#101010",
          fontFamily: "Inter",
        },
      },
      { theme: { primaryColor: "#ff0000" } as any },
    );

    expect(result.theme.primaryColor).toBe("#ff0000");
    expect(result.theme.backgroundColor).toBe("#101010");
    expect(result.theme.fontFamily).toBe("Inter");
  });

  it("returns independent default arrays", () => {
    const first = mergeEmbedConfig();
    first.filters.defaultStatuses.push("UNAVAILABLE");

    expect(mergeEmbedConfig().filters.defaultStatuses).toEqual([
      "AVAILABLE",
      "RESERVED",
      "SOLD",
    ]);
  });
});
