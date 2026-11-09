import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { matches, teams } from "@/lib/db/schema/competition";
import { tournamentProviders } from "@/lib/db/schema/config";
import { systemEvents } from "@/lib/db/schema/audit";
const schema = z.object({
  standings: z.array(
    z.object({
      type: z.string(),
      stage: z.string().optional(),
      table: z.array(
        z.object({
          position: z.number().int().positive(),
          playedGames: z.number().int(),
          team: z.object({ id: z.number().int() }),
        }),
      ),
    }),
  ),
});
export async function getOfficialLeagueOrder(
  tournamentId: string,
  store: Pick<typeof db, "select" | "insert"> = db,
): Promise<string[]> {
  const [binding] = await store
    .select()
    .from(tournamentProviders)
    .where(eq(tournamentProviders.tournamentId, tournamentId))
    .limit(1);
  const config = binding?.matchDataConfig as {
    competitionCode?: string;
    season?: number;
  } | null;
  if (
    binding?.matchDataProvider !== "football_data_org" ||
    !config?.competitionCode
  )
    throw new Error("Official league standings require a configured provider");
  const token = process.env.FOOTBALL_DATA_API_TOKEN;
  if (!token) throw new Error("Missing football data token");
  const response = await fetch(
    `https://api.football-data.org/v4/competitions/${encodeURIComponent(config.competitionCode)}/standings?season=${config.season}`,
    {
      headers: { "X-Auth-Token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new Error(`Official standings returned ${response.status}`);
  const raw: unknown = await response.json();
  const parsed = schema.parse(raw);
  const rows = parsed.standings.find(
    (s) => s.type === "TOTAL" && (!s.stage || s.stage === "LEAGUE_STAGE"),
  )?.table;
  const roster = await store
    .select()
    .from(teams)
    .where(eq(teams.tournamentId, tournamentId));
  const leagueTeams = roster.filter((t) => t.group === "league");
  const fixtures = await store
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));
  const expectedGames = new Map<string, number>();
  for (const match of fixtures.filter((m) => m.group === "league")) {
    for (const teamId of [match.homeTeamId, match.awayTeamId])
      expectedGames.set(teamId, (expectedGames.get(teamId) ?? 0) + 1);
  }
  const internalIds = new Map(
    leagueTeams.map((team) => [String(team.providerId), team.id]),
  );
  if (
    !rows ||
    rows.length !== leagueTeams.length ||
    rows.some(
      (r) =>
        r.playedGames < 1 ||
        r.playedGames !==
          expectedGames.get(internalIds.get(String(r.team.id)) ?? ""),
    )
  )
    throw new Error(
      "Official league standings are incomplete; ranking scores held back",
    );
  const ids = new Map(leagueTeams.map((t) => [t.providerId, t.id]));
  const order = [...rows]
    .sort((a, b) => a.position - b.position)
    .map((r) => ids.get(String(r.team.id)));
  if (
    rows.some((r) => r.position < 1 || r.position > leagueTeams.length) ||
    new Set(rows.map((r) => r.position)).size !== leagueTeams.length ||
    order.some((id) => !id) ||
    new Set(order).size !== leagueTeams.length
  )
    throw new Error("Official standings contain unknown or duplicate teams");
  await store.insert(systemEvents).values({
    tournamentId,
    type: "official_league_final_standings",
    payload: raw,
  });
  return order as string[];
}
