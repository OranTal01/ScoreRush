import { LiveLink } from "@/app/_components/live-link";
import { leaderboard as content } from "@/lib/content/he";
import {
  computeStandings,
  type StandingsInput,
} from "@/lib/scoring/leaderboard";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { Podium } from "../../_components/leaderboard/podium";
import { PointsBreakdown } from "../../_components/leaderboard/points-breakdown";
import { CompetitionTable } from "../../_components/leaderboard/competition-table";
import { RaceCard } from "../../_components/leaderboard/race-card";
import { formatMatchTime } from "@/lib/time";
import Link from "next/link";
import type { LeaderboardParticipant } from "../../_components/leaderboard/types";
import { Card, EmptyState, SectionHeader } from "../../_components/ui";

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

/** Groups snapshot rows by their exact `captured_at` timestamp (every row from
 * one capture shares an identical value — see lib/scoring/snapshots.ts's doc
 * comment) and returns the batches ordered newest-first. */
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

/** Screen 8 (UX-BLUEPRINT.md): full ranked list + podium, own-row highlight,
 * rank movement indicators — wired to real data via RLS-scoped queries.
 * `getCurrentParticipant` (lib/tournaments/current.ts) picks the caller's
 * most-recently-joined tournament — a documented MVP stand-in until the real
 * tournament switcher exists.
 *
 * Only the latest two complete snapshot batches are loaded; fetching the
 * entire history can hit PostgREST's row cap mid-batch. Standings are
 * recomputed here via `computeStandings` (not read directly
 * off the latest snapshot's stored `rank`/`total_points`) so a participant
 * who joined after the last cron capture — and so has no snapshot row yet —
 * is still ranked correctly alongside everyone else, at zero points, through
 * the exact same identity-enforcing function the snapshot pipeline itself
 * uses (SCORING-RULES.md §9). Rank *movement* does read the previous
 * batch's stored rank directly, since that's the one thing this screen
 * can't recompute — it's history. */
