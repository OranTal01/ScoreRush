"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { groups as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import {
  submitGroupPrediction,
  type GroupPredictionErrorCode,
  type SubmitGroupPredictionState,
} from "../actions";

const initialState: SubmitGroupPredictionState = { status: "idle" };

const ERROR_MESSAGES: Record<GroupPredictionErrorCode, string> = {
  invalid_input: content.errorInvalidInput,
  unauthenticated: content.errorUnauthenticated,
  not_a_member: content.errorNotAMember,
  finalized: content.errorFinalized,
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

/** Group ranking prediction — screen 11 (UX-BLUEPRINT.md §3): reorder the
 * group's teams with ↑/↓ controls (no drag-and-drop library, matching the
 * rest of the app's dependency-minimal conventions), save via server action.
 * The real lock backstop is server-side (RLS `finalized` check + the
 * action's own re-validation) — this component only renders once the caller
 * has already confirmed the group isn't finalized. */
export function GroupPredictionForm({
  group,
  teams,
}: {
  group: string;
  teams: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState(
    submitGroupPrediction,
    initialState,
  );
  const [order, setOrder] = useState(teams);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 border-t pt-3"
      style={{ borderColor: colors.border }}
    >
      <input type="hidden" name="group" value={group} />
      <input
        type="hidden"
        name="predictedOrder"
        value={JSON.stringify(order.map((t) => t.id))}
      />

      <ol className="flex flex-col gap-1.5">
        {order.map((team, index) => (
          <li
            key={team.id}
            className="flex items-center justify-between gap-2 px-2 py-1.5"
            style={{
              background: colors.surfaceCard2,
              borderRadius: "var(--radius-button)",
            }}
          >
            <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
              <span className="ltr text-[var(--text-muted)] tabular-nums">
                {index + 1}.
              </span>
              {team.label}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                aria-label={content.moveUp}
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="flex h-11 w-11 items-center justify-center text-sm font-bold text-[var(--text-primary)] disabled:opacity-30"
                style={{ borderRadius: "var(--radius-button)" }}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={content.moveDown}
                onClick={() => move(index, 1)}
                disabled={index === order.length - 1}
                className="flex h-11 w-11 items-center justify-center text-sm font-bold text-[var(--text-primary)] disabled:opacity-30"
                style={{ borderRadius: "var(--radius-button)" }}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>

      {state.status === "error" && (
        <span
          role="alert"
          className="text-center text-xs font-semibold text-[var(--danger)]"
        >
          {ERROR_MESSAGES[state.code]}
        </span>
      )}
      {state.status === "success" && (
        <span
          role="status"
          className="text-center text-xs font-semibold text-[var(--success)]"
        >
          {content.saveSuccess}
        </span>
      )}

      <SubmitButton />
      <span className="text-center text-[11px] text-[var(--text-muted)]">
        {content.editableUntilFinalized}
      </span>
    </form>
  );
}
