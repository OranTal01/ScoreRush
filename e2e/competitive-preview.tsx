// Isolated component verification. These fixtures are never mounted by the app.
import { RoundHistory } from "../app/_components/round-history";
import { WelcomeGuide } from "../app/_components/welcome-guide";
import { FriendsPredictions } from "../app/_components/friends-predictions";
import { PredictionForm } from "../app/(app)/predictions/[matchId]/_components/prediction-form";
import { createRoot } from "react-dom/client";
import { HomeDashboard } from "../app/_components/home/dashboard";
import { MatchesBrowser } from "../app/_components/matches-browser";
import { CompetitionTable } from "../app/_components/leaderboard/competition-table";
import { RaceCard } from "../app/_components/leaderboard/race-card";
import { SummaryCard } from "../app/_components/summary-card";
import { BottomNav } from "../app/_components/nav/bottom-nav";
import type { MatchWithTeams } from "../lib/matches/list";
import { buildDigest } from "../lib/notifications/digest";
import type { DigestStanding } from "../lib/db/schema/push";
import { Podium } from "../app/_components/leaderboard/podium";

const future = new Date(Date.now() + 86400000).toISOString();
const match: MatchWithTeams = {
  id: "11111111-1111-4111-8111-111111111111",
  tournamentId: "test",
  stage: "league",
  group: null,
  matchday: 2,
  kickoff: future,
  lockTime: future,
  status: "scheduled",
  regularResult: null,
  liveScore: null,
  ownPrediction: null,
  homeTeam: {
    id: "h",
    name: "Manchester United",
    shortName: "Manchester United",
    flagAssetUrl: null,
  },
  awayTeam: {
    id: "a",
    name: "Paris Saint-Germain",
    shortName: "Paris Saint-Germain",
    flagAssetUrl: null,
  },
};
const matches = [
  match,
  { ...match, id: "22222222-2222-4222-8222-222222222222" },
];
const standings: DigestStanding[] = [
  { id: "a", name: "נועם", rank: 1, total: 96, gained: 30, exact: 3 },
  { id: "b", name: "עילאי", rank: 2, total: 90, gained: 18, exact: 2 },
  {
    id: "c",
    name: "אלכסנדר כהן־לוי",
    rank: 2,
    total: 90,
    gained: 30,
    exact: 3,
  },
  { id: "self", name: "אורן טל", rank: 4, total: 84, gained: 27, exact: 2 },
  {
    id: "e",
    name: "ManchesterUnitedFan2026",
    rank: 5,
    total: 81,
    gained: 15,
    exact: 1,
  },
];
const baseline = standings.map((p, i) => ({
  ...p,
  rank: i + 3,
  total: p.total - p.gained,
}));
const table = standings.map((p) => ({
  id: p.id,
  displayName: p.name,
  avatarInitials: p.name.slice(0, 2),
  totalPoints: p.total,
  matchPoints: p.total,
  bonusPoints: 0,
  groupRankingPoints: 0,
  rank: p.rank,
  previousRank: p.id === "self" ? 6 : p.rank,
}));
const race = standings.map((p) => ({
  id: p.id,
  name: p.name,
  rank: p.rank,
  total: p.total,
}));
const view = location.pathname;
const title =
  view === "/"
    ? "בית"
    : view === "/predictions"
      ? "ניחושים"
      : view === "/leaderboard"
        ? "טבלה"
        : "סיכום";
