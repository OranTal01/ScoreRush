import { render, screen, fireEvent, act } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { SaveFeedbackProvider, useSaveFeedback } from "./save-feedback";
function Save() {
  const show = useSaveFeedback();
  return (
    <button
      onClick={() => show({ title: "נשמר", description: "המשחק הראשון" })}
    >
      שמור
    </button>
  );
}
afterEach(() => vi.useRealTimers());
it("keeps confirmation across a page change and can dismiss it", () => {
  const { rerender } = render(
    <SaveFeedbackProvider>
      <Save />
    </SaveFeedbackProvider>,
  );
  fireEvent.click(screen.getByText("שמור"));
  rerender(
    <SaveFeedbackProvider>
      <h1>המשחק הבא</h1>
    </SaveFeedbackProvider>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("המשחק הראשון");
  fireEvent.click(screen.getByRole("button", { name: "סגירת הודעת השמירה" }));
  expect(screen.queryByRole("status")).toBeNull();
});
it("closes automatically without leaving an old message on another game", () => {
  vi.useFakeTimers();
  render(
    <SaveFeedbackProvider>
      <Save />
    </SaveFeedbackProvider>,
  );
  fireEvent.click(screen.getByText("שמור"));
  act(() => vi.advanceTimersByTime(6000));
  expect(screen.queryByRole("status")).toBeNull();
});
