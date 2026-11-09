"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Feedback = {
  title: string;
  description?: string;
  tone?: "success" | "error";
};
const SaveFeedback = createContext<(feedback: Feedback) => void>(() => {});
export const useSaveFeedback = () => useContext(SaveFeedback);

/** Lives in the shared app layout, so confirmation survives a route change. */
export function SaveFeedbackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toast, setToast] = useState<(Feedback & { id: number }) | null>(null);
  const show = useCallback(
    (feedback: Feedback) => setToast({ ...feedback, id: Date.now() }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <SaveFeedback.Provider value={show}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] z-[80] mx-auto w-auto max-w-[460px]"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast && (
          <div
            data-save-toast
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-[#141c2b] p-3 shadow-2xl ${toast.tone === "error" ? "border-[var(--danger)]/60" : "border-[var(--success)]/60"}`}
          >
            <span
              aria-hidden
              className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-black ${toast.tone === "error" ? "bg-[var(--danger)]/15 text-[var(--danger)]" : "bg-[var(--success)]/15 text-[var(--success)]"}`}
            >
              {toast.tone === "error" ? "!" : "✓"}
            </span>
            <div className="min-w-0 flex-1 py-1">
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {toast.title}
              </p>
              {toast.description && (
                <p className="mt-1 text-xs leading-5 [overflow-wrap:anywhere] text-[var(--text-secondary)]">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="סגירת הודעת השמירה"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-[var(--text-secondary)] hover:bg-white/5"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </SaveFeedback.Provider>
  );
}
