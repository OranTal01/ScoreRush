import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMatchTime } from "./time";

afterEach(() => vi.unstubAllEnvs());

describe("match times in Israel", () => {
  it("shows summer kickoffs in Israel time", () => {
    expect(formatMatchTime("2026-09-09T16:45:00Z")).toContain("19:45");
  });

  it("uses the winter offset automatically", () => {
    expect(formatMatchTime("2026-01-09T16:45:00Z")).toContain("18:45");
  });

  it("moves the displayed date forward when Israel passes midnight", () => {
    const time = formatMatchTime("2026-09-09T22:30:00Z");
    expect(time).toContain("10.09");
    expect(time).toContain("01:30");
  });

  it("formats equivalent UTC and offset timestamps identically", () => {
    expect(formatMatchTime("2026-09-09T16:45:00Z")).toBe(
      formatMatchTime("2026-09-09T19:45:00+03:00"),
    );
  });

  it("does not depend on the server's timezone", () => {
    for (const zone of ["UTC", "America/New_York", "Asia/Jerusalem"]) {
      vi.stubEnv("TZ", zone);
      expect(formatMatchTime("2026-09-09T16:45:00Z")).toContain("19:45");
    }
  });
});
