import Link from "next/link";
import { raceContext, rankLabel, type RaceEntry } from "@/lib/scoring/race";

export function RaceCard({
  entries,
  selfId,
  compact = false,
}: {
  entries: RaceEntry[];
  selfId: string;
  compact?: boolean;
}) {
  const race = raceContext(entries, selfId);
  if (!race) return null;
  return (
    <section className="race-card" aria-label="המרוץ שלכם">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">המרוץ שלכם</p>
        <span className="text-xs font-bold text-[var(--gold)]">
          {rankLabel(race.self.rank, race.tied)}
        </span>
      </div>
      <h2 className="mt-3 text-xl leading-snug font-extrabold">
        {race.above ? (
          <>
            {race.aboveGap} נק׳ עד <bdi>{race.above.name}</bdi>
          </>
        ) : race.tied ? (
          "כתף אל כתף בפסגה."
        ) : entries.length > 1 ? (
          "כולם רודפים אחריכם."
        ) : (
          "המרוץ מתחיל כאן."
        )}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {race.above
          ? `זה הפער לשוויון עם המקום שמעליכם.${race.leaderGap !== race.aboveGap ? ` לפסגה חסרות ${race.leaderGap} נקודות.` : ""}`
          : race.below
            ? `יתרון של ${race.belowGap} נקודות על ${race.below.name}. כל משחק יכול לשנות את התמונה.`
            : race.tied
              ? "אותן נקודות, אותו מקום. המשחק הבא יכול להפריד ביניכם."
              : "כשהחברים יצטרפו, תראו כאן את הקרב הקרוב שלכם."}
      </p>
      {!compact && (
        <Link
          href="/leaderboard#my-standing"
          className="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-[var(--interactive)]"
        >
          למיקום שלי בטבלה ←
        </Link>
      )}
    </section>
  );
}
