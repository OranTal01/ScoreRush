"use client";
import { useActionState } from "react";
import { closeOnboarding } from "../onboarding-actions";
export function CloseOnboardingForm({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const [state, action, pending] = useActionState(closeOnboarding, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <label className="flex items-start gap-2 text-xs leading-5">
        <input className="mt-1" type="checkbox" name="confirm" required />
        סיימנו לקלוט את הניחושים. אני מאשר לנעול את ניחושי הפתיחה, הדירוג
        והבונוסים ולמלא 0–0 במשחקים שכבר ננעלו ונשארו ללא ניחוש.
      </label>
      <button
        disabled={pending}
        className="min-h-12 rounded-xl bg-[var(--interactive)] px-4 text-sm font-bold text-[#080B14] disabled:opacity-50"
      >
        {pending ? "מסיים קליטה…" : "סיום קליטה והפעלת הנעילה הרגילה"}
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-[var(--danger)]">
          {state.error}
        </p>
      )}
      {state.closed && <p role="status">הקליטה נסגרה והניחושים ננעלו.</p>}
    </form>
  );
}
