import type { LiveObservation, LiveChange } from "./types";
const scoreEqual = (a: LiveObservation["score"], b: LiveObservation["score"]) =>
  a?.home === b?.home && a?.away === b?.away;
export function detectLiveChanges(
  before: LiveObservation | null,
  after: LiveObservation,
): LiveChange[] {
  if (!before) return [];
  const elapsed = Date.parse(after.observedAt) - Date.parse(before.observedAt);
  if (elapsed <= 0 || elapsed > 180000) return [];
  if (
    before.details?.sourceUpdatedAt &&
    after.details?.sourceUpdatedAt &&
    Date.parse(after.details.sourceUpdatedAt) <
      Date.parse(before.details.sourceUpdatedAt)
  )
    return [];
  const changes: LiveChange[] = [];
  const add = (change: Omit<LiveChange, "before" | "after">) =>
    changes.push({ ...change, before, after });
  if (before.status !== "live" && after.status === "live")
    add({ kind: "kickoff" });
  if (
    !["live", "finished"].includes(after.status) ||
    !["scheduled", "live"].includes(before.status)
  )
    return changes;
  // Don't manufacture a goal from the first known score. Shootout scores and
  // the switch between periods are deliberately excluded from goal alerts.
  if (
    before.status === "live" &&
    after.status === "live" &&
    before.score &&
    after.score &&
    after.details?.period !== "PENALTY_SHOOTOUT" &&
    before.details?.period === after.details?.period &&
    !scoreEqual(before.score, after.score)
  ) {
    const home = after.score.home - before.score.home,
      away = after.score.away - before.score.away;
    add(
      home === 1 && away === 0
        ? { kind: "goal", side: "home" }
        : away === 1 && home === 0
          ? { kind: "goal", side: "away" }
          : { kind: "score_change" },
    );
  }
  const oldCards = before.details?.cards,
    newCards = after.details?.cards;
  if (oldCards && newCards) {
    for (const card of newCards)
      if (!oldCards.some((c) => c.key === card.key))
        add({ kind: "red_card", card });
    for (const card of oldCards)
      if (!newCards.some((c) => c.key === card.key))
        add({ kind: "card_correction", card });
  }
  if (before.status === "live" && after.status === "finished")
    add({ kind: "finished" });
  return changes;
}
export function liveFresh(
  observedAt: string | null,
  now: number,
  access: "delayed" | "scores" | "events",
) {
  if (!observedAt) return false;
  const age = now - Date.parse(observedAt);
  return (
    age >= -30000 && age <= (access === "delayed" ? 20 * 60000 : 3 * 60000)
  );
}
