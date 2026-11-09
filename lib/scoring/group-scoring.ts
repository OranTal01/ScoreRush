import {
  EXACT_RANKING,
  rankingBands,
  type RankingConfig,
} from "./ranking-config";

/** Exact positions for traditional groups; unordered bands for league phases.
 * The caller must first verify that the official stage has finished. */
export function scoreGroupRanking(
  actualOrder: readonly string[],
  predictedOrder: readonly string[],
  pointsPerPosition: number,
  config: RankingConfig = EXACT_RANKING,
): number {
  if (config.mode === "bands") {
    const bands = rankingBands(config);
    const count = bands.at(-1)?.end ?? 0;
    if (
      count !== actualOrder.length ||
      count !== predictedOrder.length ||
      new Set(actualOrder).size !== count ||
      new Set(predictedOrder).size !== count ||
      predictedOrder.some((id) => !actualOrder.includes(id))
    ) {
      throw new Error(
        "Ranking bands require the complete, unique tournament roster",
      );
    }
    return bands.reduce((total, band) => {
      const actual = new Set(actualOrder.slice(band.start, band.end));
      return (
        total +
        predictedOrder
          .slice(band.start, band.end)
          .filter((id) => actual.has(id)).length *
          pointsPerPosition
      );
    }, 0);
  }
  return actualOrder.reduce(
    (total, id, index) =>
      total + (predictedOrder[index] === id ? pointsPerPosition : 0),
    0,
  );
}
