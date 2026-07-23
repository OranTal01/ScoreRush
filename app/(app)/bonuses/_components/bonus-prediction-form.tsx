"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { bonuses as content, common } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import {
  submitBonusPrediction,
  type BonusPredictionErrorCode,
  type SubmitBonusPredictionState,
} from "../actions";

const initialState: SubmitBonusPredictionState = { status: "idle" };

const ERROR_MESSAGES: Record<BonusPredictionErrorCode, string> = {
  invalid_input: content.errorInvalidInput,
  unauthenticated: content.errorUnauthenticated,
  not_a_member: content.errorNotAMember,
  locked: content.errorLocked,
  generic: content.saveError,
};

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

/** One bonus category's slot picks — screen 10 (UX-BLUEPRINT.md §3): free-text
 * pick per slot (no synced player/team roster to pick from, matches the
 * `bonus_predictions.pick_label` text column), saved together as one submit
 * since every slot in a category shares the same lock. The real lock
 * backstop is server-side (RLS + the action's own pre-check); this
 * component only renders once the caller has confirmed the category isn't
 * locked. */
export function BonusPredictionForm({
  categoryId,
  slots,
}: {
  categoryId: string;
  slots: { id: string; index: number; points: number; pickLabel: string }[];
}) {
  const [state, formAction] = useActionState(
    submitBonusPrediction,
    initialState,
  );
  const [labels, setLabels] = useState<Record<string, string>>(
    Object.fromEntries(slots.map((s) => [s.id, s.pickLabel])),
  );

  const picks = slots.map((s) => ({ slotId: s.id, pickLabel: labels[s.id] ?? "" }));

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="picks" value={JSON.stringify(picks)} />

      <ul className="flex flex-col gap-1.5">
        {slots.map((slot) => (
          <li key={slot.id} className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center text-[10.5px] font-bold text-[var(--text-primary)]"
              style={{ borderRadius: "50%", background: colors.surfaceCard2 }}
            >
              {slot.index}
            </span>
            <input
              type="text"
              value={labels[slot.id] ?? ""}
              onChange={(e) =>
                setLabels((prev) => ({ ...prev, [slot.id]: e.target.value }))
              }
              placeholder={content.pickPlaceholder}
              maxLength={200}
              className="min-w-0 flex-1 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
              style={{
                background: colors.surfaceCard2,
                borderRadius: "var(--radius-button)",
              }}
            />
            <span className="ltr shrink-0 text-[11px] font-bold text-[var(--gold)] tabular-nums">
              {slot.points} {common.points}
            </span>
          </li>
        ))}
      </ul>

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
