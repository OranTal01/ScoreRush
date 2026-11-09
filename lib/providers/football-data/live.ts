import type { FDMatch } from "./schema";
import type { LiveDetails, LiveCard } from "@/lib/live/types";
import { toMatchScore } from "../normalize";
export function footballDataLiveDetails(raw: FDMatch): LiveDetails {
  const cards: LiveCard[] | null = raw.bookings
    ? raw.bookings
        .filter(
          (c) =>
            (c.card === "RED" || c.card === "YELLOW_RED") &&
            [raw.homeTeam.id, raw.awayTeam.id].includes(c.team.id),
        )
        .map((c) => ({
          key: `${c.team.id}:${c.player?.id ?? c.minute}:${c.card}`,
          teamId: String(c.team.id),
          player: c.player?.name ?? null,
          minute: c.minute ?? null,
          type: c.card as LiveCard["type"],
        }))
    : null;
  return {
    regulationScore:
      raw.score.duration === "REGULAR"
        ? toMatchScore(raw.score.fullTime)
        : toMatchScore(raw.score.regularTime),
    period: raw.score.duration,
    minute: raw.minute ?? null,
    sourceUpdatedAt: raw.lastUpdated
      ? new Date(raw.lastUpdated).toISOString()
      : null,
    cards,
  };
}
