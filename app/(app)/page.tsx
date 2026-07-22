import { colors, gradients, spacing, typography } from "@/lib/design-tokens";
import { home as content, scoring } from "@/lib/content/he";
import {
  bonusLeaders,
  currentParticipant,
  matches,
  nextMatch,
  participants,
} from "@/lib/mock";
import {
  Avatar,
  Card,
  Pill,
  RankBadge,
  SectionHeader,
} from "../_components/ui";
import { MatchCard } from "../_components/match-card";

const latestFinished = [...matches]
  .filter((m) => m.status === "finished")
  .sort(
    (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime(),
  )[0]!;

const topThree = [...participants].sort((a, b) => a.rank - b.rank).slice(0, 3);

const activity = [
  {
    id: "a1",
    text: `יובל לוי ${scoring.exactScore} במשחק באיירן מינכן נגד ליברפול — ${scoring.pointsAccumulated(9)}`,
  },
  { id: "a2", text: `אתה ${scoring.rankUp} למקום 2 בטבלה` },
  {
    id: "a3",
    text: `מאיה בר ${scoring.winnerAndDifference} במשחק מנצ'סטר סיטי נגד אינטר`,
  },
  {
    id: "a4",
    text: `ריאל מדריד ${scoring.scoredGoal} פעמיים במשחק החי מול אינטר`,
  },
];

export default function HomePage() {
  const rankMoved = currentParticipant.previousRank - currentParticipant.rank;

  return (
    <div
      className="flex flex-col gap-4 md:grid md:grid-cols-[340px_1fr_360px] md:items-start"
      style={{ gap: spacing.desktopGutter }}
    >
      {/* Left column (desktop) — rank hero */}
      <div className="flex flex-col gap-4">
        <Card padding="hero" className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: gradients.hero }}
          />
          <div className="relative flex flex-col gap-3">
            <p className="text-sm font-bold text-[var(--text-secondary)]">
              {content.greeting(currentParticipant.displayName)}
            </p>
            <div className="flex items-end justify-between">
              <div className="flex flex-col">
                <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                  {content.rankHeroLabel}
                </span>
                <span
                  className="ltr text-[var(--gold)] tabular-nums"
                  style={{
                    fontSize: typography.scale.heroRankNumber.mobile,
                    fontWeight: typography.scale.heroRankNumber.weight,
                    lineHeight: typography.scale.heroRankNumber.lineHeight,
                  }}
                >
                  {currentParticipant.rank}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                  {content.totalPointsLabel}
                </span>
                <span
                  className="ltr text-[var(--text-primary)] tabular-nums"
                  style={{
                    fontSize: typography.scale.heroTotalPoints.mobile,
                    fontWeight: typography.scale.heroTotalPoints.weight,
                    lineHeight: typography.scale.heroTotalPoints.lineHeight,
                  }}
                >
                  {currentParticipant.totalPoints}
                </span>
              </div>
            </div>
            {rankMoved !== 0 && (
              <Pill tone={rankMoved > 0 ? "success" : "danger"}>
                {rankMoved > 0 ? scoring.rankUp : scoring.rankDown} ·{" "}
                {Math.abs(rankMoved)} מקומות
              </Pill>
            )}
          </div>
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionHeader title={content.achievementsLabel} />
          <div className="flex flex-wrap gap-2">
            <Pill tone="gold">🎯 3 ניחושים מדויקים ברצף</Pill>
            <Pill tone="interactive">
              🔥 רצף של {currentParticipant.streak}
            </Pill>
            <Pill tone="muted">
              📈 {currentParticipant.accuracyPercent}% דיוק
            </Pill>
          </div>
        </Card>
      </div>

      {/* Center column (desktop) — next match / latest result */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <SectionHeader title={content.nextMatchLabel} />
          <MatchCard match={nextMatch} />
        </div>
        <div className="flex flex-col gap-2">
          <SectionHeader title={content.latestResultLabel} />
          <MatchCard match={latestFinished} />
        </div>
      </div>

      {/* Right column (desktop) — leaderboard preview / leaders / activity */}
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <SectionHeader title={content.leaderboardPreviewLabel} />
          <ul className="flex flex-col gap-2.5">
            {topThree.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5">
                <RankBadge rank={p.rank} />
                <Avatar
                  initials={p.avatarInitials}
                  rank={p.rank}
                  self={p.id === currentParticipant.id}
                  size={30}
                />
                <span className="flex-1 truncate text-sm font-bold text-[var(--text-primary)]">
                  {p.displayName}
                </span>
                <span className="ltr text-sm font-extrabold text-[var(--gold)] tabular-nums">
                  {p.totalPoints}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionHeader title={content.tournamentLeadersLabel} />
          <ul className="flex flex-col gap-2">
            <li className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">
                {scoring.topScorer}
              </span>
              <span className="font-bold text-[var(--text-primary)]">
                {bonusLeaders["bc-top-scorer"]![0]!.label}
              </span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">
                {scoring.topAssistProvider}
              </span>
              <span className="font-bold text-[var(--text-primary)]">
                {bonusLeaders["bc-top-assists"]![0]!.label}
              </span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">
                {scoring.topScoringTeam}
              </span>
              <span className="font-bold text-[var(--text-primary)]">
                {bonusLeaders["bc-top-team"]![0]!.label}
              </span>
            </li>
          </ul>
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionHeader title={content.activityFeedLabel} />
          <ul className="flex flex-col gap-2.5">
            {activity.map((item) => (
              <li
                key={item.id}
                className="border-b pb-2.5 text-xs leading-relaxed text-[var(--text-secondary)] last:border-b-0 last:pb-0"
                style={{ borderColor: colors.border }}
              >
                {item.text}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
