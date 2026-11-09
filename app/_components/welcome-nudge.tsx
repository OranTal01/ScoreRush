"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export const welcomeKey = (scope: string) => `scorerush:welcome:v1:${scope}`;
export function WelcomeNudge({ scope }: { scope: string }) {
  const [visible, setVisible] = useState(false);
  // Browser-only preferences are reconciled after hydration.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(localStorage.getItem(`${welcomeKey(scope)}:hidden`) !== "yes");
    } catch {
      setVisible(true);
    }
  }, [scope]);
  if (!visible) return null;
  return (
    <aside className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--interactive)]/20 bg-[var(--interactive)]/5 p-4">
      <Link href="/welcome" className="min-w-0 flex-1">
        <b className="block text-sm text-[var(--interactive)]">
          חדשים כאן? נכנסים למשחק יחד ←
        </b>
        <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
          כינוי, החוקים, ניחוש ראשון והתראות — כמה צעדים קצרים.
        </span>
      </Link>
      <button
        aria-label="סגירת ההיכרות"
        className="h-11 w-11 shrink-0 rounded-xl text-xl text-[var(--text-muted)]"
        onClick={() => {
          setVisible(false);
          try {
            localStorage.setItem(`${welcomeKey(scope)}:hidden`, "yes");
          } catch {}
        }}
      >
        ×
      </button>
    </aside>
  );
}
