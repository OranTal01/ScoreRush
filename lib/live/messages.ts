import { footballName } from "@/lib/content/football-names";
import type { LiveChange } from "./types";
import {
  scoreMatchPrediction,
  type MatchScoringRules,
} from "@/lib/scoring/match-scoring";
export function describeLiveChange(
  change: LiveChange,
  home: string,
  away: string,
  homeProviderId: string | null,
) {
  home = footballName(home);
  away = footballName(away);
  const isolate = (value: string) => `\u2068${value}\u2069`;
  const score = change.after.score;
  const result = score
    ? `${isolate(`${home} ${score.home}`)} · ${isolate(`${away} ${score.away}`)}`
    : `${isolate(home)} מול ${isolate(away)}`;
  const cardTeam = change.card?.teamId === homeProviderId ? home : away;
  const cardRecipient = `${isolate(cardTeam)}${change.card?.player ? ` · ${isolate(footballName(change.card.player))}` : ""}`;
  switch (change.kind) {
    case "goal":
      return `⚽ שער ל־${isolate(change.side === "home" ? home : away)}! ${result}`;
    case "score_change":
      return `עודכנה התוצאה: ${result}`;
    case "red_card":
      return `🟥 כרטיס אדום ל־${cardRecipient}${change.card?.minute != null ? ` · דקה ${change.card.minute}` : ""}`;
    case "card_correction":
      return `עדכון מהספק: הוסר דיווח הכרטיס האדום של ${cardRecipient}`;
    case "kickoff":
      return `המשחק יצא לדרך · ${isolate(home)} מול ${isolate(away)}`;
    case "finished":
      return `שריקת סיום · ${result}`;
  }
}
export function predictionImpact(
  change: LiveChange,
  prediction: { home: number; away: number; isDefault: boolean } | null,
  rules: MatchScoringRules,
) {
  if (
    !prediction ||
    prediction.isDefault ||
    !change.after.details?.regulationScore
  )
    return "";
  if (!["goal", "score_change", "finished"].includes(change.kind)) return "";
  const current = scoreMatchPrediction(
    change.after.details.regulationScore,
    prediction,
    rules,
  );
  const previous = change.before.details?.regulationScore
    ? scoreMatchPrediction(
        change.before.details.regulationScore,
        prediction,
        rules,
      )
    : null;
  const prefix =
    change.after.details.period !== "REGULAR" ? "לפי תוצאת 90 הדקות: " : "";
  return `${prefix}${current.outcome === "exact" ? "הניחוש שלך כרגע מדויק 🎯" : `הניחוש שלך כרגע שווה ${current.points} נק׳`}${previous && previous.points !== current.points ? ` (${current.points > previous.points ? "+" : ""}${current.points - previous.points} נק׳)` : ""}. הניקוד זמני עד לאימות.`;
}
