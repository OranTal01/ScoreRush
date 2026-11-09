"use client";
import {
  footballName,
  footballChoiceLabel,
  resolveFootballChoice,
} from "@/lib/content/football-names";

import { useRef, useState, type FormEvent } from "react";
import { useSaveFeedback } from "@/app/_components/save-feedback";
import { bonuses as content, common } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import {
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

function SubmitButton({ pending }: { pending: boolean }) {
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
  categoryLabel,
  slots,
  options = [],
}: {
  categoryId: string;
  categoryLabel?: string;
  slots: {
    id: string;
    index: number;
    points: number;
    pickLabel: string;
    pickRefId?: string | null;
  }[];
  options?: { refId: string; label: string; team?: string }[];
}) {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [transportError, setTransportError] = useState("");
  const showFeedback = useSaveFeedback();
  const sending = useRef(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setState(initialState);
    setTransportError("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch("/api/bonus-predictions", {
        method: "POST",
        body: data,
        signal: controller.signal,
      });
      const result: SubmitBonusPredictionState = await response.json();
      if (result.status !== "success" && result.status !== "error")
        throw new Error("Invalid response");
      if (!response.ok && result.status !== "error")
        throw new Error("Request failed");
      if (result.status === "success" && result.categoryId !== categoryId)
        throw new Error("Wrong category");
      setState(result);
      showFeedback(
        result.status === "success"
          ? {
              title: "הבונוסים נשמרו בהצלחה",
              description: categoryLabel
                ? `הבחירות ב${categoryLabel} מעודכנות.`
                : "הבחירות שלכם מעודכנות.",
            }
          : {
              tone: "error",
              title: "הבונוסים לא נשמרו",
              description: ERROR_MESSAGES[result.code] ?? content.saveError,
            },
      );
    } catch {
      setTransportError(
        "לא התקבל אישור שמירה. הבחירות נשארו כאן; בדקו את החיבור ונסו שוב. אם מרעננים, יש לבדוק מה נשמר.",
      );
      showFeedback({
        tone: "error",
        title: "לא התקבל אישור שמירה",
        description: "הבחירות נשארו כאן. בדקו את החיבור ונסו שוב.",
      });
    } finally {
      clearTimeout(timeout);
      setPending(false);
      sending.current = false;
    }
  }
  const optionLabel = footballChoiceLabel;
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      slots.map((s) => {
        const choice = options.find((option) => option.refId === s.pickRefId);
        return [s.id, choice ? optionLabel(choice) : footballName(s.pickLabel)];
      }),
    ),
  );

  const picks = slots.map((s) => {
    const choice = resolveFootballChoice(options, labels[s.id] ?? "");
    const unchanged = labels[s.id] === footballName(s.pickLabel);
    return {
      slotId: s.id,
      pickLabel:
        choice?.label ?? (unchanged ? s.pickLabel : labels[s.id]) ?? "",
      ...(choice
        ? { pickRefId: choice.refId }
        : unchanged && s.pickRefId
          ? { pickRefId: s.pickRefId }
          : {}),
    };
  });

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="picks" value={JSON.stringify(picks)} />

      {options.length > 0 && (
        <>
          <datalist id={`bonus-options-${categoryId}`}>
            {options.flatMap((option) => [
              <option key={`${option.refId}:he`} value={optionLabel(option)} />,
              <option
                key={`${option.refId}:en`}
                value={footballChoiceLabel(option, "en")}
                label={optionLabel(option)}
              />,
            ])}
          </datalist>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            חפשו שם בעברית או באנגלית ובחרו מההצעות. שחקן חסר? אפשר להקליד את
            שמו.
          </p>
        </>
      )}
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
              id={`bonus-pick-${slot.id}`}
              type="text"
              list={options.length ? `bonus-options-${categoryId}` : undefined}
              autoComplete="off"
              dir="auto"
              disabled={pending}
              value={labels[slot.id] ?? ""}
              onChange={(e) => {
                setState(initialState);
                setTransportError("");
                const choice = resolveFootballChoice(options, e.target.value);
                setLabels((prev) => ({
                  ...prev,
                  [slot.id]: choice ? optionLabel(choice) : e.target.value,
                }));
              }}
              placeholder="חיפוש שם…"
              aria-label={content.pickInputLabel(slot.index)}
              maxLength={200}
              className="min-h-12 min-w-0 flex-1 px-2.5 py-2 text-sm font-semibold text-[var(--text-primary)]"
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
        <span
          role="status"
          className="text-center text-xs font-semibold text-[var(--success)]"
        >
          {content.saveSuccess}
        </span>
      )}

      {transportError && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {transportError}
        </p>
      )}
      <SubmitButton pending={pending} />
      <span className="text-center text-[11px] text-[var(--text-muted)]">
        {content.editableUntilLock}
      </span>
    </form>
  );
}
