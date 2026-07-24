"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { common, overrides as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { Card, EmptyState, Pill, SectionHeader } from "@/app/_components/ui";
import {
  applyMatchCorrection,
  previewMatchCorrection,
  type ApplyMatchCorrectionState,
  type OverridesErrorCode,
  type PreviewMatchCorrectionState,
} from "../actions";

const idlePreviewState: PreviewMatchCorrectionState = { status: "idle" };
const idleApplyState: ApplyMatchCorrectionState = { status: "idle" };

const ERROR_MESSAGES: Record<OverridesErrorCode, string> = {
  invalid_input: content.errorInvalidInput,
  unauthenticated: content.errorUnauthenticated,
  not_admin: content.errorNotAdmin,
  not_found: content.errorNotFound,
  generic: content.errorGeneric,
};

const inputStyle = {
  background: colors.surfaceCard2,
  borderRadius: "var(--radius-button)",
  border: `1px solid ${colors.border}`,
};
const labelClass = "text-xs font-semibold text-[var(--text-secondary)]";

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function PreviewSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-fit px-4 py-2.5 text-xs font-bold text-[#080B14] transition-opacity disabled:opacity-60"
      style={{ background: colors.interactive, borderRadius: "var(--radius-button)" }}
    >
      {pending ? content.previewPending : content.previewCta}
    </button>
  );
}

function ApplySubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-fit px-4 py-2.5 text-xs font-bold text-[#080B14] transition-opacity disabled:opacity-60"
      style={{ background: colors.danger, borderRadius: "var(--radius-button)" }}
    >
      {pending ? content.applyPending : content.applyCta}
    </button>
  );
}

/**
 * Two-step manual match-result correction (Phase 7 task #61,
 * UX-BLUEPRINT.md §4 screens #8-9 combined): the score inputs feed a
 * read-only `previewMatchCorrection` action (rerunnable freely while the
 * admin adjusts the score), and only once a preview has been seen does the
 * reason/evidence/reversible form for the writing `applyMatchCorrection`
 * action appear — an admin can never apply a correction blind.
 */
export function MatchCorrectionForm({
  matchId,
  tournamentId,
  homeTeamName,
  awayTeamName,
  currentResult,
}: {
  matchId: string;
  tournamentId: string;
  homeTeamName: string;
  awayTeamName: string;
  currentResult: { home: number; away: number } | null;
}) {
  const [previewState, previewAction] = useActionState(
    previewMatchCorrection,
    idlePreviewState,
  );
  const [applyState, applyAction] = useActionState(
    applyMatchCorrection,
    idleApplyState,
  );
  const [homeScore, setHomeScore] = useState(String(currentResult?.home ?? 0));
  const [awayScore, setAwayScore] = useState(String(currentResult?.away ?? 0));

  if (applyState.status === "success") {
    return (
      <Card className="flex flex-col gap-2">
        <span className="text-sm font-extrabold text-[var(--success)]">
          {content.successTitle}
        </span>
        <p className="text-xs text-[var(--text-muted)]">{content.successHint}</p>
      </Card>
    );
  }

  return (
    <>
      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.proposedResultSection} />
        <form action={previewAction} className="flex flex-col gap-3">
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <div className="flex items-end gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="proposedHome" className={labelClass}>
                {homeTeamName}
              </label>
              <input
                id="proposedHome"
                name="proposedHome"
                type="number"
                min={0}
                max={99}
                inputMode="numeric"
                dir="ltr"
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                className="px-4 py-3 text-center text-sm font-bold text-[var(--text-primary)] outline-none tabular-nums"
                style={inputStyle}
              />
            </div>
            <span className="pb-3 text-xs text-[var(--text-muted)]">{common.vs}</span>
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="proposedAway" className={labelClass}>
                {awayTeamName}
              </label>
              <input
                id="proposedAway"
                name="proposedAway"
                type="number"
                min={0}
                max={99}
                inputMode="numeric"
                dir="ltr"
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                className="px-4 py-3 text-center text-sm font-bold text-[var(--text-primary)] outline-none tabular-nums"
                style={inputStyle}
              />
            </div>
          </div>
          {previewState.status === "error" && (
            <span role="alert" className="text-xs font-semibold text-[var(--danger)]">
              {ERROR_MESSAGES[previewState.code]}
            </span>
          )}
          <PreviewSubmitButton />
        </form>
      </Card>

      {previewState.status === "success" && (
        <>
          <Card className="flex flex-col gap-3">
            <SectionHeader title={content.previewSection} />
            <p className="text-[11px] text-[var(--text-muted)]">{content.scopeNote}</p>

            {previewState.preview.predictionChanges.length === 0 ? (
              <EmptyState message={content.predictionChangesEmpty} />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {previewState.preview.predictionChanges
                  .filter((change) => change.pointsDelta !== 0)
                  .map((change) => (
                    <li
                      key={change.participantId}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-[var(--text-secondary)]">
                        {change.displayName}
                      </span>
                      <span className="ltr flex items-center gap-2 tabular-nums">
                        <span className="text-[var(--text-muted)]">
                          {change.previousPoints} → {change.points}
                        </span>
                        <Pill tone={change.pointsDelta > 0 ? "success" : "danger"}>
                          {formatDelta(change.pointsDelta)}
                        </Pill>
                      </span>
                    </li>
                  ))}
              </ul>
            )}

            <div className="flex flex-col gap-2 border-t pt-2.5" style={{ borderColor: colors.border }}>
              <span className={labelClass}>{content.rankChangesSection}</span>
              {previewState.preview.rankChanges.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  {content.rankChangesEmpty}
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {previewState.preview.rankChanges.map((change) => (
                    <li
                      key={change.participantId}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-[var(--text-secondary)]">
                        {change.displayName}
                      </span>
                      <span className="ltr tabular-nums">
                        <span className="text-[var(--text-muted)]">
                          #{change.previousRank} → #{change.proposedRank}
                        </span>{" "}
                        <span className="text-[var(--text-primary)]">
                          ({change.previousTotalPoints} → {change.proposedTotalPoints})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <SectionHeader title={content.reasonSection} />
            <form
              action={applyAction}
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                if (!window.confirm(content.applyConfirm)) e.preventDefault();
              }}
            >
              <input type="hidden" name="matchId" value={matchId} />
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <input type="hidden" name="proposedHome" value={previewState.proposedHome} />
              <input type="hidden" name="proposedAway" value={previewState.proposedAway} />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="reason" className={labelClass}>
                  {content.reasonInputLabel}
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  required
                  rows={3}
                  placeholder={content.reasonPlaceholder}
                  className="px-4 py-3 text-start text-sm text-[var(--text-primary)] outline-none"
                  style={inputStyle}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="evidenceRef" className={labelClass}>
                  {content.evidenceInputLabel}
                </label>
                <input
                  id="evidenceRef"
                  name="evidenceRef"
                  type="text"
                  dir="ltr"
                  placeholder={content.evidencePlaceholder}
                  className="px-4 py-3 text-start text-sm text-[var(--text-primary)] outline-none"
                  style={inputStyle}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  name="reversible"
                  defaultChecked
                  className="h-4 w-4"
                />
                {content.reversibleInputLabel}
              </label>

              {applyState.status === "error" && (
                <span role="alert" className="text-xs font-semibold text-[var(--danger)]">
                  {ERROR_MESSAGES[applyState.code]}
                </span>
              )}

              <ApplySubmitButton />
            </form>
          </Card>
        </>
      )}
    </>
  );
}
