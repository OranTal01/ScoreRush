import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { SaveFeedbackProvider } from "@/app/_components/save-feedback";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
import { PredictionForm } from "./prediction-form";
beforeEach(() => {
  push.mockReset();
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());
const props = {
  draftScope: "cup:self",
  hasSubmitted: false,
  lockTime: "2099-01-01T00:00:00Z",
  matchId: "11111111-1111-4111-8111-111111111111",
  homeLabel: "Arsenal",
  awayLabel: "PSG",
  initialHome: 0,
  initialAway: 0,
};
const nextId = "22222222-2222-4222-8222-222222222222";
const reply = (data: unknown, ok = true) => ({ ok, json: async () => data });
const success = { status: "success", predictedHome: 0, predictedAway: 0 };

describe("score entry", () => {
  it("updates only the selected team and keeps goals within bounds", () => {
    const { container } = render(
      <PredictionForm
        draftScope="test-cup:self"
        hasSubmitted={false}
        lockTime="2099-01-01T00:00:00Z"
        matchId="match"
        homeLabel="Arsenal"
        awayLabel="PSG"
        initialHome={0}
        initialAway={99}
      />,
    );
    expect(
      screen.getByRole("button", { name: "הפחתת שער לArsenal" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "הוספת שער לPSG" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "הוספת שער לArsenal" }));
    expect(container.querySelector('input[name="predictedHome"]')).toHaveValue(
      "1",
    );
    expect(container.querySelector('input[name="predictedAway"]')).toHaveValue(
      "99",
    );
    fireEvent.click(screen.getByRole("button", { name: "הפחתת שער לPSG" }));
    expect(container.querySelector('input[name="predictedAway"]')).toHaveValue(
      "98",
    );
  });
  it("waits for confirmation, prevents duplicate writes, clears the draft and navigates once", async () => {
    let finish!: (value: unknown) => void;
    const fetch = vi.fn<
      (...args: Parameters<typeof globalThis.fetch>) => Promise<unknown>
    >(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <SaveFeedbackProvider>
        <PredictionForm {...props} />
      </SaveFeedbackProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "הוספת שער לArsenal" }));
    const form = screen
      .getByRole("button", { name: "שמירה והבא ←" })
      .closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByText("הניחוש נשמר בהצלחה")).toBeNull();
    await act(async () =>
      finish(
        reply({
          ...success,
          predictedHome: 1,
          continuation: { nextMatchId: nextId, remaining: 1 },
        }),
      ),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/predictions/${nextId}`),
    );
    expect(push).toHaveBeenCalledOnce();
    expect(screen.getByText("הניחוש נשמר בהצלחה")).toBeVisible();
    expect(localStorage.length).toBe(0);
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({
      advance: true,
      predictedHome: 1,
      predictedAway: 0,
    });
  });
  it("returns to the list with a completion confirmation after the last open prediction", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reply({
          ...success,
          continuation: { nextMatchId: null, remaining: 0 },
        }),
      ),
    );
    render(
      <SaveFeedbackProvider>
        <PredictionForm {...props} />
      </SaveFeedbackProvider>,
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "שמירה והבא ←" }).closest("form")!,
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/predictions"));
    expect(screen.getByText(/סיימתם את המשחקים הפתוחים/)).toBeVisible();
  });
  it.each(["locked", "network"])(
    "stays on the game and retains input after %s failure",
    async (failure) => {
      vi.stubGlobal(
        "fetch",
        failure === "network"
          ? vi.fn().mockRejectedValue(new Error("offline"))
          : vi
              .fn()
              .mockResolvedValue(
                reply({ status: "error", code: "locked" }, false),
              ),
      );
      const { container } = render(
        <SaveFeedbackProvider>
          <PredictionForm {...props} />
        </SaveFeedbackProvider>,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "הוספת שער לArsenal" }),
      );
      fireEvent.submit(
        screen.getByRole("button", { name: "שמירה והבא ←" }).closest("form")!,
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "שמירה והבא ←" }),
        ).toBeEnabled(),
      );
      expect(push).not.toHaveBeenCalled();
      expect(screen.queryByText("הניחוש נשמר בהצלחה")).toBeNull();
      expect(
        container.querySelector('input[name="predictedHome"]'),
      ).toHaveValue("1");
      expect(localStorage.length).toBe(1);
    },
  );
  it("keeps confirmed success when loading the next game fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(success)));
    render(
      <SaveFeedbackProvider>
        <PredictionForm {...props} />
      </SaveFeedbackProvider>,
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "שמירה והבא ←" }).closest("form")!,
    );
    await waitFor(() =>
      expect(screen.getByText("הניחוש נשמר בהצלחה")).toBeVisible(),
    );
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "לרשימת המשחקים ←" }),
    ).toHaveAttribute("href", "/predictions");
    expect(screen.queryByText(/סיימתם את המשחקים הפתוחים/)).toBeNull();
  });
});
