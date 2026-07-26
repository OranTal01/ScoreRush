import { describe, expect, it } from "vitest";
import { buildInvitationEmail } from "./invitation-email";

describe("buildInvitationEmail", () => {
  it("builds a message with the recipient, Hebrew subject, and join link", () => {
    const message = buildInvitationEmail({
      to: "invitee@example.com",
      tournamentName: "מונדיאל המשרד",
      joinUrl: "https://scorerush.app/join/abc123",
    });

    expect(message.to).toBe("invitee@example.com");
    expect(message.subject).toContain("מונדיאל המשרד");
    expect(message.html).toContain("https://scorerush.app/join/abc123");
    expect(message.text).toContain("https://scorerush.app/join/abc123");
    expect(message.text).toContain("מונדיאל המשרד");
  });

  it("HTML-escapes the tournament name in the html body but not the plain-text body", () => {
    const message = buildInvitationEmail({
      to: "invitee@example.com",
      tournamentName: '<b>Evil</b> & "Friends"',
      joinUrl: "https://scorerush.app/join/abc123",
    });

    expect(message.html).not.toContain("<b>Evil</b>");
    expect(message.html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
    expect(message.html).toContain("&amp;");
    // The plain-text fallback has no HTML to break, so it stays unescaped/readable.
    expect(message.text).toContain('<b>Evil</b> & "Friends"');
  });
});
