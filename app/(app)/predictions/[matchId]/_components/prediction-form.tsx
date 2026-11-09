"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSaveFeedback } from "@/app/_components/save-feedback";
import { usePredictionDraft } from "@/app/_components/use-prediction-draft";
import { matchDetail as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import {
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
  disabled,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl bg-white/[0.025] px-1 py-3">
      <bdi className="min-h-8 px-1 text-center text-xs font-semibold [overflow-wrap:anywhere] text-[var(--text-secondary)]">
        {label}
      </bdi>
      <output
        aria-label={`שערים של ${label}`}
        className="text-center text-3xl font-black tabular-nums"
      >
        {value || "—"}
      </output>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`הפחתת שער ל${label}`}
          disabled={disabled || value === "0"}
          onClick={() => onChange(String(Math.max(0, Number(value) - 1)))}
          className="flex h-11 w-11 items-center justify-center text-lg font-bold text-[var(--text-primary)] disabled:opacity-30"
          style={{
            background: colors.surfaceCard2,
            borderRadius: "var(--radius-button)",
          }}
        >
          −
        </button>
        <button
          type="button"
          aria-label={`הוספת שער ל${label}`}
          disabled={disabled || value === "99"}
          onClick={() => onChange(String(Math.min(99, Number(value) + 1)))}
          className="flex h-11 w-11 items-center justify-center text-lg font-bold text-[var(--text-primary)]"
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

function SubmitButton({
  pending,
  disabled,
}: {
  pending: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full py-3 text-sm font-bold text-[#080B14] transition-opacity disabled:opacity-60"
      style={{
        background: colors.interactive,
        borderRadius: "var(--radius-button)",
      }}
    >
      {pending ? content.saveLoading : "שמירה והבא ←"}
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
  draftScope,
  hasSubmitted,
  lockTime,
  retrospective = false,
}: {
  matchId: string;
  draftScope: string;
  hasSubmitted: boolean;
  lockTime: string;
  retrospective?: boolean;
  homeLabel: string;
  awayLabel: string;
  initialHome: number;
  initialAway: number;
}) {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const sending = useRef(false);
  const [moving, setMoving] = useState(false);
  const [destination, setDestination] = useState("/predictions");
  const [transportError, setTransportError] = useState("");
  const router = useRouter();
  const showFeedback = useSaveFeedback();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const locked = !retrospective && now >= Date.parse(lockTime);
  const baseline =
    state.status === "success"
      ? `${state.predictedHome}:${state.predictedAway}`
      : hasSubmitted
        ? `${initialHome}:${initialAway}`
        : "unsubmitted";
  const draft = usePredictionDraft({
    scope: draftScope,
    matchId,
    initial: {
      home: String(
        state.status === "success" ? state.predictedHome : initialHome,
      ),
      away: String(
        state.status === "success" ? state.predictedAway : initialAway,
      ),
    },
    baseline,
    locked,
  });
  const { home, away, setHome, setAway, submitted } = draft;
  const disabled = pending || moving || locked || !draft.ready;
  const confirmedSaved =
    (state.status === "success" &&
      String(state.predictedHome) === home &&
      String(state.predictedAway) === away) ||
    (hasSubmitted &&
      String(initialHome) === home &&
      String(initialAway) === away);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || disabled) return;
    if (!/^\d{1,2}$/.test(home) || !/^\d{1,2}$/.test(away)) {
      setState({ status: "error", code: "invalid_input" });
      return;
    }
    sending.current = true;
    setPending(true);
    setTransportError("");
    try {
      const response = await fetch("/api/match-predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          predictedHome: Number(home),
          predictedAway: Number(away),
          advance: true,
        }),
        signal: AbortSignal.timeout(22000),
      });
      const result: SubmitMatchPredictionState = await response.json();
      if (!alive.current) return;
      if (result.status === "error") {
        setState(result);
        showFeedback({
          tone: "error",
          title: "הניחוש לא נשמר",
          description: ERROR_MESSAGES[result.code] ?? content.saveError,
        });
        return;
      }
      if (
        !response.ok ||
        result.status !== "success" ||
        result.predictedHome !== Number(home) ||
        result.predictedAway !== Number(away)
      )
        throw new Error("Unconfirmed save");
      submitted(result.predictedHome, result.predictedAway);
      setState(result);
      const continuation = result.continuation;
      const nextId = continuation?.nextMatchId;
      const canContinue =
        continuation &&
        (nextId === null ||
          (typeof nextId === "string" &&
            /^[0-9a-f-]{36}$/i.test(nextId) &&
            nextId !== matchId));
      showFeedback({
        title: "הניחוש נשמר בהצלחה",
        description: `\u2068${homeLabel}: ${home}\u2069 · \u2068${awayLabel}: ${away}\u2069${canContinue ? (nextId ? " · עוברים למשחק הבא" : " · סיימתם את המשחקים הפתוחים למילוי במחזור הזה 🎉") : ""}`,
      });
      if (canContinue) {
        const target = nextId ? `/predictions/${nextId}` : "/predictions";
        setDestination(target);
        setMoving(true);
        router.push(target);
      } else
        setTransportError(
          "הניחוש נשמר, אך לא הצלחנו לטעון את המשחק הבא. אפשר להמשיך מרשימת המשחקים.",
        );
    } catch {
      if (!alive.current) return;
      const message =
        "לא התקבל אישור שמירה. הניחוש נשאר כאן; בדקו את החיבור ונסו שוב.";
      setTransportError(message);
      showFeedback({
        tone: "error",
        title: "לא התקבל אישור שמירה",
        description: message,
      });
    } finally {
      sending.current = false;
      if (alive.current) setPending(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-3 border-t pt-3"
      style={{ borderColor: colors.border }}
    >
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="predictedHome" value={home} />
      <input type="hidden" name="predictedAway" value={away} />

      <div
        dir="rtl"
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4"
      >
        <ScoreStepper
          label={homeLabel}
          value={home}
          onChange={setHome}
          disabled={disabled}
        />
        <span className="text-lg font-black text-[var(--text-muted)]">–</span>
        <ScoreStepper
          label={awayLabel}
          value={away}
          onChange={setAway}
          disabled={disabled}
        />
      </div>

      {state.status === "error" && (
        <span
          role="alert"
          className="text-center text-xs font-semibold text-[var(--danger)]"
        >
          {ERROR_MESSAGES[state.code]}
        </span>
      )}
      {confirmedSaved && (
        <span
          role="status"
          className="text-center text-xs font-semibold text-[var(--success)]"
        >
          {content.saveSuccess}
        </span>
      )}

      {draft.notice && (
        <p role="status" className="text-xs leading-5 text-[var(--gold)]">
          {draft.notice}
        </p>
      )}
      {locked && (
        <p role="alert" className="text-sm text-[var(--gold)]">
          המשחק ננעל. לא ניתן לשלוח ניחוש נוסף.
        </p>
      )}
      {transportError && (
        <p role="alert" className="text-sm leading-6 text-[var(--gold)]">
          {transportError}
        </p>
      )}
      {(transportError || moving) && (
        <Link
          href={destination}
          className="inline-flex min-h-11 items-center justify-center text-sm font-bold text-[var(--interactive)]"
        >
          {moving ? "הניחוש נשמר · ממשיכים למשחקים ←" : "לרשימת המשחקים ←"}
        </Link>
      )}
      <SubmitButton pending={pending} disabled={disabled || !home || !away} />
      <span className="text-center text-[11px] text-[var(--text-muted)]">
        אחרי השמירה עוברים לניחוש הבא שחסר במחזור. {content.editableUntilLock}
      </span>
    </form>
  );
}
