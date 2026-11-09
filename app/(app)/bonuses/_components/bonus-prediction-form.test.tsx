import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { BonusPredictionForm } from "./bonus-prediction-form";
import { SaveFeedbackProvider } from "@/app/_components/save-feedback";
afterEach(() => vi.unstubAllGlobals());
const props = {
  categoryId: "cat",
  slots: [{ id: "slot", index: 1, points: 20, pickLabel: "Michael Olise" }],
};
describe("bonus save feedback", () => {
  it("shows the saved category in a top toast only after the server confirms it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "success", categoryId: "cat" }),
      }),
    );
    render(
      <SaveFeedbackProvider>
        <BonusPredictionForm {...props} categoryLabel="מלך הבישולים" />
      </SaveFeedbackProvider>,
    );
    expect(screen.queryByText("הבונוסים נשמרו בהצלחה")).toBeNull();
    fireEvent.submit(screen.getByRole("button").closest("form")!);
    await waitFor(() =>
      expect(screen.getByText("הבונוסים נשמרו בהצלחה")).toBeVisible(),
    );
    expect(screen.getByText(/הבחירות במלך הבישולים/)).toBeVisible();
  });
  it("finishes saving without waiting for a full page render and clears success after editing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "success", categoryId: "cat" }),
      }),
    );
    render(<BonusPredictionForm {...props} />);
    fireEvent.submit(screen.getByRole("button").closest("form")!);
    await waitFor(() => expect(screen.getByRole("status")).toBeVisible());
    expect(screen.getByRole("button")).toBeEnabled();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Lamine Yamal" },
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("preserves the choice and releases the button on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    render(<BonusPredictionForm {...props} />);
    fireEvent.submit(screen.getByRole("button").closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(screen.getByRole("textbox")).toHaveValue("מייקל אוליסה");
    expect(screen.getByRole("button")).toBeEnabled();
  });
});

describe("localized bonus selections", () => {
  it("shows Hebrew but submits the canonical existing pick when no roster option is available", () => {
    render(<BonusPredictionForm {...props} />);
    expect(screen.getByRole("textbox")).toHaveValue("מייקל אוליסה");
    const payload = document.querySelector<HTMLInputElement>(
      'input[name="picks"]',
    )!;
    expect(JSON.parse(payload.value)[0].pickLabel).toBe("Michael Olise");
  });
  it("accepts English or Hebrew and preserves the same player reference", () => {
    render(
      <BonusPredictionForm
        {...props}
        options={[
          { refId: "olise", label: "Michael Olise", team: "FC Bayern München" },
        ]}
      />,
    );
    for (const value of [
      "Michael Olise · FC Bayern München",
      "מייקל אוליסה · באיירן מינכן",
    ]) {
      fireEvent.change(screen.getByRole("combobox"), { target: { value } });
      expect(screen.getByRole("combobox")).toHaveValue(
        "מייקל אוליסה · באיירן מינכן",
      );
      const payload = document.querySelector<HTMLInputElement>(
        'input[name="picks"]',
      )!;
      expect(JSON.parse(payload.value)[0]).toMatchObject({
        pickRefId: "olise",
        pickLabel: "Michael Olise",
      });
    }
  });
});
