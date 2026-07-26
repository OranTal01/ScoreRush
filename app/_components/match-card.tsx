import { colors } from "@/lib/design-tokens";
import { predictions as predictionsContent } from "@/lib/content/he";
import { formatMatchTime } from "@/lib/mock/clock";
import { isPast } from "@/lib/time";
import type { MatchTeam, MatchWithTeams } from "@/lib/matches/list";
import { Card, Pill } from "./ui";

function TeamLabel({
  team,
  align,
}: {
  team: MatchTeam | null;
  align: "start" | "end";
}) {
  if (!team) {
    return (
      <span
        className={`flex-1 text-sm font-bold text-[var(--text-muted)] ${align === "end" ? "text-end" : "text-start"}`}
      >
        טרם נקבע
      </span>
    );
  }
  return (
    <span
      className={`flex flex-1 items-center gap-1.5 text-sm font-bold text-[var(--text-primary)] ${align === "end" ? "flex-row-reverse text-end" : "text-start"}`}
    >
      {team.flagAssetUrl && (
        // Team flags come from arbitrary provider/manual-entry URLs, not a
        // known-at-build-time host set — next/image's remotePatterns would
        // need every one allow-listed, so a plain <img> is used here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.flagAssetUrl}
          alt=""
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 rounded-full object-cover"
        />
      )}
      {team.shortName}
    </span>
  );
}

function StatusPill({ match }: { match: MatchWithTeams }) {
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
  const isLocked = isPast(match.lockTime);
  return (
    <Pill tone={isLocked ? "muted" : "interactive"}>
      {isLocked ? predictionsContent.lockedLabel : predictionsContent.openLabel}
    </Pill>
  );
}

/** Compact match row used by the Predictions list, Home's next/latest cards, and Bracket. */
export function MatchCard({ match }: { match: MatchWithTeams }) {
  const prediction = match.ownPrediction;
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
        <TeamLabel team={match.homeTeam} align="start" />
        {score ? (
          <span
            aria-live={match.status === "live" ? "polite" : undefined}
            className="ltr shrink-0 px-2 text-base font-black text-[var(--text-primary)] tabular-nums"
          >
            {score.home} – {score.away}
          </span>
        ) : (
          <span className="shrink-0 px-2 text-xs font-bold text-[var(--text-muted)]">
            {"–"}
          </span>
        )}
        <TeamLabel team={match.awayTeam} align="end" />
      </div>

      {prediction && (
        <p
          className="border-t pt-2 text-[11px] text-[var(--text-secondary)]"
          style={{ borderColor: colors.border }}
        >
          הניחוש שלך:{" "}
          <span className="ltr font-bold text-[var(--text-primary)] tabular-nums">
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
