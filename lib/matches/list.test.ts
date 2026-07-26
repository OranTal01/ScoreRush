/**
 * Unit coverage for `listTournamentMatches` (lib/matches/list.ts). Fakes the
 * RLS-scoped Supabase client with a queue-shifting `.from()` — same pattern
 * as lib/auth/admin.test.ts and app/(app)/groups/actions.test.ts: `.from()`
 * shifts the next queued response immediately, so the two `Promise.all`'d
 * queries (teams, predictions) resolve in the exact order they're written
 * in source, after the single awaited `matches` query ahead of them.
 */
import { describe, expect, it } from "vitest";
import { listTournamentMatches } from "./list";

function fakeSupabase(queue: { data: unknown }[]) {
  return {
    from: () => {
      const response = queue.shift() ?? { data: null };
      const promise = Promise.resolve(response);
      const chain: {
        select: () => typeof chain;
        eq: () => typeof chain;
        order: () => typeof chain;
        in: () => typeof chain;
        returns: () => typeof chain;
        then: Promise<unknown>["then"];
      } = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        in: () => chain,
        returns: () => chain,
        then: promise.then.bind(promise),
      };
      return chain;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const T1 = "11111111-1111-4111-8111-111111111111";
const M1 = "22222222-2222-4222-8222-222222222222";
const HOME = "33333333-3333-4333-8333-333333333333";
const AWAY = "44444444-4444-4444-8444-444444444444";
const P1 = "55555555-5555-4555-8555-555555555555";

describe("listTournamentMatches", () => {
  it("returns [] without any team/prediction queries when the tournament has no matches", async () => {
    const supabase = fakeSupabase([{ data: [] }]);
    const result = await listTournamentMatches(supabase, T1, P1);
    expect(result).toEqual([]);
  });

  it("resolves teams and the caller's own prediction for each match", async () => {
    const supabase = fakeSupabase([
      {
        data: [
          {
            id: M1,
            tournament_id: T1,
            stage: "group",
            group: "A",
            matchday: 1,
            home_team_id: HOME,
            away_team_id: AWAY,
            kickoff: "2026-06-01T17:00:00.000Z",
            lock_time: "2026-06-01T16:45:00.000Z",
            status: "finished",
            regular_result: { home: 2, away: 1 },
            live_score: null,
          },
        ],
      }, // matches
      {
        data: [
          { id: HOME, name: "Home FC", short_name: "HFC", flag_asset_url: null },
          { id: AWAY, name: "Away FC", short_name: "AFC", flag_asset_url: "https://example.com/away.png" },
        ],
      }, // teams
      {
        data: [
          {
            match_id: M1,
            predicted_home: 2,
            predicted_away: 1,
            points_earned: 10,
            outcome: "exact",
          },
        ],
      }, // match_predictions
    ]);

    const result = await listTournamentMatches(supabase, T1, P1);

    expect(result).toEqual([
      {
        id: M1,
        tournamentId: T1,
        stage: "group",
        group: "A",
        matchday: 1,
        kickoff: "2026-06-01T17:00:00.000Z",
        lockTime: "2026-06-01T16:45:00.000Z",
        status: "finished",
        regularResult: { home: 2, away: 1 },
        liveScore: null,
        homeTeam: { id: HOME, name: "Home FC", shortName: "HFC", flagAssetUrl: null },
        awayTeam: { id: AWAY, name: "Away FC", shortName: "AFC", flagAssetUrl: "https://example.com/away.png" },
        ownPrediction: {
          predictedHome: 2,
          predictedAway: 1,
          pointsEarned: 10,
          outcome: "exact",
        },
      },
    ]);
  });

  it("skips the prediction query and leaves ownPrediction null when participantId is null", async () => {
    const supabase = fakeSupabase([
      {
        data: [
          {
            id: M1,
            tournament_id: T1,
            stage: "group",
            group: "A",
            matchday: 1,
            home_team_id: HOME,
            away_team_id: AWAY,
            kickoff: "2026-06-01T17:00:00.000Z",
            lock_time: "2026-06-01T16:45:00.000Z",
            status: "scheduled",
            regular_result: null,
            live_score: null,
          },
        ],
      }, // matches
      {
        data: [
          { id: HOME, name: "Home FC", short_name: "HFC", flag_asset_url: null },
          { id: AWAY, name: "Away FC", short_name: "AFC", flag_asset_url: null },
        ],
      }, // teams
    ]);

    const [entry] = await listTournamentMatches(supabase, T1, null);
    expect(entry?.ownPrediction).toBeNull();
  });

  it("leaves homeTeam/awayTeam null when a team row is missing from the resolved set", async () => {
    const supabase = fakeSupabase([
      {
        data: [
          {
            id: M1,
            tournament_id: T1,
            stage: "final",
            group: null,
            matchday: null,
            home_team_id: HOME,
            away_team_id: AWAY,
            kickoff: "2026-07-01T17:00:00.000Z",
            lock_time: "2026-07-01T16:45:00.000Z",
            status: "scheduled",
            regular_result: null,
            live_score: null,
          },
        ],
      }, // matches
      { data: [] }, // teams — none resolved (still TBD)
      { data: [] }, // predictions
    ]);

    const [entry] = await listTournamentMatches(supabase, T1, P1);
    expect(entry?.homeTeam).toBeNull();
    expect(entry?.awayTeam).toBeNull();
  });
});