createRoot(document.getElementById("root")!).render(
  <>
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-white/10 bg-[var(--bg-page)] px-4">
      <strong>
        Score<span className="text-[var(--interactive)]">Rush</span>
      </strong>
      <span className="text-xs">תצוגת בדיקה · {title}</span>
    </header>
    <main className="mx-auto w-full max-w-[1320px] min-w-0 px-4 pt-5 pb-[calc(96px+env(safe-area-inset-bottom))] sm:px-6 lg:px-7 lg:pt-7 lg:pb-12">
      {view === "/" ? (
        <HomeDashboard
          name="אורן טל"
          tournamentName="ליגת האלופות · החבר׳ה"
          onboardingOpen={false}
          rank={4}
          points={84}
          rankMoved={2}
          participantCount={17}
          selfId="self"
          raceEntries={race}
          roundLabel="מחזור 2"
          missingCount={2}
          deadline={future}
          retrospective={false}
          latestSummary={{ day: "2026-09-10", count: 17 }}
          progress={{
            matchesSaved: 16,
            matchesTotal: 18,
            bonusSaved: 18,
            bonusTotal: 18,
            rankingSaved: 1,
            rankingTotal: 1,
          }}
          predictionHref="/predictions"
          nextMatch={match}
          latestFinished={null}
          leaders={standings.slice(0, 3).map((p) => ({
            id: p.id,
            name: p.name,
            initials: p.name.slice(0, 2),
            rank: p.rank,
            points: p.total,
            self: false,
          }))}
          recentResults={[]}
          bonusLeaders={[]}
          exactStreak={2}
          correctStreak={4}
          accuracyPercent={72}
        />
      ) : view === "/history" || view === "/history-empty" ? (
        <RoundHistory
          selfId="self"
          pending={[
            {
              key: "next",
              label: "שלב הליגה · מחזור 4",
              finished: 8,
              total: 18,
              onboarding: false,
              historical: false,
            },
          ]}
          records={
            view === "/history-empty"
              ? []
              : [1, 2, 3].map((n) => ({
                  key: String(n),
                  label: `שלב הליגה · מחזור ${n}`,
                  capturedAt: `2026-09-${10 + n}T19:00:00Z`,
                  standings: standings.map((p) => ({
                    id: p.id,
                    name: p.name,
                    rank: p.id === "self" ? 7 - n : p.rank,
                    total: p.total - 9 * (3 - n),
                    roundPoints: p.gained,
                    exact: p.exact,
                  })),
                }))
          }
        />
      ) : view === "/welcome" ? (
        <WelcomeGuide
          scope="test-cup:self"
          name="אורן טל"
          tournamentName="ליגת האלופות · החבר׳ה"
          rules={{
            exact: 9,
            difference: 6,
            winner: 3,
            wrong: 0,
            lockMinutes: 5,
          }}
          firstMatch={match}
          hasPrediction={false}
        />
      ) : view === "/friends" || view === "/friends-hidden" ? (
        <div className="mx-auto max-w-[480px]">
          <FriendsPredictions
            selfId="self"
            homeLabel="Manchester United"
            awayLabel="Paris Saint-Germain"
            retrospective={view === "/friends-hidden"}
            picks={
              view === "/friends-hidden"
                ? null
                : standings.map((p, i) => ({
                    id: p.id,
                    name: p.name,
                    home: i % 3,
                    away: 1,
                    points: i % 3 === 1 ? 9 : 0,
                    isDefault: i === 4,
                  }))
            }
          />
        </div>
      ) : view.startsWith("/predictions/") ? (
        <div className="mx-auto max-w-[480px]">
          <PredictionForm
            draftScope="test-cup:self"
            matchId={match.id}
            homeLabel="Manchester United"
            awayLabel="Paris Saint-Germain"
            initialHome={0}
            initialAway={0}
            hasSubmitted={false}
            lockTime={future}
          />
        </div>
      ) : view === "/predictions" ? (
        <MatchesBrowser draftScope="test-cup:self" matches={matches} />
      ) : view === "/leaderboard" ? (
        <div className="mx-auto flex max-w-[960px] flex-col gap-4">
          <h1 className="page-heading">הטבלה של החבר׳ה</h1>
          <div className="grid gap-4 lg:grid-cols-2">
            <RaceCard compact entries={race} selfId="self" />
            <div className="rounded-2xl bg-[var(--surface-card)] p-4">
              <Podium topThree={table.slice(0, 3)} selfId="self" />
            </div>
          </div>
          <CompetitionTable participants={table} selfId="self" />
        </div>
      ) : (
        <div className="mx-auto max-w-[960px]">
          <SummaryCard
            data={{
              day: "2026-09-10",
              tournamentName: "ליגת האלופות · החבר׳ה",
              standings,
              baseline,
            }}
            body={buildDigest(
              "ליגת האלופות",
              "2026-09-10",
              standings,
              baseline,
              8,
            )}
            selfId="self"
          />
        </div>
      )}
    </main>
    <BottomNav />
  </>,
);
