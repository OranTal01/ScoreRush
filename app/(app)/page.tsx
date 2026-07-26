import { colors, gradients, spacing } from "@/lib/design-tokens";
import { home as content, nav } from "@/lib/content/he";
import { formatMatchTime } from "@/lib/mock/clock";
import {
  computeStandings,
  type StandingsInput,
} from "@/lib/scoring/leaderboard";
import { computePredictionStreaks } from "@/lib/scoring/streaks";
import { listTournamentMatches, type MatchWithTeams } from "@/lib/matches/list";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import {
  Avatar,
  Card,
  EmptyState,
  Pill,
  RankBadge,
  SectionHeader,
} from "../_components/ui";
import { MatchCard } from "../_components/match-card";
import { MotionIn } from "../_components/motion/motion-in";
import {
  HeroPointsCounter,
  HeroRankNumber,
  RankMovementChip,
} from "../_components/home/hero-stats";

type ParticipantRow = {
  id: string;
  display_name: string;
  avatar_initials: string | null;
};
type SnapshotRow = {
  participant_id: string;
  rank: number;
  total_points: number;
  match_points: number;
  group_ranking_points: number;
  bonus_points: number;
  captured_at: string;
};
type BonusCategoryRow = { id: string; name: string; sort_order: number };
type BonusStatRow = { category_id: string; label: string; value: number };

/** Same batching approach as leaderboard/page.tsx: every row from one
 * snapshot capture shares an identical `captured_at`, so grouping by that
 * timestamp recovers each historical batch without a separate table. */
function groupIntoBatches(rows: SnapshotRow[]): SnapshotRow[][] {
  const byTimestamp = new Map<number, SnapshotRow[]>();
  for (const row of rows) {
    const key = new Date(row.captured_at).getTime();
    const batch = byTimestamp.get(key);
    if (batch) batch.push(row);
    else byTimestamp.set(key, [row]);
  }
  return [...byTimestamp.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, batch]) => batch);
}

export const dynamic = "force-dynamic";

