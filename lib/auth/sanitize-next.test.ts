import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./sanitize-next";
describe("safe return destinations", () => {
  it("keeps invitation paths and query strings", () => {
    expect(sanitizeNext("/join/invite?error=nickname")).toBe(
      "/join/invite?error=nickname",
    );
  });
  it.each([
    "https://example.org",
    "//example.org",
    "/\\example.org",
    "/\n/example.org",
    "",
    null,
  ])("rejects unsafe redirect %s", (value) => {
    expect(sanitizeNext(value)).toBe("/");
  });
});
