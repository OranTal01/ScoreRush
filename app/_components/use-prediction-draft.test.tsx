import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { usePredictionDraft } from "./use-prediction-draft";
import { draftKey } from "@/lib/predictions/drafts";
const options = {
  scope: "cup:me",
  matchId: "m",
  initial: { home: "", away: "" },
  baseline: "unsubmitted",
  locked: false,
};
beforeEach(() => localStorage.clear());
describe("draft lifecycle", () => {
  it("survives remount, clears only after confirmed save, and stays private to its account", () => {
    const hook = renderHook(() => usePredictionDraft(options));
    act(() => {
      hook.result.current.setHome("0");
      hook.result.current.setAway("2");
    });
    hook.unmount();
    const other = renderHook(() =>
      usePredictionDraft({ ...options, scope: "cup:other" }),
    );
    expect(other.result.current.home).toBe("");
    other.unmount();
    const restored = renderHook(() => usePredictionDraft(options));
    expect(restored.result.current.home).toBe("0");
    expect(restored.result.current.away).toBe("2");
    expect(restored.result.current.notice).toMatch(/שוחזרה/);
    act(() => restored.result.current.submitted(0, 2));
    expect(localStorage.getItem(draftKey(options.scope, "m"))).toBeNull();
  });
  it("drops drafts after a server-side change or lock and prevents more edits", () => {
    const hook = renderHook((props) => usePredictionDraft(props), {
      initialProps: options,
    });
    act(() => hook.result.current.setHome("2"));
    hook.rerender({
      ...options,
      initial: { home: "1", away: "1" },
      baseline: "1:1",
    });
    expect(hook.result.current.home).toBe("1");
    act(() => hook.result.current.setHome("3"));
    hook.rerender({ ...options, locked: true });
    expect(localStorage.getItem(draftKey(options.scope, "m"))).toBeNull();
    act(() => hook.result.current.setHome("9"));
    expect(hook.result.current.home).toBe("");
  });
  it("allows manual submission when device storage is unavailable", () => {
    const blocked = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const hook = renderHook(() => usePredictionDraft(options));
    act(() => hook.result.current.setHome("2"));
    expect(hook.result.current.home).toBe("2");
    expect(hook.result.current.ready).toBe(true);
    expect(hook.result.current.notice).toMatch(/לא נשמרה/);
    blocked.mockRestore();
  });
});
