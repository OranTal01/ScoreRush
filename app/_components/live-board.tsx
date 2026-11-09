"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LiveView } from "@/lib/live/types";
import { liveFresh } from "@/lib/live/changes";
import { formatMatchTime } from "@/lib/time";
import { ScorePair } from "./score-pair";
import { Card } from "./ui";
export function LiveBoard({ initial }: { initial: LiveView }) {
  const [view, setView] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(() => Date.now());
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    let alive = true,
      controller: AbortController | null = null;
    async function refresh() {
      if (controller || document.hidden) return;
      if (!navigator.onLine) {
        setError("אין חיבור כרגע. מוצג העדכון האחרון שהתקבל.");
        return;
      }
      controller = new AbortController();
      const timer = setTimeout(() => controller?.abort(), 15000);
      setBusy(true);
      try {
        const response = await fetch("/api/live", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("load");
        const data = (await response.json()) as LiveView;
        if (!alive) return;
        if (data.tournamentId !== initial.tournamentId) {
          setError("הטורניר הפעיל השתנה. רעננו את העמוד כדי לעבור אליו.");
          return;
        }
        setView(data);
        setError("");
        setNow(Date.now());
      } catch {
        if (alive)
          setError(
            "העדכון מתעכב. מוצגים הנתונים האחרונים שהתקבלו; ננסה שוב אוטומטית.",
          );
      } finally {
        clearTimeout(timer);
        controller = null;
        if (alive) setBusy(false);
      }
    }
    refreshRef.current = () => void refresh();
    const interval = setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 30000);
    const resume = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      alive = false;
      clearInterval(interval);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [initial.tournamentId]);
  const live = view.games.filter((m) => m.status === "live");
  const expired =
    !liveFresh(view.generatedAt, now, view.access) ||
    live.some((m) => !m.stale && !liveFresh(m.syncedAt, now, view.access));
  const projecting = view.projectedGames > 0 && !expired;
  const rows = projecting
    ? view.standings
    : [...view.standings].sort((a, b) => a.officialRank - b.officialRank);
  const self = rows.find((p) => p.id === view.selfId);
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-[var(--gold)]">
            {view.tournamentName}
          </span>
          <h1 className="page-heading mt-2">ערב המשחקים</h1>
          <p className="page-intro mt-2">התוצאה על הדשא. הסיפור שלכם בטבלה.</p>
        </div>
        <Link
          href="/profile"
          className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-3 text-xs font-bold text-[var(--interactive)]"
        >
          העדפות התראות 🔔
        </Link>
      </header>
      {view.access === "delayed" && (
        <p className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/5 p-4 text-xs leading-6 text-[var(--gold)]">
          החיבור הנוכחי מקבל תוצאות בעיכוב. החישוב מבוסס על העדכון האחרון מהספק;
          התראות שערים וכרטיסים ממתינות להפעלת שירות הלייב.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[var(--text-secondary)]">
          {live.length
            ? `${live.length} משחקים מתנהלים עכשיו`
            : "ממתינים למשחקים הבאים"}{" "}
          ·{" "}
          {view.access === "delayed" ? "לפי העדכון האחרון" : "מתרענן אוטומטית"}
        </span>
        <button
          disabled={busy}
          onClick={() => refreshRef.current()}
          className="min-h-11 rounded-xl px-3 font-bold text-[var(--interactive)] disabled:opacity-50"
        >
          {busy ? "מעדכן…" : "רענון ↻"}
        </button>
      </div>
      {error && (
        <p
          role="status"
          className="rounded-xl border border-[var(--gold)]/25 p-3 text-sm leading-6 text-[var(--gold)]"
        >
          {error}
        </p>
      )}
      {expired && live.length > 0 && (
        <p role="status" className="text-sm text-[var(--gold)]">
          הנתונים אינם עדכניים מספיק. ההערכה הזמנית הוסתרה עד שיתקבל עדכון.
        </p>
      )}
      <section
        className="relative overflow-hidden rounded-3xl border border-[var(--interactive)]/20 bg-gradient-to-bl from-[var(--interactive)]/15 via-[var(--surface-card)] to-[var(--bg-page)] p-5 sm:p-7"
        aria-label="המצב שלכם בערב המשחקים"
      >
        <span className="text-xs font-bold text-[var(--interactive)]">
          {projecting
            ? "אם המשחקים היו מסתיימים עכשיו…"
            : "המצב שלכם לפני המהלך הבא"}
        </span>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <span className="text-xs text-[var(--text-secondary)]">
              {projecting ? "מקום זמני" : "מקום נוכחי"}
            </span>
            <strong className="mt-2 block text-4xl font-black text-[var(--gold)]">
              {self
                ? projecting
                  ? self.projectedRank
                  : self.officialRank
                : "—"}
            </strong>
          </div>
          <div>
            <span className="text-xs text-[var(--text-secondary)]">
              {projecting ? "נקודות בהערכה" : "נקודות קיימות"}
            </span>
            <strong className="mt-2 block text-4xl font-black">
              {self
                ? projecting
                  ? self.projectedPoints
                  : self.officialPoints
                : "—"}
            </strong>
          </div>
          <div>
            <span className="text-xs text-[var(--text-secondary)]">
              {projecting ? "תוספת זמנית" : "על הדשא עכשיו"}
            </span>
            <strong className="mt-2 block text-4xl font-black text-[var(--interactive)]">
              <bdi dir="ltr">
                {projecting && self
                  ? `${self.temporaryPoints > 0 ? "+" : ""}${self.temporaryPoints}`
                  : live.length}
              </bdi>
            </strong>
          </div>
        </div>
        <p className="mt-5 text-xs leading-6 text-[var(--text-secondary)]">
          {projecting
            ? `ההערכה כוללת ${view.projectedGames} משחקים עם נתונים עדכניים וניחושים נעולים. שער נוסף יכול לשנות הכול.`
            : "כשהמשחקים יתחילו ויתקבלו נתונים עדכניים, תוכלו לראות כאן איך התוצאות משפיעות עליכם."}{" "}
          הניקוד הרשמי משתנה רק אחרי סיום המשחק ואימות התוצאה.
        </p>
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-4">
          <h2 className="text-lg font-extrabold">על הדשא</h2>
          {!view.games.length && (
            <Card>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                אין כרגע משחקים להצגה. אפשר לחזור למסך המשחקים ולהשלים ניחושים
                מראש.
              </p>
              <Link
                href="/predictions"
                className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--interactive)]"
              >
                לניחושים ←
              </Link>
            </Card>
          )}
          {view.games.map((game) => {
            const stale =
              game.status === "live" &&
              !liveFresh(game.syncedAt, now, view.access);
            return (
              <Card key={game.id} className="space-y-4">
                <div className="flex flex-wrap justify-between gap-2 text-xs">
                  <span
                    className={
                      game.status === "live"
                        ? "font-bold text-[var(--danger)]"
                        : "text-[var(--text-secondary)]"
                    }
                  >
                    {game.status === "live"
                      ? game.details?.period === "EXTRA_TIME"
                        ? "הארכה"
                        : game.details?.period === "PENALTY_SHOOTOUT"
                          ? "דו־קרב פנדלים"
                          : game.details?.minute != null
                            ? `במשחק · דקה ${game.details.minute}`
                            : "במשחק"
                      : game.status === "finished"
                        ? "הסתיים"
                        : formatMatchTime(game.kickoff)}
                  </span>
                  <Link
                    href={`/predictions/${game.id}`}
                    className="font-bold text-[var(--interactive)]"
                  >
                    פרטים וניחושי החבר׳ה ←
                  </Link>
                </div>
                <div
                  dir="rtl"
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-center"
                >
                  <bdi className="text-sm font-extrabold [overflow-wrap:anywhere]">
                    {game.home}
                  </bdi>
                  {game.score ? (
                    <ScorePair
                      home={game.score.home}
                      away={game.score.away}
                      homeLabel={game.home}
                      awayLabel={game.away}
                      className="text-3xl font-black"
                    />
                  ) : (
                    <span className="text-xl text-[var(--text-muted)]">—</span>
                  )}
                  <bdi className="text-sm font-extrabold [overflow-wrap:anywhere]">
                    {game.away}
                  </bdi>
                </div>
                {game.details?.period !== "REGULAR" &&
                  game.details?.regulationScore && (
                    <p className="text-center text-xs text-[var(--text-secondary)]">
                      תוצאת 90 דקות לצורך הניקוד: {game.home}{" "}
                      {game.details.regulationScore.home} · {game.away}{" "}
                      {game.details.regulationScore.away}
                    </p>
                  )}
                {game.retrospective && (
                  <p className="text-xs leading-6 text-[var(--gold)]">
                    תקופת קליטה פתוחה · המשחק אינו נכלל בהערכה הזמנית.
                  </p>
                )}
                {game.ownPrediction && (
                  <div
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-sm ${game.temporaryOutcome === "exact" && !stale ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-white/5"}`}
                  >
                    <span>
                      {game.ownPrediction.isDefault
                        ? "ברירת מחדל · לא נשלח ניחוש"
                        : "הניחוש שלכם"}{" "}
                      <ScorePair
                        home={game.ownPrediction.home}
                        away={game.ownPrediction.away}
                        homeLabel={game.home}
                        awayLabel={game.away}
                        className="ms-2 font-black"
                      />
                    </span>
                    {game.temporaryPoints !== null && !stale && (
                      <b>
                        {game.temporaryOutcome === "exact"
                          ? "🎯 בול כרגע · "
                          : "כרגע "}
                        {game.temporaryPoints} נק׳ זמניות
                      </b>
                    )}
                  </div>
                )}
                {game.status === "live" && (
                  <p
                    className={`text-[11px] leading-5 ${stale ? "text-[var(--gold)]" : "text-[var(--text-muted)]"}`}
                  >
                    {stale
                      ? "העדכון מתעכב · מוצגת התוצאה האחרונה שהתקבלה"
                      : game.syncedAt
                        ? `נתוני הספק נקלטו ב־${formatMatchTime(game.syncedAt)}`
                        : "ממתינים לנתוני הספק"}
                  </p>
                )}
              </Card>
            );
          })}
        </section>
        <section className="min-w-0 space-y-4">
          <Card className="space-y-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="text-lg font-extrabold">
                {projecting ? "הטבלה הזמנית" : "הטבלה כרגע"}
              </h2>
              <Link
                href="/leaderboard"
                className="text-xs font-bold text-[var(--interactive)]"
              >
                לטבלה הרשמית ←
              </Link>
            </div>
            <p className="text-xs leading-6 text-[var(--text-secondary)]">
              {projecting
                ? "החצים משווים למיקום הרשמי. שוויון בנקודות = שוויון במקום. הנקודות הזמניות עדיין לא נוספו לטבלה הרשמית."
                : "מוצגות הנקודות הקיימות. הטבלה הזמנית תופיע כשיהיו משחקים מתאימים לחישוב."}
            </p>
            <ol className="divide-y divide-white/10">
              {rows.map((p) => {
                const movement = p.officialRank - p.projectedRank;
                return (
                  <li
                    key={p.id}
                    className={`flex min-w-0 items-center gap-3 py-3 ${p.id === view.selfId ? "text-[var(--interactive)]" : ""}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm leading-none font-black tabular-nums">
                      {projecting ? p.projectedRank : p.officialRank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <bdi className="block text-sm font-bold [overflow-wrap:anywhere]">
                        {p.name}
                        {p.id === view.selfId ? " · אתם" : ""}
                      </bdi>
                      {projecting && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {p.officialPoints} קיימות ·{" "}
                          {p.temporaryPoints > 0 ? "+" : ""}
                          {p.temporaryPoints} זמניות
                        </span>
                      )}
                    </div>
                    {projecting && movement !== 0 && (
                      <span
                        aria-label={`${movement > 0 ? "עלייה" : "ירידה"} של ${Math.abs(movement)} מקומות`}
                        className={`text-xs font-bold ${movement > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
                      >
                        <bdi dir="ltr">
                          {movement > 0 ? "↑" : "↓"}
                          {Math.abs(movement)}
                        </bdi>
                      </span>
                    )}
                    <strong className="shrink-0 text-lg font-black">
                      {projecting ? p.projectedPoints : p.officialPoints}
                    </strong>
                  </li>
                );
              })}
            </ol>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-extrabold">הרגעים של הערב</h2>
            {view.events.length ? (
              <ol className="space-y-4">
                {view.events.map((event) => (
                  <li
                    key={event.id}
                    className="border-s-2 border-[var(--interactive)]/30 ps-3"
                  >
                    <Link
                      href={`/predictions/${event.matchId}`}
                      className="block text-sm leading-6 font-semibold"
                    >
                      {event.description}
                    </Link>
                    <time
                      className="mt-1 block text-[11px] text-[var(--text-muted)]"
                      dateTime={event.createdAt}
                    >
                      {formatMatchTime(event.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                {view.access === "delayed"
                  ? "אירועי שערים וכרטיסים יופיעו כאן אחרי הפעלת שירות הלייב."
                  : "כאן יופיעו האירועים המשמעותיים שיתקבלו במהלך המשחקים. אירועים שהתרחשו לפני תחילת המעקב לא משוחזרים."}
              </p>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