/**
 * Screen 1 (UX-BLUEPRINT.md): rank hero, achievements, next/latest match,
 * leaderboard preview, tournament (bonus) leaders, recent results.
 *
 * Real-data pass (ROADMAP.md Phase 9 gap-fill, predates the phase itself) —
 * this screen ran entirely on `@/lib/mock` fixtures through Phases 2-8, see
 * lib/matches/list.ts's doc comment for why. Guard chain and standings
 * computation mirror leaderboard/page.tsx exactly (same
 * `getCurrentParticipant` MVP stand-in, same `computeStandings` recompute
 * rather than trusting a possibly-stale snapshot's stored rank).
 *
 * Two cards that had no real backing data model at all were dropped rather
 * than left fabricated: the mock "3 exact predictions in a row" badge never
 * actually reflected the mock participant's data (a static string regardless
 * of input) — replaced with a real `exactStreak` computed from the caller's
 * own scored `match_predictions.outcome` history (lib/scoring/streaks.ts).
 * The mock "activity feed" had per-participant narrative text
 * ("X קלע בול...") with no backing table anywhere in DATABASE.md — building
 * that is a real feature (a social/audit feed), not a wiring task, so it's
 * replaced here with the tournament's actual most-recent finished results,
 * which *is* real data already on hand from `listTournamentMatches`.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <EmptyState message={content.errorUnauthenticated} />;
  }

  const current = await getCurrentParticipant(supabase, user.id);
  if (!current) {
    return <EmptyState message={content.errorNotAMember} />;
  }
  const { tournamentId, participantId: selfId } = current;

  const [
    { data: participants },
    { data: snapshotRows },
    matches,
    { data: categories },
  ] = await Promise.all([
    supabase
      .from("participants")
      .select("id, display_name, avatar_initials")
      .eq("tournament_id", tournamentId)
      .returns<ParticipantRow[]>(),
    supabase
      .from("leaderboard_snapshots")
      .select(
        "participant_id, rank, total_points, match_points, group_ranking_points, bonus_points, captured_at",
      )
      .eq("tournament_id", tournamentId)
      .returns<SnapshotRow[]>(),
    listTournamentMatches(supabase, tournamentId, selfId),
    supabase
      .from("bonus_categories")
      .select("id, name, sort_order")
      .eq("tournament_id", tournamentId)
      .order("sort_order", { ascending: true })
      .returns<BonusCategoryRow[]>(),
  ]);

  const topCategories = (categories ?? []).slice(0, 3);
  const { data: leaderRows } =
    topCategories.length > 0
      ? await supabase
          .from("bonus_stats")
          .select("category_id, label, value")
          .in(
            "category_id",
            topCategories.map((c) => c.id),
          )
          .eq("rank", 1)
          .returns<BonusStatRow[]>()
      : { data: null as BonusStatRow[] | null };

  const self = (participants ?? []).find((p) => p.id === selfId);

  // Standings recomputed the same way as leaderboard/page.tsx (see its doc
  // comment) rather than trusted off the latest snapshot's stored fields.
  const batches = groupIntoBatches(snapshotRows ?? []);
  const latestBatch = batches[0] ?? [];
  const previousBatch = batches[1] ?? [];
  const latestByParticipant = new Map(
    latestBatch.map((r) => [r.participant_id, r]),
  );
  const previousRankByParticipant = new Map(
    previousBatch.map((r) => [r.participant_id, r.rank]),
  );
  const standingsInput: StandingsInput[] = (participants ?? []).map((p) => {
    const latest = latestByParticipant.get(p.id);
    return {
      participantId: p.id,
      matchPoints: latest?.match_points ?? 0,
      groupRankingPoints: latest?.group_ranking_points ?? 0,
      bonusPoints: latest?.bonus_points ?? 0,
    };
  });
  const standings = computeStandings(standingsInput);
  const selfStanding = standings.find((s) => s.participantId === selfId);
  const selfRank = selfStanding?.rank ?? 0;
  const selfPreviousRank = previousRankByParticipant.get(selfId) ?? selfRank;
  const rankMoved = selfPreviousRank - selfRank;

  const participantById = new Map((participants ?? []).map((p) => [p.id, p]));
  const topThree = [...standings]
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (
          participantById.get(a.participantId)?.display_name ?? ""
        ).localeCompare(
          participantById.get(b.participantId)?.display_name ?? "",
        ),
    )
    .slice(0, 3);

  const nextMatch: MatchWithTeams | null =
    matches.find((m) => m.status === "scheduled" || m.status === "live") ??
    null;
  const finishedMatches = matches.filter((m) => m.status === "finished");
  const latestFinished: MatchWithTeams | null =
    [...finishedMatches].sort(
      (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime(),
    )[0] ?? null;
  const recentResults = [...finishedMatches]
    .sort(
      (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime(),
    )
    .slice(0, 4);

  const { exactStreak, correctStreak, accuracyPercent } =
    computePredictionStreaks(
      matches
        .filter((m) => m.ownPrediction !== null)
        .map((m) => ({
          kickoff: m.kickoff,
          outcome: m.ownPrediction!.outcome,
        })),
    );

  return (
    <div
      // Phase 9 #74 responsive review: UX-BLUEPRINT.md §6 specs the 3-column
      // grid for "Desktop (≥1024px)" and "still single column, centered,
      // wider max-width" for "Tablet (~768px)" — this previously switched to
      // the grid at `md:` (768px) instead, which crammed 3 columns into a
      // ~700px-wide viewport with almost nothing left for the center column.
      // Now: still single column (with a centered, wider cap) through the
      // `md:` tablet band, only grid-ing at `lg:` (1024px) where there's
      // room. The app shell's own `md:` nav switch (bottom nav -> top bar,
      // app/(app)/layout.tsx) is unaffected — that's a separate, already-
      // shipped, already-reviewed decision out of scope here.
      className="mx-auto flex w-full flex-col gap-4 md:max-w-[640px] lg:grid lg:max-w-none lg:grid-cols-[340px_1fr_360px] lg:items-start"
      style={{ gap: spacing.desktopGutter }}
    >
      <h1 className="sr-only">{nav.home}</h1>
      {/* Left column (desktop) — rank hero */}
      <div className="flex flex-col gap-4">
        <MotionIn index={0}>
          <Card padding="hero" className="relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: gradients.hero }}
            />
            <div className="relative flex flex-col gap-3">
              <p className="text-sm font-bold text-[var(--text-secondary)]">
                {content.greeting(self?.display_name ?? "")}
              </p>
              <div className="flex items-end justify-between">
                <div className="flex flex-col">
                  <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                    {content.rankHeroLabel}
                  </span>
                  <HeroRankNumber rank={selfRank} />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                    {content.totalPointsLabel}
                  </span>
                  <HeroPointsCounter points={selfStanding?.totalPoints ?? 0} />
                </div>
              </div>
              <RankMovementChip rankMoved={rankMoved} />
            </div>
          </Card>
        </MotionIn>

        <MotionIn index={1}>
          <Card className="flex flex-col gap-3">
            <SectionHeader title={content.achievementsLabel} />
            {accuracyPercent === null ? (
              <EmptyState message={content.noAchievementsYet} />
            ) : (
              <div className="flex flex-wrap gap-2">
                <MotionIn as="span" variant="pop" index={0}>
                  <Pill tone="gold">
                    🎯 {content.exactStreakLabel(exactStreak)}
                  </Pill>
                </MotionIn>
                <MotionIn as="span" variant="pop" index={1}>
                  <Pill tone="interactive">
                    🔥 {content.correctStreakLabel(correctStreak)}
                  </Pill>
                </MotionIn>
                <MotionIn as="span" variant="pop" index={2}>
                  <Pill tone="muted">
                    📈 {content.accuracyLabel(accuracyPercent)}
                  </Pill>
                </MotionIn>
              </div>
            )}
          </Card>
        </MotionIn>
      </div>

      {/* Center column (desktop) — next match / latest result */}
      <div className="flex flex-col gap-4">
        <MotionIn index={2} className="flex flex-col gap-2">
          <SectionHeader title={content.nextMatchLabel} />
          {nextMatch ? (
            <MatchCard match={nextMatch} />
          ) : (
            <EmptyState message={content.noNextMatch} />
          )}
        </MotionIn>
        <MotionIn index={3} className="flex flex-col gap-2">
          <SectionHeader title={content.latestResultLabel} />
          {latestFinished ? (
            <MatchCard match={latestFinished} />
          ) : (
            <EmptyState message={content.noLatestResult} />
          )}
        </MotionIn>
      </div>

      {/* Right column (desktop) — leaderboard preview / leaders / recent results */}
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <SectionHeader title={content.leaderboardPreviewLabel} />
          {topThree.length === 0 ? (
            <EmptyState message={content.noLeaderboardYet} />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {topThree.map((entry, index) => {
                const p = participantById.get(entry.participantId);
                return (
                  <MotionIn
                    key={entry.participantId}
                    as="li"
                    index={index}
                    className="flex items-center gap-2.5"
                  >
                    <RankBadge rank={entry.rank} />
                    <Avatar
                      initials={p?.avatar_initials ?? "?"}
                      rank={entry.rank}
                      self={entry.participantId === selfId}
                      size={30}
                    />
                    <span className="flex-1 truncate text-sm font-bold text-[var(--text-primary)]">
                      {p?.display_name ?? entry.participantId}
                    </span>
                    <span className="ltr text-sm font-extrabold text-[var(--gold)] tabular-nums">
                      {entry.totalPoints}
                    </span>
                  </MotionIn>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionHeader title={content.tournamentLeadersLabel} />
          {topCategories.length === 0 || (leaderRows ?? []).length === 0 ? (
            <EmptyState message={content.noLeadersYet} />
          ) : (
            <ul className="flex flex-col gap-2">
              {topCategories.map((category, index) => {
                const leader = (leaderRows ?? []).find(
                  (r) => r.category_id === category.id,
                );
                if (!leader) return null;
                return (
                  <MotionIn
                    key={category.id}
                    as="li"
                    index={index}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-[var(--text-secondary)]">
                      {category.name}
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {leader.label}
                    </span>
                  </MotionIn>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionHeader title={content.activityFeedLabel} />
          {recentResults.length === 0 ? (
            <EmptyState message={content.noRecentResults} />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {recentResults.map((match, index) => (
                <MotionIn
                  key={match.id}
                  as="li"
                  index={index}
                  className="border-b pb-2.5 text-xs leading-relaxed text-[var(--text-secondary)] last:border-b-0 last:pb-0"
                  style={{ borderColor: colors.border }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[var(--text-primary)]">
                      {match.homeTeam?.shortName ?? "?"}{" "}
                      {match.regularResult?.home}
                      {" – "}
                      {match.regularResult?.away}{" "}
                      {match.awayTeam?.shortName ?? "?"}
                    </span>
                    <span className="ltr shrink-0 text-[10.5px] text-[var(--text-muted)] tabular-nums">
                      {formatMatchTime(match.kickoff)}
                    </span>
                  </div>
                </MotionIn>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
