import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("@/app/(app)/profile/nickname-form", () => ({
  NicknameForm: () => <div>Nickname editor</div>,
}));
vi.mock("@/app/(app)/profile/push-settings", () => ({
  PushSettings: () => <div>Notification settings</div>,
}));
import { WelcomeGuide } from "./welcome-guide";
import { welcomeKey } from "./welcome-nudge";
const props = {
  scope: "cup:me",
  name: "אורן",
  tournamentName: "החבר׳ה",
  rules: { exact: 9, difference: 6, winner: 3, wrong: 0, lockMinutes: 5 },
  firstMatch: null,
  hasPrediction: false,
};
beforeEach(() => localStorage.clear());
describe("guided start", () => {
  it("acknowledges the rules and optional notifications without inventing a submitted pick", () => {
    render(<WelcomeGuide {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: "ממשיכים עם הכינוי שלי ←" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "הבנתי, עוברים לניחוש ←" }),
    );
    expect(screen.getByText(/כרגע אין משחק פתוח/)).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "2",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "להתראות — אשלים את הניחוש בהמשך ←" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "אמשיך בלי התראות כרגע" }),
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    expect(
      screen.queryByText("✓ המכשיר הזה מוכן לקבל התראות"),
    ).not.toBeInTheDocument();
  });
  it("restores acknowledged steps but uses the server for submission status", () => {
    localStorage.setItem(
      welcomeKey(props.scope),
      JSON.stringify({
        name: true,
        rules: true,
        notifications: true,
        predicted: true,
      }),
    );
    const { rerender } = render(<WelcomeGuide {...props} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    rerender(
      <WelcomeGuide key="other" {...props} scope="cup:other" hasPrediction />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "שלבי ההיכרות" }),
      ).getByRole("button", { name: /ניחוש ראשון/ }),
    );
    expect(screen.getByText("✓ הניחוש הראשון שלכם כבר באתר")).toBeVisible();
  });
});
