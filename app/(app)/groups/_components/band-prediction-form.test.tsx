import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
vi.mock("../actions", () => ({ submitGroupPrediction: vi.fn() }));
import { BandPredictionForm } from "./band-prediction-form";
describe("saved band summary", () => {
  it("shows saved teams first and opens controls only on edit", () => {
    render(
      <BandPredictionForm
        group="league"
        teams={[
          { id: "a", label: "Arsenal" },
          { id: "b", label: "Bayern" },
        ]}
        config={{ mode: "bands", sizes: [1, 1] }}
        savedOrder={["a", "b"]}
        points={3}
      />,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Arsenal")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "עריכת השיבוץ" }));
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(
      screen.getByRole("combobox", { name: "טווח המיקום של Arsenal" }),
    ).toHaveValue("0");
  });
});
