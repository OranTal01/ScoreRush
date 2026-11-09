"use client";
import Link from "next/link";
import { useSaveFeedback } from "./save-feedback";
import { usePredictionDraft } from "./use-prediction-draft";
import { useEffect, useRef, useState } from "react";
import type { MatchWithTeams, MatchOwnPrediction } from "@/lib/matches/list";
import { formatMatchTime } from "@/lib/time";
import {
  canEditPrediction,
  hasSubmittedPrediction,
} from "@/lib/matches/progress";

const errors: Record<string, string> = {
  locked: "המשחק ננעל. הניחוש הזה לא נשמר.",
  unauthenticated: "החיבור הסתיים. התחברו מחדש כדי לשמור.",
  invalid_input: "יש להזין לכל קבוצה מספר שערים שלם בין 0 ל־99.",
  generic: "לא התקבל אישור שמירה. בדקו את החיבור ונסו שוב.",
};
export function QuickPrediction({
  match,
  draftScope,
  now,
  onSaved,
  onDirty,
}: {
  match: MatchWithTeams;
  draftScope: string;
  now: number;
  onSaved: (id: string, prediction: MatchOwnPrediction) => void;
  onDirty: (id: string, dirty: boolean) => void;
}) {
  const submitted = hasSubmittedPrediction(match);
  const editable = canEditPrediction(match, now);
  const initial = {
    home: submitted ? String(match.ownPrediction!.predictedHome) : "",
    away: submitted ? String(match.ownPrediction!.predictedAway) : "",
  };
  const baseline = submitted
    ? `${initial.home}:${initial.away}`
    : "unsubmitted";
  const draft = usePredictionDraft({
    scope: draftScope,
    matchId: match.id,
    initial,
    baseline,
    locked: !editable,
  });
  const { home, away, setHome, setAway } = draft;
  const [saved, setSaved] = useState(submitted ? baseline : null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState("");
  const showFeedback = useSaveFeedback();
  const dirty = `${home}:${away}` !== saved && (home !== "" || away !== "");
  useEffect(() => {
    onDirty(match.id, dirty);
    return () => onDirty(match.id, false);
  }, [dirty, match.id, onDirty]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || !editable || !draft.ready) return;
    if (!/^\d{1,2}$/.test(home) || !/^\d{1,2}$/.test(away)) {
      setError(errors.invalid_input);
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/match-predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          predictedHome: Number(home),
          predictedAway: Number(away),
        }),
        signal: AbortSignal.timeout(22000),
      });
      const result = await response.json();
      if (!response.ok || result.status !== "success")
        throw new Error(errors[result.code] ?? errors.generic);
      setSaved(`${home}:${away}`);
      draft.submitted(result.predictedHome, result.predictedAway);
      showFeedback({
        title: "הניחוש נשמר בהצלחה",
        description: `\u2068${match.homeTeam?.shortName ?? "בית"}: ${result.predictedHome}\u2069 · \u2068${match.awayTeam?.shortName ?? "חוץ"}: ${result.predictedAway}\u2069`,
      });
      onSaved(match.id, {
        predictedHome: result.predictedHome,
        predictedAway: result.predictedAway,
        isDefault: false,
        pointsEarned: null,
        outcome: null,
      });
    } catch (err) {
      setError(
        err instanceof Error && Object.values(errors).includes(err.message)
          ? err.message
          : errors.generic,
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      data-quick-match={match.id}
      className={`quick-pick ${saved && !dirty ? "quick-pick-saved" : ""}`}
      aria-label={`ניחוש ${match.homeTeam?.shortName} נגד ${match.awayTeam?.shortName}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
        <time dateTime={match.kickoff}>{formatMatchTime(match.kickoff)}</time>
        <span
          className={
            saved && !dirty ? "text-[var(--success)]" : "text-[var(--gold)]"
          }
        >
          {busy
            ? "שומר…"
            : !editable
              ? "נעול"
              : saved && !dirty
                ? "✓ נשמר"
                : dirty
                  ? "שינויים שטרם נשמרו"
                  : "טרם ניחשתם"}
        </span>
      </div>
      {match.retrospectiveEntry && (
        <p className="mt-2 text-[11px] text-[var(--gold)]">
          הזנת הבחירה המקורית שנשלחה לפני המשחק
        </p>
      )}
      <div
        dir="rtl"
        className="my-4 grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-end gap-2"
      >
        {[
          { team: match.homeTeam, value: home, set: setHome, side: "בית" },
          { team: match.awayTeam, value: away, set: setAway, side: "חוץ" },
        ].map((item, i) => (
          <div
            key={item.side}
            className={
              i ? "col-start-3 row-start-1" : "col-start-1 row-start-1"
            }
          >
            <label className="flex min-w-0 flex-col items-center gap-2 text-center text-sm font-bold">
              <bdi className="flex min-h-10 items-center leading-5 [overflow-wrap:anywhere]">
                {item.team?.shortName ?? item.side}
              </bdi>
              <input
                aria-label={`שערים של ${item.team?.shortName ?? item.side}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]{1,2}"
                maxLength={2}
                required
                autoComplete="off"
                disabled={busy || !editable || !draft.ready}
                value={item.value}
                placeholder="—"
                onChange={(e) => {
                  if (/^\d{0,2}$/.test(e.target.value)) {
                    item.set(e.target.value);
                    setError("");
                  }
                }}
                className="h-16 w-full max-w-28 rounded-xl border border-white/15 bg-[var(--bg-page)] text-center !text-3xl font-black tabular-nums disabled:opacity-60"
                dir="ltr"
              />
            </label>
          </div>
        ))}
        <span
          className="col-start-2 row-start-1 self-end pb-5 text-center text-[var(--text-muted)]"
          aria-hidden
        >
          :
        </span>
      </div>
      {error && (
        <p role="alert" className="mb-3 text-xs leading-5 text-[var(--danger)]">
          {error}
        </p>
      )}
      {draft.notice && (
        <p role="status" className="mb-3 text-xs leading-5 text-[var(--gold)]">
          {draft.notice}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={
            busy || !editable || !draft.ready || (saved !== null && !dirty)
          }
          className="action-primary flex-1 disabled:opacity-50"
        >
          {busy ? "שומר…" : saved && !dirty ? "הניחוש שמור ✓" : "שמירה והבא ←"}
        </button>
        <Link
          href={`/predictions/${match.id}`}
          className="flex min-h-11 items-center text-xs text-[var(--text-secondary)]"
        >
          פרטים
        </Link>
      </div>
    </form>
  );
}
