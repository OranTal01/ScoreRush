import Link from "next/link";
import { colors } from "@/lib/design-tokens";
import { predictions as predictionsContent } from "@/lib/content/he";
import { formatMatchTime } from "@/lib/mock/clock";
import { isPast } from "@/lib/time";
import type { MatchTeam, MatchWithTeams } from "@/lib/matches/list";
import { Card, Pill } from "./ui";
import { ScorePair } from "./score-pair";

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
      className={`flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-[var(--text-primary)] ${align === "end" ? "flex-row-reverse text-end" : "text-start"}`}
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
          className="h-6 w-6 shrink-0 object-contain"
        />
      )}
      <bdi className="min-w-0 [overflow-wrap:anywhere]">{team.shortName}</bdi>
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
  if (match.status === "cancelled") return <Pill tone="muted">בוטל</Pill>;
  if (match.status === "postponed") return <Pill tone="muted">נדחה</Pill>;
  if (match.retrospectiveEntry)
    return match.ownPrediction && !match.ownPrediction.isDefault ? (
      <Pill tone="muted">הושלם וננעל</Pill>
    ) : (
      <Pill tone="gold">פתוח להשלמה</Pill>
    );
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
    <Card className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
          {formatMatchTime(match.kickoff)}
        </span>
        <StatusPill match={match} />
      </div>

      <div
        dir="rtl"
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-1"
      >
        <TeamLabel team={match.homeTeam} align="start" />
        {score ? (
          <ScorePair
            home={score.home}
            away={score.away}
            homeLabel={match.homeTeam?.shortName}
            awayLabel={match.awayTeam?.shortName}
            live={match.status === "live"}
            className="shrink-0 px-2 text-base font-black text-[var(--text-primary)]"
          />
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
          {prediction.isDefault ? "ברירת מחדל:" : "הניחוש שלך:"}{" "}
          <ScorePair
            home={prediction.predictedHome}
            away={prediction.predictedAway}
            homeLabel={match.homeTeam?.shortName}
            awayLabel={match.awayTeam?.shortName}
            className="font-bold text-[var(--text-primary)]"
          />
          {prediction.pointsEarned !== null && (
            <span className="ms-1 font-bold text-[var(--gold)]">
              (+{prediction.pointsEarned} {"נק'"})
            </span>
          )}
        </p>
      )}
      <Link
        href={`/predictions/${match.id}`}
        className="min-h-11 rounded-xl border border-[var(--interactive)]/15 bg-[var(--interactive)]/5 px-3 py-3 text-center text-xs font-bold text-[var(--interactive)] transition-colors hover:bg-[var(--interactive)]/15"
      >
        {match.retrospectiveEntry
          ? prediction && !prediction.isDefault
            ? "פרטי המשחק והניחוש"
            : "השלמת ניחוש חסר ←"
          : !isPast(match.lockTime) && match.status === "scheduled"
            ? prediction && !prediction.isDefault
              ? "עריכת הניחוש"
              : "הכנסת ניחוש"
            : "פרטי המשחק והניחוש"}
      </Link>
    </Card>
  );
}
