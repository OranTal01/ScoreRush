import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SettingsView } from "@/lib/tournaments/settings-input";
vi.mock("./actions", () => ({
  saveSettings: vi.fn(),
  deleteTournament: vi.fn(),
}));
import { SettingsForm } from "./settings-form";
const view: SettingsView = {
  settings: {
    tournamentId: "11111111-1111-4111-8111-111111111111",
    revision: 0,
    name: "טורניר לדוגמה",
    matchLockMinutes: 5,
    exactScorePoints: 9,
    winnerAndDiffPoints: 6,
    winnerOnlyPoints: 3,
    wrongPoints: 0,
    groupRankingPointsPerPosition: 3,
    rankingConfig: { mode: "bands", sizes: [8, 16, 12] },
    rankingLocksAt: null,
    onboardingOpen: true,
    onboardingMatchday: 1,
    prizes: [],
    categories: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "אלופה",
        type: "team",
        statKey: "champion",
        resolvesAt: "tournament_end",
        duplicateStackingAllowed: true,
        locksAt: null,
        slots: [{ id: "33333333-3333-4333-8333-333333333333", points: 30 }],
      },
    ],
  },
  onboardingClosed: false,
  canDelete: true,
  counts: {
    participants: 2,
    matches: 144,
    predictions: 30,
    rankings: 1,
    bonusPicks: { "22222222-2222-4222-8222-222222222222": 1 },
  },
};
describe("settings form", () => {
  it("starts read-only and retains populated prediction structures while editing", () => {
    render(<SettingsForm view={view} />);
    expect(screen.getByLabelText("שם הטורניר")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "עריכת הגדרות" }));
    expect(screen.getByLabelText("שם הטורניר")).toBeEnabled();
    expect(screen.getByLabelText("שיטת הדירוג")).toBeDisabled();
    expect(screen.getByLabelText("מה בוחרים?")).toBeDisabled();
    expect(screen.getByLabelText("אפשרות 1 — נקודות")).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "הסרת הבונוס" }),
    ).not.toBeInTheDocument();
  });
  it("shows before/after points and requires acknowledgement before saving", () => {
    render(<SettingsForm view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "עריכת הגדרות" }));
    fireEvent.change(screen.getByLabelText("תוצאה מדויקת"), {
      target: { value: "12" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "בדיקת השינויים לפני שמירה" }),
    );
    expect(
      screen.getByText("תוצאה מדויקת: מ־9 ל־12 נקודות"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("סיבת השינוי (נשמרת ביומן)")).toBeRequired();
    expect(
      screen.getByRole("checkbox", { name: /בדקתי את השינויים/ }),
    ).toBeRequired();
    fireEvent.change(screen.getByLabelText("תוצאה מדויקת"), {
      target: { value: "10" },
    });
    expect(
      screen.queryByRole("button", { name: "שמירת השינויים" }),
    ).not.toBeInTheDocument();
  });
  it("shows the exact deletion target and preserves tournament scope in the invitation link", () => {
    render(<SettingsForm view={view} />);
    expect(
      screen.getByLabelText("לאישור, הקלד בדיוק: טורניר לדוגמה"),
    ).toBeRequired();
    expect(
      screen.getByRole("link", { name: /ניהול המשתתפים וההזמנות/ }),
    ).toHaveAttribute(
      "href",
      `/admin/participants?tournament=${view.settings.tournamentId}`,
    );
  });
});
