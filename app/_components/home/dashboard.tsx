import { LiveLink } from "../live-link";
import Link from "next/link";
import { Deadline } from "../deadline";
import { RaceCard } from "../leaderboard/race-card";
import { rankLabel, type RaceEntry } from "@/lib/scoring/race";
import type { MatchWithTeams } from "@/lib/matches/list";
import { formatMatchTime } from "@/lib/mock/clock";
import {
  Avatar,
  Card,
  EmptyState,
  Pill,
  RankBadge,
  SectionHeader,
} from "../ui";
import { MatchCard } from "../match-card";
import { ScorePair } from "../score-pair";
import { IconBonuses, IconLeaderboard, IconPredictions } from "../icons";
import { RankMovementChip } from "./hero-stats";

type Progress = {
  matchesSaved: number;
  matchesTotal: number;
  bonusSaved: number;
  bonusTotal: number;
  rankingSaved: number;
  rankingTotal: number;
};

export type HomeDashboardProps = {
  name: string;
  tournamentName: string;
  onboardingOpen: boolean;
  rank: number;
  points: number;
  rankMoved: number;
  selfId: string;
  raceEntries: RaceEntry[];
  roundLabel: string;
  missingCount: number;
  deadline: string | null;
  retrospective: boolean;
  latestSummary: { day: string; count: number } | null;
  participantCount: number;
  progress: Progress | null;
  predictionHref: string;
  nextMatch: MatchWithTeams | null;
  latestFinished: MatchWithTeams | null;
  leaders: {
    id: string;
    name: string;
    initials: string;
    rank: number;
    points: number;
    self: boolean;
  }[];
  recentResults: MatchWithTeams[];
  bonusLeaders: { category: string; name: string }[];
  exactStreak: number;
  correctStreak: number;
  accuracyPercent: number | null;
};

