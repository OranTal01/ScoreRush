"use client";
import {
  footballSearchText,
  normalizeFootballName,
} from "@/lib/content/football-names";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchWithTeams } from "@/lib/matches/list";
import { MatchCard } from "./match-card";
import { EmptyState } from "./ui";
import { QuickPrediction } from "./quick-prediction";
import { Deadline } from "./deadline";
import {
  canEditPrediction,
  focusMatches,
  hasSubmittedPrediction,
  roundProgress,
} from "@/lib/matches/progress";

type Filter = "all" | "missing" | "finished";

export function needsPrediction(match: MatchWithTeams, now = Date.now()) {
  return canEditPrediction(match, now) && !hasSubmittedPrediction(match);
}

export function MatchesBrowser({
  matches: initialMatches,
  draftScope,
}: {
  matches: MatchWithTeams[];
  draftScope: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [matches, setMatches] = useState(initialMatches);
  const current = focusMatches(matches, now)[0];
  const [matchday, setMatchday] = useState(
    current?.matchday?.toString() ?? "all",
  );
  const [quick, setQuick] = useState(false);
  const [viewVersion, setViewVersion] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const dirtyIds = useRef(new Set<string>());
  const onDirty = useCallback((id: string, dirty: boolean) => {
    if (dirty) dirtyIds.current.add(id);
    else dirtyIds.current.delete(id);
  }, []);
  function changeView(change: () => void) {
    if (
      dirtyIds.current.size &&
      !window.confirm(
        "יש ניחושים שטרם נשלחו. לעבור תצוגה? טיוטות זמינות יישמרו במכשיר.",
      )
    )
      return;
    dirtyIds.current.clear();
    // Remount from the same account-scoped draft when changing the visible set.
    setViewVersion((version) => version + 1);
    change();
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    const guard = (e: BeforeUnloadEvent) => {
      if (dirtyIds.current.size) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const linkGuard = (e: MouseEvent) => {
      if (
        dirtyIds.current.size &&
        (e.target as HTMLElement).closest("a[href]") &&
        !window.confirm(
          "יש ניחושים שטרם נשלחו. לצאת? טיוטות זמינות יישמרו במכשיר.",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", guard);
    document.addEventListener("click", linkGuard, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("beforeunload", guard);
      document.removeEventListener("click", linkGuard, true);
    };
  }, []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const matchdays = [
    ...new Set(
      matches.flatMap((match) =>
        match.matchday === null ? [] : [match.matchday],
      ),
    ),
  ].sort((a, b) => a - b);
  const filtered = matches.filter((match) => {
    if (matchday !== "all" && String(match.matchday) !== matchday) return false;
    if (filter === "missing" && !needsPrediction(match, now)) return false;
    if (filter === "finished" && match.status !== "finished") return false;
    const names = [
      match.homeTeam?.name,
      match.homeTeam?.shortName,
      match.awayTeam?.name,
      match.awayTeam?.shortName,
    ]
      .map((name) => footballSearchText(name ?? ""))
      .join(" ");
    return names.includes(normalizeFootballName(query));
  });

  const round = matches.filter(
    (m) => matchday === "all" || String(m.matchday) === matchday,
  );
  const progress = roundProgress(round, now);
  const hasEditable = round.some((m) => canEditPrediction(m, now));
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="רשימת המשחקים">
      <div className="round-progress">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">
              {matchday === "all" ? "כל הניחושים" : `מחזור ${matchday}`}
            </p>
            <h2 className="mt-1 text-xl font-extrabold">
              {progress.missing.length
                ? progress.missing.length === 1
                  ? "עוד ניחוש אחד ואתם מוכנים"
                  : `עוד ${progress.missing.length} ניחושים ואתם מוכנים`
                : progress.total && progress.saved === progress.total
                  ? "כל הניחושים מולאו ✓"
                  : "תוצאות המחזור"}
            </h2>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {progress.saved} מתוך {progress.total} משחקים מולאו · ניחוש
              אוטומטי אינו נספר כמילוי
            </p>
          </div>
          {hasEditable && (
            <button
              type="button"
              aria-pressed={quick}
              onClick={() => changeView(() => setQuick(!quick))}
              className="action-primary"
            >
              {quick ? "לתצוגת המשחקים" : "מילוי מהיר ⚡"}
            </button>
          )}
        </div>
        <progress
          className="pick-progress mt-4"
          max={Math.max(1, progress.total)}
          value={progress.saved}
          aria-label="התקדמות מילוי הניחושים"
        />
        {progress.retrospective ? (
          <p className="mt-2 text-xs text-[var(--gold)]">
            השלמת הניחושים החסרים פתוחה עד המועד שמופיע למעלה.
          </p>
        ) : (
          progress.deadline && (
            <div className="mt-2">
              <Deadline at={progress.deadline} />
            </div>
          )
        )}
        {quick && (
          <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">
            ממלאים תוצאה ולוחצים שמירה והבא. כל משחק נשמר בנפרד; שדה ריק לא נשמר
            כ־0.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[var(--surface-card)] p-3 sm:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <label className="min-w-0">
            <span className="sr-only">חיפוש קבוצה</span>
            <input
              value={query}
              onChange={(event) =>
                changeView(() => setQuery(event.target.value))
              }
              type="search"
              placeholder="חיפוש קבוצה…"
              className="h-12 w-full min-w-0 rounded-xl border border-white/10 bg-[var(--bg-elevated)] px-3 text-sm"
            />
          </label>
          <label>
            <span className="sr-only">מחזור</span>
            <select
              aria-label="מחזור"
              value={matchday}
              onChange={(event) =>
                changeView(() => setMatchday(event.target.value))
              }
              className="h-12 max-w-32 rounded-xl border border-white/10 bg-[var(--bg-elevated)] ps-2 pe-8 text-sm"
            >
              <option value="all">כל המחזורים</option>
              {matchdays.map((day) => (
                <option key={day} value={day}>
                  מחזור {day}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1" aria-label="סינון משחקים">
          {(
            [
              { value: "all", label: "הכול" },
              { value: "missing", label: "טרם ניחשתי" },
              { value: "finished", label: "הסתיימו" },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => changeView(() => setFilter(item.value))}
              className={`min-h-11 rounded-xl px-2 text-xs font-bold transition-colors ${filter === item.value ? "bg-[var(--interactive)]/15 text-[var(--interactive)]" : "text-[var(--text-secondary)] hover:bg-white/5"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <p role="status" className="text-xs text-[var(--text-secondary)]">
        {announcement ? `${announcement} · ` : ""}
        {filtered.length} משחקים
        {matchday !== "all" ? ` · מחזור ${matchday}` : ""}
      </p>
      {filtered.length ? (
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {filtered.map((match) =>
            quick && canEditPrediction(match, now) ? (
              <QuickPrediction
                draftScope={draftScope}
                key={`${match.id}:${viewVersion}`}
                match={match}
                now={now}
                onDirty={onDirty}
                onSaved={(id, prediction) => {
                  dirtyIds.current.delete(id);
                  setMatches((previous) =>
                    previous.map((m) =>
                      m.id === id ? { ...m, ownPrediction: prediction } : m,
                    ),
                  );
                  setAnnouncement("הניחוש נשמר");
                  const next = filtered
                    .slice(filtered.findIndex((m) => m.id === id) + 1)
                    .find((m) => needsPrediction(m, now));
                  if (next)
                    requestAnimationFrame(() => {
                      const input = document.querySelector<HTMLInputElement>(
                        `[data-quick-match="${next.id}"] input`,
                      );
                      input?.focus({ preventScroll: true });
                      input?.closest("form")?.scrollIntoView({
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "instant"
                          : "smooth",
                        block: "center",
                      });
                    });
                }}
              />
            ) : (
              <MatchCard key={match.id} match={match} />
            ),
          )}
        </div>
      ) : (
        <EmptyState
          message={
            filter === "missing" && !query
              ? "כל הניחושים הפתוחים בתצוגה הזאת הושלמו. אפשר לבדוק גם מחזורים אחרים."
              : "לא נמצאו משחקים בסינון הזה. נסו מחזור אחר או חיפוש שונה."
          }
        />
      )}
    </section>
  );
}