export default async function LeaderboardPage() {
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
    { data: participants, error: participantsError },
    { data: newestSnapshot, error: newestSnapshotError },
  ] = await Promise.all([
    supabase
      .from("participants")
      .select("id, display_name, avatar_initials")
      .eq("tournament_id", tournamentId)
      .returns<ParticipantRow[]>(),
    supabase
      .from("leaderboard_snapshots")
      .select("captured_at")
      .eq("tournament_id", tournamentId)
      .order("captured_at", { ascending: false })
      .limit(1)
      .returns<Pick<SnapshotRow, "captured_at">[]>(),
  ]);

  if (participantsError || newestSnapshotError) {
    throw new Error(
      "לא ניתן לטעון את הדירוג כרגע. נסו שוב — הנקודות שלכם נשמרו.",
    );
  }

  if (!participants || participants.length === 0) {
    return <EmptyState message={content.emptyState} />;
  }

  let snapshotRows: SnapshotRow[] = [];
  const latestTimestamp = newestSnapshot?.[0]?.captured_at;
  if (latestTimestamp) {
    const { data: previousSnapshot, error: previousSnapshotError } =
      await supabase
        .from("leaderboard_snapshots")
        .select("captured_at")
        .eq("tournament_id", tournamentId)
        .lt("captured_at", latestTimestamp)
        .order("captured_at", { ascending: false })
        .limit(1)
        .returns<Pick<SnapshotRow, "captured_at">[]>();
    if (previousSnapshotError) {
      throw new Error("לא ניתן לטעון את הדירוג כרגע. נסו שוב — הנקודות שלכם נשמרו.");
    }

    // Fetch complete batches by timestamp. Loading the entire history hits
    // PostgREST's row cap and silently drops participants from the latest one.
    const timestamps = [
      latestTimestamp,
      ...(previousSnapshot?.[0] ? [previousSnapshot[0].captured_at] : []),
    ];
    const { data, error } = await supabase
      .from("leaderboard_snapshots")
      .select(
        "participant_id, rank, total_points, match_points, group_ranking_points, bonus_points, captured_at",
      )
      .eq("tournament_id", tournamentId)
      .in("captured_at", timestamps)
      .order("captured_at", { ascending: false })
      .returns<SnapshotRow[]>();
    if (error) {
      throw new Error("לא ניתן לטעון את הדירוג כרגע. נסו שוב — הנקודות שלכם נשמרו.");
    }
    snapshotRows = data ?? [];
  }

  const batches = groupIntoBatches(snapshotRows);
  const latestBatch = batches[0] ?? [];
  const previousBatch = batches[1] ?? [];

  const latestByParticipant = new Map(
    latestBatch.map((r) => [r.participant_id, r]),
  );
  const previousRankByParticipant = new Map(
    previousBatch.map((r) => [r.participant_id, r.rank]),
  );

  const standingsInput: StandingsInput[] = participants.map((p) => {
    const latest = latestByParticipant.get(p.id);
    return {
      participantId: p.id,
      matchPoints: latest?.match_points ?? 0,
      groupRankingPoints: latest?.group_ranking_points ?? 0,
      bonusPoints: latest?.bonus_points ?? 0,
    };
  });
  const standings = computeStandings(standingsInput);

  const participantById = new Map(participants.map((p) => [p.id, p]));
  const rows: LeaderboardParticipant[] = standings.map((entry) => {
    const participant = participantById.get(entry.participantId);
    return {
      id: entry.participantId,
      displayName: participant?.display_name ?? entry.participantId,
      avatarInitials:
        participant?.avatar_initials ||
        participant?.display_name?.trim().slice(0, 2) ||
        "?",
      totalPoints: entry.totalPoints,
      matchPoints: entry.matchPoints,
      groupRankingPoints: entry.groupRankingPoints,
      bonusPoints: entry.bonusPoints,
      rank: entry.rank,
      // No prior batch to compare against yet -> no movement ("–").
      previousRank:
        previousRankByParticipant.get(entry.participantId) ?? entry.rank,
    };
  });

  const sorted = [...rows].sort(
    (a, b) => a.rank - b.rank || a.displayName.localeCompare(b.displayName),
  );
  // Include everyone sharing a podium rank; never choose an arbitrary tied member.
  const topThree = sorted.filter((p) => p.rank <= 3);

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[960px]">
      <header>
        <h1 className="page-heading">הטבלה של החבר׳ה</h1>
        <p className="page-intro mt-2">
          כל נקודה מקרבת לפסגה. כאן רואים מי מוביל ואיפה אתם במרוץ.
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
        <span>
          {latestBatch[0]
            ? `הדירוג עודכן ב־${formatMatchTime(latestBatch[0].captured_at)}`
            : "ממתינים לעדכון הניקוד הראשון"}
        </span>
        <Link
          className="inline-flex min-h-11 items-center font-bold text-[var(--interactive)]"
          href="#my-standing"
        >
          קפיצה למיקום שלי ↓
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <RaceCard
          compact
          entries={sorted.map((p) => ({
            id: p.id,
            name: p.displayName,
            rank: p.rank,
            total: p.totalPoints,
          }))}
          selfId={selfId}
        />
        <Card className="flex flex-col gap-4">
          <SectionHeader title={content.podiumTitle} />
          <Podium topThree={topThree} selfId={selfId} />
          {new Set(topThree.map((p) => p.rank)).size < topThree.length && (
            <p className="mt-3 text-center text-xs leading-5 text-[var(--text-secondary)]">
              אותו מספר נקודות — אותו מקום. משתתפים בתיקו מוצגים יחד.
            </p>
          )}
        </Card>
      </div>
      <Link
        href="/history"
        className="recap-teaser flex flex-wrap items-center justify-between gap-2"
      >
        <span>
          <b className="block text-sm">הסיפור של העונה ↗</b>
          <span className="mt-1 block text-xs text-[var(--text-secondary)]">
            גרף הדירוג, נקודות ומנצחי המחזורים
          </span>
        </span>
        <span className="text-[var(--interactive)]">למסלול שלנו ←</span>
      </Link>
      <LiveLink />
      <CompetitionTable participants={sorted} selfId={selfId} />
      <p className="text-xs leading-6 text-[var(--text-secondary)]">
        לחצו על חבר לפירוט הנקודות. החצים משווים לעדכון הדירוג הקודם. בשוויון
        חולקים מקום, והמקום הבא מדלג בהתאם (למשל 1, 2, 2, 4).
      </p>
      <details className="rounded-2xl border border-white/10 p-4">
        <summary className="cursor-pointer text-sm font-bold">
          השוואת כל רכיבי הניקוד
        </summary>
        <div className="mt-4">
          <PointsBreakdown participants={sorted} selfId={selfId} />
        </div>
      </details>
      <Link href="/summaries" className="recap-teaser text-sm font-bold">
        הסיפור שמאחורי המספרים · לסיכומי המשחקים ←
      </Link>
    </div>
  );
}
