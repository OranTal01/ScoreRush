import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiseDemo } from "./rise-demo";

describe("RiseDemo", () => {
  it("renders the motion pipeline smoke-test copy", () => {
    render(<RiseDemo />);
    expect(screen.getByText(/spring.soft/)).toBeInTheDocument();
  });
});
