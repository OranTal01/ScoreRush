"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { matchDetail as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import {
  submitMatchPrediction,
  type PredictionErrorCode,
  type SubmitMatchPredictionState,
} from "../actions";

const initialState: SubmitMatchPredictionState = { status: "idle" };

const ERROR_MESSAGES: Record<PredictionErrorCode, string> = {
  locked: content.errorLocked,
  not_a_member: content.errorNotAMember,
  not_found: content.errorNotFound,
  unauthenticated: content.errorUnauthenticated,
  invalid_input: content.errorInvalidInput,
  generic: content.saveError,
};

function ScoreStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-semibold text-[var(--text-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="הפחתת שער"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-9 w-9 items-center justify-center text-lg font-bold text-[var(--text-primary)]"
          style={{
            background: colors.surfaceCard2,
            borderRadius: "var(--radius-button)",
          }}
        >
          −
        </button>
        <span className="w-7 text-center text-xl font-black tabular-nums text-[var(--text-primary)]">
          {value}
        </span>
        <button
          type="button"
          aria-label="הוספת שער"
          onClick={() => onChange(Math.min(99, value + 1))}
          className="flex h-9 w-9 items-center justify-center text-lg font-bold text-[var(--text-primary)]"
          style={{
            background: colors.surfaceCard2,
            borderRadius: "var(--radius-button)",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 text-sm font-bold text-[#080B14] transition-opacity disabled:opacity-60"
      style={{
        background: colors.interactive,
        borderRadius: "var(--radius-button)",
      }}
    >
      {pending ? content.saveLoading : content.saveIdle}
    </button>
  );
}

/** Score entry — UX-BLUEPRINT.md flow B: "adjust score with ± controls → save
 * (idle → pressed → loading → success/saved) → editable again anytime before
 * lock". The real lock backstop is server-side (RLS + the action's own
 * pre-check); this component only renders at all once the caller has already
 * confirmed the match isn't locked. */
export function PredictionForm({
  matchId,
  homeLabel,
  awayLabel,
  initialHome,
  initialAway,
}: {
  matchId: string;
  homeLabel: string;
  awayLabel: string;
  initialHome: number;
  initialAway: number;
}) {
  const [state, formAction] = useActionState(
    submitMatchPrediction,
    initialState,
  );
  const [home, setHome] = useState(initialHome);
  const [away, setAway] = useState(initialAway);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 border-t pt-3"
      style={{ borderColor: colors.border }}
    >
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="predictedHome" value={home} />
      <input type="hidden" name="predictedAway" value={away} />

      <div className="flex items-center justify-center gap-6">
        <ScoreStepper label={homeLabel} value={home} onChange={setHome} />
        <span className="text-lg font-black text-[var(--text-muted)]">–</span>
        <ScoreStepper label={awayLabel} value={away} onChange={setAway} />
      </div>

      {state.status === "error" && (
        <span
          role="alert"
          className="text-center text-xs font-semibold text-[var(--danger)]"
        >
          {ERROR_MESSAGES[state.code]}
        </span>
      )}
      {state.status === "success" && (
        <span className="text-center text-xs font-semibold text-[var(--success)]">
          {content.saveSuccess}
        </span>
      )}

      <SubmitButton />
      <span className="text-center text-[11px] text-[var(--text-muted)]">
        {content.editableUntilLock}
      </span>
    </form>
  );
}
