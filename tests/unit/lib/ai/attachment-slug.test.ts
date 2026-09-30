import { describe, expect, it } from "vitest";
import { slugFromName } from "@/lib/ai/attachment-slug";

describe("slugFromName", () => {
  it("builds a stable slug from a display name", () => {
    expect(slugFromName("Cite the page")).toBe("cite-the-page");
    expect(slugFromName("  !!!  ")).toBe("item");
  });
});
