import type { DigestStanding } from "@/lib/db/schema/push";
export function buildDigest(
  name: string,
  day: string,
  current: DigestStanding[],
  before: DigestStanding[] | null,
  games: number,
): string {
  if (!current.length) return "";
  const ordered = [...current].sort(
    (a, b) => a.rank - b.rank || a.name.localeCompare(b.name),
  );
  const best = Math.max(...current.map((p) => p.gained));
  const winners = current.filter((p) => p.gained === best);
  const exact = current
    .filter((p) => p.exact > 0)
    .sort((a, b) => b.exact - a.exact);
  const moves = before
    ? current
        .flatMap((p) => {
          const old = before.find((b) => b.id === p.id);
          return old && old.rank > p.rank
            ? [{ ...p, up: old.rank - p.rank }]
            : [];
        })
        .sort((a, b) => b.up - a.up)
    : [];
  const lines = [
    `⚽ סיכום הערב | ${name}`,
    `${day.split("-").reverse().join(".")} · ${games} משחקים הסתיימו`,
    "",
    "🏆 הטבלה עכשיו",
    ...ordered
      .filter((p) => p.rank <= 3)
      .map((p) => `${p.rank}. ${p.name} — ${p.total} נק׳`),
    "",
  ];
  if (best > 0)
    lines.push(
      `🔥 כוכבי הערב: ${winners
        .map((p) => p.name)
        .join(" ו")} עם ${best} נקודות מהמשחקים!`,
    );
  else lines.push("ערב קשוח לניחושים — הפעם אף אחד לא הוסיף נקודות מהמשחקים.");
  if (exact.length)
    lines.push(
      `🎯 בול בתוצאה: ${exact
        .slice(0, 3)
        .map((p) => `${p.name} (${p.exact})`)
        .join(" · ")}`,
    );
  if (moves.length)
    lines.push(
      `🚀 הקפיצה של הערב: ${moves
        .filter((p) => p.up === moves[0].up)
        .map((p) => p.name)
        .join(" ו")}, עלייה של ${moves[0].up} מקומות!`,
    );
  const formerLeaders = before?.filter((p) => p.rank === 1) ?? [];
  const newLeaders = ordered.filter(
    (p) =>
      p.rank === 1 &&
      formerLeaders.length > 0 &&
      !formerLeaders.some((old) => old.id === p.id),
  );
  if (newLeaders.length)
    lines.push(
      `👑 מהפך בפסגה: ${newLeaders.map((p) => p.name).join(" ו")} עלו למקום הראשון!`,
    );
  const leaders = ordered.filter((p) => p.rank === 1);
  if (leaders.length > 1)
    lines.push(
      `🤝 צמוד בפסגה: ${leaders.map((p) => p.name).join(" ו")} חולקים את המקום הראשון.`,
    );
  else if (ordered.length > 1)
    lines.push(
      `👀 הפער בפסגה: ${ordered[0].total - ordered[1].total} נקודות בלבד.`,
    );
  lines.push(
    "",
    "הטבלה המלאה והמשחקים הבאים:",
    "https://scorerush-sigma.vercel.app/leaderboard",
  );
  return lines.join("\n");
}
