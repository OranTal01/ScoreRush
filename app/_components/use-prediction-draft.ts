"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  decodeDraft,
  draftKey,
  type DraftScore,
} from "@/lib/predictions/drafts";

export function usePredictionDraft({
  scope,
  matchId,
  initial,
  baseline,
  locked,
}: {
  scope: string;
  matchId: string;
  initial: DraftScore;
  baseline: string;
  locked: boolean;
}) {
  const key = draftKey(scope, matchId);
  const [score, setScore] = useState(initial);
  const scoreRef = useRef(initial);
  const baselineRef = useRef(baseline);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const initialHome = initial.home;
  const initialAway = initial.away;
  useEffect(() => {
    baselineRef.current = baseline;
    const fresh = { home: initialHome, away: initialAway };
    scoreRef.current = fresh;
    // Reconcile browser-only persisted input after hydration or server baseline changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScore(fresh);
    try {
      const raw = localStorage.getItem(key);
      const draft = locked ? null : decodeDraft(raw, baseline, Date.now());
      if (draft) {
        const restored = { home: draft.home, away: draft.away };
        scoreRef.current = restored;
        setScore(restored);
        setNotice("טיוטה שוחזרה מהמכשיר · טרם נשלחה");
      } else if (raw) {
        localStorage.removeItem(key);
        setNotice(
          locked
            ? "המשחק ננעל. הטיוטה לא נשלחה."
            : "הטיוטה הישנה הוסרה. מוצג הניחוש המעודכן מהאתר.",
        );
      }
    } catch {
      setNotice(
        "שמירת טיוטה במכשיר אינה זמינה. יש לשלוח את הניחוש לפני היציאה.",
      );
    }
    setReady(true);
  }, [key, baseline, locked, initialHome, initialAway]);
  function update(side: keyof DraftScore, value: string) {
    if (locked || !ready) return;
    const next = { ...scoreRef.current, [side]: value };
    scoreRef.current = next;
    setScore(next);
    try {
      if (
        `${next.home}:${next.away}` === baselineRef.current ||
        (!next.home && !next.away)
      ) {
        localStorage.removeItem(key);
        setNotice("");
      } else {
        localStorage.setItem(
          key,
          JSON.stringify({
            ...next,
            version: 1,
            baseline: baselineRef.current,
            updatedAt: Date.now(),
          }),
        );
        setNotice("טיוטה נשמרה במכשיר · טרם נשלחה");
      }
    } catch {
      setNotice("הטיוטה לא נשמרה במכשיר. יש לשלוח את הניחוש לפני היציאה.");
    }
  }
  const submitted = useCallback(
    (home: number, away: number) => {
      baselineRef.current = `${home}:${away}`;
      try {
        localStorage.removeItem(key);
      } catch {
        /* Browser storage may be blocked. */
      }
      setNotice("");
    },
    [key],
  );
  return {
    ...score,
    setHome: (value: string) => update("home", value),
    setAway: (value: string) => update("away", value),
    ready,
    notice,
    submitted,
  };
}
