import type { DigestStanding } from "@/lib/db/schema/push";

export function digestHighlights(
  current: DigestStanding[],
  baseline: DigestStanding[] | null,
) {
  const ordered = [...current].sort(
    (a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "he"),
  );
  const maxPoints = Math.max(0, ...current.map((p) => p.gained));
  const maxExact = Math.max(0, ...current.map((p) => p.exact));
  const moves = baseline
    ? current.flatMap((p) => {
        const old = baseline.find((b) => b.id === p.id);
        return old && old.rank > p.rank
          ? [{ ...p, up: old.rank - p.rank }]
          : [];
      })
    : [];
  const maxMove = Math.max(0, ...moves.map((p) => p.up));
  return {
    ordered,
    maxPoints,
    maxExact,
    maxMove,
    stars: maxPoints ? ordered.filter((p) => p.gained === maxPoints) : [],
    snipers: maxExact ? ordered.filter((p) => p.exact === maxExact) : [],
    movers: moves.filter((p) => p.up === maxMove),
    leaders: ordered.filter((p) => p.rank === 1),
    gap: ordered.length > 1 ? ordered[0].total - ordered[1].total : null,
  };
}