export function HomeDashboard(props: HomeDashboardProps) {
  const { progress } = props;
  const tasks = [
    {
      href: "/predictions",
      title: "ניחושי משחקים",
      Icon: IconPredictions,
      saved: progress?.matchesSaved,
      total: progress?.matchesTotal,
      hint: "לכל המשחקים",
    },
    {
      href: "/groups",
      title: "דירוג קבוצות",
      Icon: IconLeaderboard,
      saved: progress?.rankingSaved,
      total: progress?.rankingTotal,
      hint: "בחירת מיקומים",
    },
    {
      href: "/bonuses",
      title: "בונוסים",
      Icon: IconBonuses,
      saved: progress?.bonusSaved,
      total: progress?.bonusTotal,
      hint: "הבחירות שלכם",
    },
  ];
  const missingPicks = progress ? props.missingCount : null;
  const tied =
    props.raceEntries.filter((p) => p.rank === props.rank).length > 1;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 lg:max-w-none">
      <section className="home-hero relative isolate overflow-hidden rounded-[28px] border border-white/10 p-5 sm:p-7 lg:p-8">
        <div className="pitch-lines -z-10 hidden lg:block" aria-hidden />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center lg:gap-10">
          <div className="min-w-0">
            <p className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--gold)]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-current"
                aria-hidden
              />
              {props.tournamentName}
            </p>
            <p className="mb-1 text-sm text-[var(--text-secondary)]">
              היי,{" "}
              <bdi className="font-semibold text-[var(--text-primary)]">
                {props.name}
              </bdi>
            </p>
            <h1 className="text-[26px] leading-tight font-black tracking-tight sm:text-[38px] lg:text-[42px]">
              {missingPicks === null
                ? "הכדור אצלכם."
                : missingPicks > 0
                  ? missingPicks === 1
                    ? "עוד ניחוש אחד. ואז משחקים."
                    : `עוד ${missingPicks} ניחושים. ואז משחקים.`
                  : progress &&
                      progress.matchesTotal > 0 &&
                      progress.matchesSaved === progress.matchesTotal
                    ? "הניחושים בפנים. אתם במשחק."
                    : "המרוץ ממשיך על הדשא."}
            </h1>
            <p className="mt-3 text-xs font-bold text-[var(--interactive)]">
              {props.roundLabel}
            </p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--text-secondary)]">
              {props.retrospective
                ? "משלימים את הבחירות המקוריות ששלחתם, ונכנסים למרוץ של החבר׳ה."
                : "עוד משחק, עוד הזדמנות לעלות בטבלה. מה הניחוש שלכם?"}
            </p>
            {props.deadline && (
              <div className="mt-3">
                <Deadline at={props.deadline} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link
                href={props.predictionHref}
                className="action-primary !px-3 sm:!px-5"
              >
                {missingPicks !== null && missingPicks > 0
                  ? "להשלמת ניחושים"
                  : "למשחקים ולניחושים"}
                <span aria-hidden>←</span>
              </Link>
              <Link
                href="/rules"
                className="flex min-h-11 items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-white"
              >
                חוקי הניקוד <span aria-hidden>←</span>
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#080b14]/30 px-4 py-3 lg:p-5">
            <div className="grid grid-cols-2 divide-x divide-white/10 text-center divide-x-reverse">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {rankLabel(props.rank, tied)}
                </p>
                <p className="mt-1 text-3xl font-black text-[var(--gold)] tabular-nums lg:text-5xl">
                  {props.rank || "—"}
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  מתוך {props.participantCount} חברים
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">
                  הנקודות שלכם
                </p>
                <p className="mt-1 text-3xl font-black tabular-nums lg:text-5xl">
                  {props.points}
                </p>
                <Link
                  href="/leaderboard"
                  className="mt-1 inline-block text-[11px] text-[var(--interactive)]"
                >
                  לטבלה המלאה ←
                </Link>
              </div>
            </div>
            {props.rankMoved !== 0 && (
              <div className="mt-3 flex justify-center">
                <div className="text-center">
                  <RankMovementChip rankMoved={props.rankMoved} />
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                    מאז עדכון הדירוג הקודם
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <LiveLink />
      <div className="grid gap-3 lg:grid-cols-2">
        <RaceCard entries={props.raceEntries} selfId={props.selfId} />
        <Link href="/summaries" className="recap-teaser group">
          <span className="eyebrow">שריקת הסיום · הסיפור של הערב</span>
          <span className="mt-3 block text-xl font-extrabold">
            {props.latestSummary
              ? "הטבלה זזה. הסיכום כאן."
              : "מי יהיה הכוכב של המחזור?"}
          </span>
          <span className="mt-2 block text-sm leading-6 text-[var(--text-secondary)]">
            {props.latestSummary
              ? `סיכום ${props.latestSummary.day.split("-").reverse().join(".")} · הניקוד, הפגיעות והמהפכים של החבר׳ה.`
              : "אחרי משחקי הערב: המצטיינים, הפגיעות המדויקות והקפיצות בטבלה. עם תמונה לשיתוף בקבוצה."}
          </span>
          <span className="mt-4 inline-flex min-h-11 items-center text-xs font-bold text-[var(--gold)]">
            {props.latestSummary
              ? "לסיכום ולשיתוף בקבוצה ←"
              : "לסיכומי המשחקים ←"}
          </span>
        </Link>
      </div>

      <section
        aria-labelledby="your-picks-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="your-picks-heading" className="text-base font-bold">
            הניחושים שלכם
          </h2>
          {props.onboardingOpen && <Pill tone="gold">תקופת הקליטה פתוחה</Pill>}
        </div>
        {props.onboardingOpen && (
          <p className="text-xs leading-6 text-[var(--text-secondary)]">
            מזינים את הבחירות המקוריות שכבר שלחתם בוואטסאפ. המשחקים של מחזור
            הפתיחה, הדירוג והבונוסים פתוחים עד שהמנהל יסיים את הקליטה.
          </p>
        )}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {tasks.map(({ href, title, Icon, saved, total, hint }) => {
            const done =
              total !== undefined &&
              total > 0 &&
              saved !== undefined &&
              saved >= total;
            return (
              <Link
                key={href}
                href={href}
                className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-[var(--surface-card)] p-3 transition-colors hover:border-[var(--interactive)]/50 hover:bg-[var(--surface-card-2)] sm:p-4"
              >
                <span className="flex items-center justify-between gap-1">
                  <Icon
                    width={20}
                    height={20}
                    aria-hidden
                    className={
                      done
                        ? "text-[var(--success)]"
                        : "text-[var(--interactive)]"
                    }
                  />
                  <span
                    aria-hidden
                    className="text-xs text-[var(--text-muted)]"
                  >
                    {done ? "✓" : "←"}
                  </span>
                </span>
                <span className="text-xs leading-5 font-bold sm:text-sm">
                  {title}
                </span>
                <span
                  className={`text-[11px] leading-5 sm:text-xs ${done ? "text-[var(--success)]" : "text-[var(--text-secondary)]"}`}
                >
                  {done
                    ? "הושלם ✓"
                    : saved !== undefined && total !== undefined && total > 0
                      ? `${saved} מתוך ${total} נשמרו`
                      : hint}
                </span>
                {total !== undefined && total > 0 && saved !== undefined && (
                  <span
                    aria-hidden
                    className="h-1 overflow-hidden rounded-full bg-white/5"
                  >
                    <span
                      className={`block h-full rounded-full ${done ? "bg-[var(--success)]" : "bg-[var(--interactive)]"}`}
                      style={{
                        width: `${Math.min(100, (saved / total) * 100)}%`,
                      }}
                    />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        {!progress && (
          <p role="status" className="text-xs text-[var(--text-secondary)]">
            לא ניתן לטעון כרגע את ההתקדמות. אפשר להיכנס לכל מסך ולבדוק את
            הבחירות השמורות.
          </p>
        )}
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-3">
            <SectionHeader
              title={
                props.nextMatch?.status === "live"
                  ? "על הדשא עכשיו"
                  : "המשחק הבא"
              }
              action={
                <Link
                  href="/predictions"
                  className="flex min-h-11 items-center text-xs font-semibold text-[var(--interactive)]"
                >
                  כל המשחקים ←
                </Link>
              }
            />
            {props.nextMatch ? (
              <MatchCard match={props.nextMatch} />
            ) : (
              <EmptyState message="אין כרגע משחקים נוספים בלוח. התוצאות והניחושים הקודמים מחכים במסך המשחקים." />
            )}
          </section>
          <section className="flex flex-col gap-3">
            <SectionHeader title="התוצאות האחרונות" />
            {props.recentResults.length > 0 ? (
              <Card>
                <ul className="divide-y divide-white/5">
                  {props.recentResults.map((match) => (
                    <li key={match.id}>
                      <Link
                        href={`/predictions/${match.id}`}
                        className="flex flex-col gap-2 rounded-xl py-3 transition-colors hover:bg-white/[0.025]"
                      >
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {formatMatchTime(match.kickoff)}
                        </span>
                        <span
                          dir="rtl"
                          className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-xs font-bold sm:text-sm"
                        >
                          <bdi className="min-w-0 [overflow-wrap:anywhere]">
                            {match.homeTeam?.shortName ?? "טרם נקבע"}
                          </bdi>
                          {match.regularResult && (
                            <ScorePair
                              home={match.regularResult.home}
                              away={match.regularResult.away}
                              homeLabel={match.homeTeam?.shortName}
                              awayLabel={match.awayTeam?.shortName}
                              className="rounded-lg bg-white/5 px-3 py-1.5 text-base"
                            />
                          )}
                          <bdi className="min-w-0 text-end [overflow-wrap:anywhere]">
                            {match.awayTeam?.shortName ?? "טרם נקבע"}
                          </bdi>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : props.latestFinished ? (
              <MatchCard match={props.latestFinished} />
            ) : (
              <EmptyState message="כאן יופיעו התוצאות אחרי שריקת הסיום." />
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-3">
            <SectionHeader
              title="המרוץ של החבר׳ה"
              action={
                <Link
                  href="/leaderboard"
                  className="flex min-h-11 items-center text-xs font-semibold text-[var(--interactive)]"
                >
                  לטבלה המלאה ←
                </Link>
              }
            />
            <Card>
              {props.leaders.length === 0 ? (
                <p className="py-4 text-sm text-[var(--text-secondary)]">
                  הטבלה מחכה למשתתפים הראשונים.
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {props.leaders.map((entry) => (
                    <li
                      key={entry.id}
                      className={`flex min-w-0 items-center gap-2 rounded-xl p-2.5 ${entry.self ? "bg-[var(--interactive)]/10" : ""}`}
                    >
                      <RankBadge rank={entry.rank} />
                      <Avatar
                        initials={entry.initials}
                        rank={entry.rank}
                        self={entry.self}
                        size={32}
                      />
                      <span className="min-w-0 flex-1 text-sm font-semibold [overflow-wrap:anywhere]">
                        <bdi>{entry.name}</bdi>
                        {entry.self && (
                          <span className="ms-1 text-[10px] font-normal text-[var(--interactive)]">
                            אתם
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-center">
                        <span className="block text-lg font-extrabold text-[var(--gold)] tabular-nums">
                          {entry.points}
                        </span>
                        <span className="block text-[10px] text-[var(--text-muted)]">
                          נקודות
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </section>

          <Card className="flex flex-col gap-4">
            <SectionHeader title="הכושר שלכם" />
            {props.accuracyPercent === null ? (
              <p className="text-xs leading-6 text-[var(--text-secondary)]">
                אחרי שהמשחקים יסתיימו, תוכלו לראות כאן את הדיוק ורצפי ההצלחות
                שלכם.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { value: `${props.accuracyPercent}%`, label: "דיוק בתוצאות" },
                  { value: props.exactStreak, label: "בול ברצף" },
                  { value: props.correctStreak, label: "הצלחות ברצף" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <span className="block text-xl font-extrabold text-[var(--interactive)] tabular-nums">
                      {stat.value}
                    </span>
                    <span className="mt-1 block text-[11px] text-[var(--text-muted)]">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {props.bonusLeaders.length > 0 && (
            <Card className="flex flex-col gap-3">
              <SectionHeader title="מובילים על הדשא" />
              <ul className="space-y-3">
                {props.bonusLeaders.map((leader) => (
                  <li key={leader.category} className="flex flex-col gap-1">
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {leader.category}
                    </span>
                    <bdi className="text-sm font-semibold">{leader.name}</bdi>
                  </li>
                ))}
              </ul>
              <p className="border-t border-white/5 pt-3 text-[11px] leading-5 text-[var(--text-muted)]">
                נתוני המשחקים מתעדכנים בסנכרון ועשויים להתעכב.
              </p>
            </Card>
          )}
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-5 text-xs text-[var(--text-muted)]">
        <span dir="ltr" className="font-bold tracking-tight">
          Score<span className="text-[var(--interactive)]">Rush</span> · המשחק
          של החבר׳ה
        </span>
        <Link
          href="/rules"
          className="flex min-h-11 items-center hover:text-white"
        >
          החוקים שלנו ←
        </Link>
      </footer>
    </div>
  );
}
