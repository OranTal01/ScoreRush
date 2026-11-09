import { Card } from "./ui";
import { ScorePair } from "./score-pair";
import type { FriendPrediction } from "@/lib/matches/reveal";

export function FriendsPredictions({
  picks,
  selfId,
  homeLabel,
  awayLabel,
  retrospective = false,
}: {
  picks: FriendPrediction[] | null;
  selfId: string;
  homeLabel: string;
  awayLabel: string;
  retrospective?: boolean;
}) {
  if (picks === null)
    return (
      <Card className="flex flex-col gap-3">
        <span className="text-xs font-bold text-[var(--gold)]">
          🔒 כל אחד והניחוש שלו
        </span>
        <h2 className="text-lg font-extrabold">מה החבר׳ה ניחשו?</h2>
        <p className="text-sm leading-7 text-[var(--text-secondary)]">
          {retrospective
            ? "הניחושים ייחשפו רק בסיום חלון ההשלמה, גם אם המשחק כבר הסתיים."
            : "הניחושים של כולם ייחשפו כאן אחרי נעילת המשחק. עד אז, רק אתם רואים את הבחירה שלכם."}
        </p>
      </Card>
    );
  const submitted = picks.filter(
    (p) => p.home !== null && p.away !== null && !p.isDefault,
  );
  const distribution = [
    submitted.filter((p) => p.home! > p.away!).length,
    submitted.filter((p) => p.home === p.away).length,
    submitted.filter((p) => p.home! < p.away!).length,
  ];
  const sorted = [...picks].sort(
    (a, b) =>
      Number(b.id === selfId) - Number(a.id === selfId) ||
      a.name.localeCompare(b.name, "he"),
  );
  return (
    <Card className="flex flex-col gap-4">
      <header>
        <span className="text-xs font-bold text-[var(--success)]">
          הבחירות ננעלו · הקלפים על השולחן
        </span>
        <h2 className="mt-2 text-lg font-extrabold">הניחושים של החבר׳ה</h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {submitted.length} מתוך {picks.length} חברים שלחו ניחוש
        </p>
      </header>
      {!!submitted.length && (
        <div className="grid grid-cols-3 gap-2">
          {[homeLabel, "תיקו", awayLabel].map((label, i) => (
            <div
              key={i}
              className="min-w-0 rounded-xl bg-white/5 p-3 text-center"
            >
              <b className="block text-xl text-[var(--interactive)]">
                {Math.round((distribution[i] / submitted.length) * 100)}%
              </b>
              <bdi className="mt-1 block text-xs [overflow-wrap:anywhere]">
                {label}
              </bdi>
            </div>
          ))}
        </div>
      )}
      <ul className="divide-y divide-white/10">
        {sorted.map((p) => (
          <li
            key={p.id}
            className={`flex min-w-0 items-center gap-3 py-4 ${p.id === selfId ? "text-[var(--interactive)]" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <bdi className="block text-sm font-bold [overflow-wrap:anywhere]">
                {p.name}
                {p.id === selfId ? " · אתם" : ""}
              </bdi>
              {(p.isDefault || p.home === null) && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  {p.isDefault ? "ברירת מחדל · לא נשלח ניחוש" : "לא נשלח ניחוש"}
                </span>
              )}
            </div>
            {p.home !== null && p.away !== null && (
              <ScorePair
                home={p.home}
                away={p.away}
                homeLabel={homeLabel}
                awayLabel={awayLabel}
                className="shrink-0 text-lg font-black"
              />
            )}
            <span className="w-12 shrink-0 text-end text-xs font-bold text-[var(--gold)]">
              {p.points !== null ? `${p.points} נק׳` : "—"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-6 text-[var(--text-secondary)]">
        האחוזים מתייחסים לניחושים שנשלחו. הניקוד מופיע אחרי חישוב תוצאת המשחק.
      </p>
    </Card>
  );
}
