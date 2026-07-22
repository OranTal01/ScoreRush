import { describe, expect, it } from "vitest";
import { colors, motion, radii } from "@/lib/design-tokens";

describe("design tokens", () => {
  it("exposes the full Premium Fantasy Refined color set", () => {
    expect(colors.bgPage).toBe("#080B14");
    expect(colors.gold).toBe("#D6B56E");
    expect(colors.danger).toBe("#D85C6A");
  });

  it("exposes motion duration tokens in milliseconds", () => {
    expect(motion.duration.fast).toBe(120);
    expect(motion.duration.normal).toBe(220);
    expect(motion.duration.slow).toBe(420);
  });

  it("exposes radii as CSS length strings", () => {
    expect(radii.card).toBe("22px");
    expect(radii.pill).toBe("20px");
  });
});
