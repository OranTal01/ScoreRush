"use client";
import { useState } from "react";
import Link from "next/link";
import { Card } from "./ui";
import { formatMatchTime } from "@/lib/time";
import { roundWinners, type RoundRecord } from "@/lib/history/rounds";
export type PendingRound = {
  key: string;
  label: string;
  finished: number;
  total: number;
  onboarding: boolean;
  historical: boolean;
};
export function RoundHistory({
  records,
  selfId,
  pending,
}: {
  records: RoundRecord[];
  selfId: string;
  pending: PendingRound[];
}) {
  const [selected, setSelected] = useState(selfId);
  const members = new Map(
    records.flatMap((r) => r.standings.map((p) => [p.id, p.name] as const)),
  );
  const ranks = records.map(
    (r) => r.standings.find((p) => p.id === selected)?.rank ?? null,
  );
  const maxRank = Math.max(
    2,
    ...records.flatMap((r) => r.standings.map((p) => p.rank)),
  );
  const x = (i: number) =>
    records.length === 1 ? 240 : 32 + (i * 416) / (records.length - 1);
  const y = (rank: number) => 28 + ((rank - 1) / (maxRank - 1)) * 120;
  const chosenName = members.get(selected) ?? "שלכם";
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
      <header>
        <Link
          href="/leaderboard"
          className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--interactive)]"
        >
          → בחזרה לטבלה
        </Link>
        <h1 className="page-heading">הסיפור של העונה</h1>
        <p className="page-intro mt-2">
          מי טיפס, מי לקח את המחזור ואיך השתנה המרוץ לפסגה.
        </p>
      </header>
      {records.length > 0 ? (
        <>
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">הדרך במעלה הטבלה</h2>
              <label className="flex min-w-0 items-center gap-2 text-xs">
                מציגים את
                <select
                  aria-label="משתתף בהיסטוריית הדירוג"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="h-11 max-w-48 min-w-0 rounded-xl border border-white/15 bg-[var(--bg-page)] px-3 text-sm"
                >
                  {!members.has(selfId) && (
                    <option value={selfId}>המסלול שלי</option>
                  )}
                  {[...members].map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                      {id === selfId ? " · אתם" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs leading-6 text-[var(--text-secondary)]">
              גבוה יותר בגרף = מקום טוב יותר. כל נקודה היא המיקום הכללי בעת
              סגירת מחזור. שוויון בנקודות נשאר שוויון במקום.
            </p>
            <svg
              viewBox="0 0 480 195"
              role="img"
              aria-label={`מסלול הדירוג של ${chosenName}; הערכים המלאים בטבלה שמתחת לגרף`}
              className="w-full overflow-visible"
              style={{ direction: "ltr" }}
            >
              {[1, maxRank].map((rank) => (
                <g key={rank}>
                  <line
                    x1="32"
                    x2="448"
                    y1={y(rank)}
                    y2={y(rank)}
                    stroke="currentColor"
                    opacity="0.1"
                  />
                  <text
                    x="12"
                    y={y(rank) + 4}
                    fill="var(--text-muted)"
                    fontSize="12"
                    textAnchor="middle"
                  >
                    {rank}
                  </text>
                </g>
              ))}
              {ranks.map((rank, i) =>
                rank === null ? null : (
                  <g key={records[i].key}>
                    {i > 0 && ranks[i - 1] !== null && (
                      <line
                        x1={x(i - 1)}
                        y1={y(ranks[i - 1]!)}
                        x2={x(i)}
                        y2={y(rank)}
                        stroke="var(--interactive)"
                        strokeWidth="3"
                      />
                    )}
                    <circle cx={x(i)} cy={y(rank)} r="6" fill="var(--gold)" />
                    <text
                      x={x(i)}
                      y={y(rank) - 12}
                      fontSize="12"
                      textAnchor="middle"
                      fill="var(--text-primary)"
                    >
                      {rank}
                    </text>
                    <title>
                      {records[i].label}: מקום {rank}
                    </title>
                  </g>
                ),
              )}
              <text
                x="32"
                y="184"
                textAnchor="start"
                fill="var(--text-muted)"
                fontSize="12"
              >
                תחילת התיעוד
              </text>
              <text
                x="448"
                y="184"
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize="12"
              >
                העדכון האחרון
              </text>
            </svg>
            {ranks.every((r) => r === null) && (
              <p className="text-sm text-[var(--text-secondary)]">
                עדיין לא השתתפתם במחזור שתועד. המסלול שלכם יתחיל בסגירת המחזור
                הבא.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <caption className="sr-only">
                  דירוג וניקוד לפי מחזור עבור {chosenName}
                </caption>
                <thead className="text-[var(--text-muted)]">
                  <tr>
                    {["מחזור", "מקום", "נק׳ במחזור", "סה״כ אז"].map((h) => (
                      <th key={h} className="px-1 py-3 text-start font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const p = r.standings.find((p) => p.id === selected);
                    return (
                      <tr key={r.key} className="border-t border-white/10">
                        <th className="max-w-40 px-1 py-3 text-start font-semibold">
                          {r.label}
                        </th>
                        <td className="px-1 font-black text-[var(--interactive)]">
                          {p?.rank ?? "—"}
                        </td>
                        <td className="px-1">{p?.roundPoints ?? "—"}</td>
                        <td className="px-1">{p?.total ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <h2 className="text-lg font-extrabold">כוכבי המחזורים</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[...records].reverse().map((r) => {
              const winners = roundWinners(r.standings);
              const self = r.standings.find((p) => p.id === selfId);
              return (
                <Card key={r.key} className="space-y-4">
                  <header className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-bold">{r.label}</h3>
                    <span aria-hidden className="text-2xl">
                      🏆
                    </span>
                  </header>
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {winners.length > 1
                        ? "חולקים את ניצחון המחזור"
                        : "מנצח/ת המחזור"}
                    </p>
                    <p className="mt-2 text-xl leading-8 font-black [overflow-wrap:anywhere] text-[var(--gold)]">
                      {winners.map((p) => p.name).join(" · ")}
                    </p>
                    <p className="mt-1 text-sm">
                      {winners[0]?.roundPoints ?? 0} נק׳ ממשחקי המחזור
                    </p>
                  </div>
                  {self && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl bg-white/5 p-3 text-xs">
                      <b>המחזור שלכם</b>
                      <span>{self.roundPoints} נק׳</span>
                      <span>{self.exact} בול</span>
                      <span>מקום {self.rank} בסגירה</span>
                    </div>
                  )}
                  <p className="text-[11px] leading-5 text-[var(--text-muted)]">
                    נשמר ב־{formatMatchTime(r.capturedAt)}
                  </p>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <Card className="space-y-4 border-[var(--interactive)]/20">
          <span className="text-3xl" aria-hidden>
            ↗
          </span>
          <h2 className="text-xl font-extrabold">המסלול שלכם מתחיל כאן</h2>
          <p className="text-sm leading-7 text-[var(--text-secondary)]">
            בסגירת המחזור הראשון שתועד יופיעו כאן הגרף, נקודות המחזור והמנצחים.
            הסגירה מתבצעת אחרי סיום כל המשחקים, חישוב הנקודות וסיום תקופת
            הקליטה.
          </p>
          <Link className="action-primary inline-flex" href="/predictions">
            למשחקים ולניחושים ←
          </Link>
        </Card>
      )}
      {pending.length > 0 && (
        <Card className="space-y-4">
          <h2 className="font-extrabold">לקראת הפרק הבא</h2>
          {pending.map((r) => (
            <div key={r.key} className="border-t border-white/10 pt-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <b>{r.label}</b>
                <span className="text-[var(--text-secondary)]">
                  {r.finished}/{r.total} משחקים הסתיימו
                </span>
              </div>
              <p className="mt-2 text-xs leading-6 text-[var(--gold)]">
                {r.historical
                  ? "המחזור הסתיים לפני תחילת התיעוד. אין עבורו דירוג היסטורי שמור."
                  : r.onboarding
                    ? "ממתינים לסיום תקופת הקליטה"
                    : r.finished === r.total
                      ? "ממתינים לאימות ולחישוב כל הנקודות"
                      : "הדירוג יישמר אחרי סיום כל משחקי המחזור"}
              </p>
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs leading-6 text-[var(--text-secondary)]">
        ניצחון מחזור נקבע לפי נקודות משחקי המחזור בלבד. הדירוג הכללי כולל גם
        דירוג קבוצות ובונוסים. ההיסטוריה משמרת את מצב הטבלה בזמן התיעוד; תיקונים
        מאוחרים יופיעו בטבלה הנוכחית ובעדכונים הבאים.
      </p>
    </div>
  );
}
