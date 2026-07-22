import { colors } from "@/lib/design-tokens";
import { predictions as predictionsContent } from "@/lib/content/he";
import { MOCK_NOW, formatMatchTime, predictionForMatch, teamById } from "@/lib/mock";
import type { Match } from "@/lib/mock/types";
import { Card, Pill } from "./ui";

function TeamLabel({ teamId, align }: { teamId: string; align: "start" | "end" }) {
  if (!teamId) {
    return (
      <span
        className={`flex-1 text-sm font-bold text-[var(--text-muted)] ${align === "end" ? "text-end" : "text-start"}`}
      >
        טרם נקבע
      </span>
    );
  }
  const team = teamById(teamId);
  return (
    <span
      className={`flex flex-1 items-center gap-1.5 text-sm font-bold text-[var(--text-primary)] ${align === "end" ? "flex-row-reverse text-end" : "text-start"}`}
    >
      <span aria-hidden>{team.flagEmoji}</span>
      {team.shortName}
    </span>
  );
}

function StatusPill({ match }: { match: Match }) {
  if (match.status === "live") {
    return (
      <Pill tone="danger" pulse>
        {predictionsContent.liveLabel}
      </Pill>
    );
  }
  if (match.status === "finished") {
    return <Pill tone="muted">{predictionsContent.finishedLabel}</Pill>;
  }
  const isLocked = new Date(match.lockTime) <= MOCK_NOW;
  return (
    <Pill tone={isLocked ? "muted" : "interactive"}>
      {isLocked ? predictionsContent.lockedLabel : predictionsContent.openLabel}
    </Pill>
  );
}

/** Compact match row used by the Predictions list, Home's next/latest cards, and Bracket. */
export function MatchCard({ match }: { match: Match }) {
  const prediction = predictionForMatch(match.id);
  const score =
    match.status === "finished"
      ? match.regularResult
      : match.status === "live"
        ? match.liveScore
        : null;

  return (
    <Card className="flex flex-col gap-2.5" padding="compact">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
          {formatMatchTime(match.kickoff)}
        </span>
        <StatusPill match={match} />
      </div>

      <div className="flex items-center gap-2">
        <TeamLabel teamId={match.homeTeamId} align="start" />
        {score ? (
          <span className="ltr shrink-0 px-2 text-base font-black tabular-nums text-[var(--text-primary)]">
            {score.home} – {score.away}
          </span>
        ) : (
          <span className="shrink-0 px-2 text-xs font-bold text-[var(--text-muted)]">
            {"–"}
          </span>
        )}
        <TeamLabel teamId={match.awayTeamId} align="end" />
      </div>

      {prediction && (
        <p
          className="border-t pt-2 text-[11px] text-[var(--text-secondary)]"
          style={{ borderColor: colors.border }}
        >
          הניחוש שלך:{" "}
          <span className="ltr font-bold tabular-nums text-[var(--text-primary)]">
            {prediction.predictedHome} – {prediction.predictedAway}
          </span>
          {prediction.pointsEarned !== null && (
            <span className="ms-1 font-bold text-[var(--gold)]">
              (+{prediction.pointsEarned} {"נק'"})
            </span>
          )}
        </p>
      )}
    </Card>
  );
}
