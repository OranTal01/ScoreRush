import type { SummaryVisual } from "@/lib/notifications/summary-image";
import { digestHighlights } from "@/lib/notifications/highlights";
import { ShareSummary } from "@/app/(app)/summaries/share-summary";
import { rankLabel } from "@/lib/scoring/race";

export function SummaryCard({
  data,
  body,
  selfId,
}: {
  data: SummaryVisual;
  body: string;
  selfId: string;
}) {
  const h = digestHighlights(data.standings, data.baseline);
  const self = data.standings.find((p) => p.id === selfId);
  return (
    <article className="summary-card">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow">שריקת הסיום</span>
        <time
          dateTime={data.day}
          className="text-xs text-[var(--text-secondary)]"
        >
          {data.day.split("-").reverse().join(".")}
        </time>
      </header>
      <h2 className="mt-4 text-2xl font-black sm:text-3xl">
        {h.leaders.length > 1
          ? "צמוד בפסגה. פתוח לגמרי."
          : h.movers.length
            ? "היה ערב של מהפכים."
            : "עוד ערב. עוד סיפור בטבלה."}
      </h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        {data.tournamentName} · תמונת המצב בסיום הערב
      </p>
      <div className="my-5 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: h.stars.length > 1 ? "מצטייני הערב" : "מצטיין הערב",
            names: h.stars.map((p) => p.name),
            value: `${h.maxPoints} נק׳`,
            icon: "★",
          },
          {
            label: "הקפיצה בטבלה",
            names: h.movers.map((p) => p.name),
            value: h.maxMove ? `↑ ${h.maxMove} מקומות` : "אין עלייה מדודה",
            icon: "↗",
          },
          {
            label: "בול בתוצאה",
            names: h.snipers.map((p) => p.name),
            value: h.maxExact ? `${h.maxExact} פגיעות מדויקות` : "אף אחד הפעם",
            icon: "◎",
          },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/5 p-4">
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>{item.label}</span>
              <span className="text-[var(--gold)]" aria-hidden>
                {item.icon}
              </span>
            </div>
            <p className="mt-2 text-sm font-bold break-words">
              {item.names.join(" · ") || "ההזדמנות הבאה מחכה"}
            </p>
            <p className="mt-2 text-xs font-bold text-[var(--gold)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>
      {self && (
        <p className="mb-5 rounded-xl bg-[var(--interactive)]/10 px-4 py-3 text-sm leading-6">
          <strong>
            {self.name}, הוספתם {self.gained} נק׳ מהמשחקים.
          </strong>{" "}
          {rankLabel(
            self.rank,
            data.standings.filter((p) => p.rank === self.rank).length > 1,
          )}{" "}
          עם {self.total} נק׳.
        </p>
      )}
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold">
          הסיכום המלא והטבלה ↓
        </summary>
        <p className="mt-3 text-sm leading-7 [overflow-wrap:anywhere] whitespace-pre-wrap">
          {body}
        </p>
      </details>
      <div className="mt-4 border-t border-white/10 pt-4">
        <ShareSummary body={body} visual={data} />
      </div>
    </article>
  );
}
