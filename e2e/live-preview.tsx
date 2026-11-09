// Synthetic data only; this entry is never mounted by Next.js.
import { createRoot } from "react-dom/client";
import { LiveBoard } from "../app/_components/live-board";
import { BottomNav } from "../app/_components/nav/bottom-nav";
import type { LiveView } from "../lib/live/types";
const path = location.pathname;
const now = Date.now();
const stamp = new Date(now).toISOString();
const stale = path === "/live-stale";
const onboarding = path === "/live-onboarding";
const empty = path === "/live-empty";
const extra = path === "/live-extra";
const initial: LiveView = {
  tournamentId: "test-cup",
  tournamentName: "ליגת האלופות · החבר׳ה",
  selfId: "self",
  access:
    path === "/live-delayed"
      ? "delayed"
      : path === "/live-scores"
        ? "scores"
        : "events",
  generatedAt: stamp,
  projectedGames: stale || onboarding || empty ? 0 : 1,
  standings: [
    {
      id: "self",
      name: "אורן טל",
      officialPoints: 84,
      officialRank: 3,
      projectedPoints: 93,
      projectedRank: 1,
      temporaryPoints: 9,
    },
    {
      id: "friend",
      name: "אלכסנדר כהן־לוי",
      officialPoints: 90,
      officialRank: 1,
      projectedPoints: 93,
      projectedRank: 1,
      temporaryPoints: 3,
    },
    {
      id: "other",
      name: "ManchesterUnitedFan2026",
      officialPoints: 90,
      officialRank: 1,
      projectedPoints: 90,
      projectedRank: 3,
      temporaryPoints: 0,
    },
  ],
  games: empty
    ? []
    : [
        {
          id: "m1",
          home: "Manchester United",
          away: "Paris Saint-Germain",
          status: "live",
          kickoff: new Date(now - 3600000).toISOString(),
          score: extra ? { home: 3, away: 2 } : { home: 2, away: 1 },
          details: {
            period: extra ? "EXTRA_TIME" : "REGULAR",
            regulationScore: { home: 2, away: 1 },
            minute: extra ? 103 : 64,
            cards: [],
            sourceUpdatedAt: stamp,
          },
          syncedAt: new Date(now - (stale ? 240000 : 0)).toISOString(),
          retrospective: onboarding,
          ownPrediction: onboarding
            ? null
            : { home: 2, away: 1, isDefault: false },
          temporaryPoints: stale || onboarding ? null : 9,
          temporaryOutcome: stale || onboarding ? null : "exact",
          stale,
        },
        {
          id: "m2",
          home: "FC Bayern München",
          away: "Barcelona",
          status: "scheduled",
          kickoff: new Date(now + 7200000).toISOString(),
          score: null,
          details: null,
          syncedAt: stamp,
          retrospective: false,
          ownPrediction: null,
          temporaryPoints: null,
          temporaryOutcome: null,
          stale: false,
        },
      ],
  events:
    path === "/live-delayed" || empty || onboarding
      ? []
      : [
          {
            id: "e1",
            matchId: "m1",
            kind: "goal",
            description:
              "⚽ שער ל־Manchester United! Manchester United 2 · Paris Saint-Germain 1",
            createdAt: stamp,
          },
          {
            id: "e2",
            matchId: "m1",
            kind: "red_card",
            description: "🟥 כרטיס אדום ל־Paris Saint-Germain · שחקן לדוגמה",
            createdAt: stamp,
          },
        ],
};
Object.assign(window, { liveFixture: initial });
createRoot(document.getElementById("root")!).render(
  <>
    <header className="flex min-h-16 items-center justify-between border-b border-white/10 px-4">
      <strong>ScoreRush</strong>
      <span className="text-xs">תצוגת בדיקה</span>
    </header>
    <main className="mx-auto w-full max-w-[1320px] min-w-0 px-4 pt-5 pb-28 sm:px-6 lg:px-7">
      <LiveBoard initial={initial} />
    </main>
    <BottomNav />
  </>,
);
