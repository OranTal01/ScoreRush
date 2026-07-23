/**
 * Low-level football-data.org API v4 client. Server-only — the token must
 * never reach the browser (ARCHITECTURE.md §11).
 */
import "server-only";

const BASE_URL = "https://api.football-data.org/v4";

export class FootballDataApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FootballDataApiError";
    this.status = status;
  }
}

function getToken(): string {
  const token = process.env.FOOTBALL_DATA_API_TOKEN;
  if (!token) {
    throw new FootballDataApiError(
      "FOOTBALL_DATA_API_TOKEN is not set — see .env.local.example. Only tournaments using the football_data_org provider need it; manual-only tournaments don't.",
    );
  }
  return token;
}

/** Fetches the raw (unvalidated) matches envelope for one competition. Throws on network/HTTP failure — the caller decides fallback policy (ARCHITECTURE.md §5). */
export async function fetchFootballDataMatches(
  competitionCode: string,
  season?: number,
): Promise<unknown> {
  const token = getToken();
  const query = season ? `?season=${encodeURIComponent(String(season))}` : "";
  const res = await fetch(
    `${BASE_URL}/competitions/${encodeURIComponent(competitionCode)}/matches${query}`,
    {
      headers: { "X-Auth-Token": token },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new FootballDataApiError(
      `football-data.org returned HTTP ${res.status} for competition ${competitionCode}`,
      res.status,
    );
  }

  return res.json();
}

/**
 * Fetches the raw (unvalidated) top-scorers envelope for one competition —
 * powers bonus stats (top_scorer/top_assists via /scorers, DECISIONS.md
 * §3a), not match results. Throws on network/HTTP failure, same fallback
 * contract as `fetchFootballDataMatches` (ARCHITECTURE.md §5).
 */
export async function fetchFootballDataScorers(
  competitionCode: string,
  options?: { season?: number; limit?: number },
): Promise<unknown> {
  const token = getToken();
  const params = new URLSearchParams();
  if (options?.season) params.set("season", String(options.season));
  if (options?.limit) params.set("limit", String(options.limit));
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(
    `${BASE_URL}/competitions/${encodeURIComponent(competitionCode)}/scorers${query}`,
    {
      headers: { "X-Auth-Token": token },
      // The scorers endpoint is rate-limited more aggressively than
      // matches/teams on the free tier (DECISIONS.md §3a) — a short server
      // cache protects against e.g. an admin re-triggering sync repeatedly
      // in a short window. ScoreRush's sync job itself runs at most daily
      // (ARCHITECTURE.md §7), well under this limit regardless.
      next: { revalidate: 300 },
    },
  );

  if (!res.ok) {
    throw new FootballDataApiError(
      `football-data.org returned HTTP ${res.status} for competition ${competitionCode} scorers`,
      res.status,
    );
  }

  return res.json();
}
