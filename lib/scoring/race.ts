export type RaceEntry = {
  id: string;
  name: string;
  rank: number;
  total: number;
};

export function raceContext(entries: RaceEntry[], selfId: string) {
  const sorted = [...entries].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, "he"),
  );
  const self = sorted.find((p) => p.id === selfId);
  if (!self) return null;
  const tied = sorted.filter((p) => p.rank === self.rank).length > 1;
  const above = sorted.filter((p) => p.total > self.total).at(-1) ?? null;
  const below = sorted.find((p) => p.total < self.total) ?? null;
  return {
    self,
    tied,
    above,
    below,
    leaderGap: (sorted[0]?.total ?? self.total) - self.total,
    aboveGap: above ? above.total - self.total : null,
    belowGap: below ? self.total - below.total : null,
  };
}

export function rankLabel(rank: number, tied: boolean) {
  if (rank < 1) return "טרם דורג";
  return rank === 1
    ? `מקום ראשון${tied ? " משותף" : ""}`
    : `מקום ${rank}${tied ? " משותף" : ""}`;
}
