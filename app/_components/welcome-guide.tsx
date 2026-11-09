"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "./ui";
import { QuickPrediction } from "./quick-prediction";
import { welcomeKey } from "./welcome-nudge";
import { NicknameForm } from "@/app/(app)/profile/nickname-form";
import { PushSettings } from "@/app/(app)/profile/push-settings";
import type { MatchWithTeams } from "@/lib/matches/list";
export type WelcomeRules = {
  exact: number;
  difference: number;
  winner: number;
  wrong: number;
  lockMinutes: number;
};
const steps = [
  "הכינוי שלכם",
  "איך צוברים נקודות",
  "ניחוש ראשון",
  "נשארים בעניינים",
];
export function WelcomeGuide({
  scope,
  name,
  tournamentName,
  rules,
  firstMatch,
  hasPrediction,
}: {
  scope: string;
  name: string;
  tournamentName: string;
  rules: WelcomeRules;
  firstMatch: MatchWithTeams | null;
  hasPrediction: boolean;
}) {
  const [step, setStep] = useState(0);
  const [ack, setAck] = useState({
    name: false,
    rules: false,
    notifications: false,
  });
  const [ready, setReady] = useState(false);
  const [predicted, setPredicted] = useState(hasPrediction);
  const [match, setMatch] = useState(firstMatch);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // Browser-only preferences are reconciled after hydration.
  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(welcomeKey(scope)) ?? "null",
      );
      if (stored)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAck({
          name: stored.name === true,
          rules: stored.rules === true,
          notifications: stored.notifications === true,
        });
    } catch {}
    setReady(true);
  }, [scope]);
  function mark(part: keyof typeof ack) {
    const next = { ...ack, [part]: true };
    setAck(next);
    try {
      localStorage.setItem(welcomeKey(scope), JSON.stringify(next));
    } catch {}
  }
  function finish() {
    try {
      localStorage.setItem(`${welcomeKey(scope)}:hidden`, "yes");
    } catch {}
  }
  const done = [
    ack.name,
    ack.rules,
    predicted,
    pushEnabled || ack.notifications,
  ];
  const count = done.filter(Boolean).length;
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5">
      <header>
        <span className="text-xs font-bold text-[var(--gold)]">
          {tournamentName}
        </span>
        <h1 className="page-heading mt-2">ברוכים הבאים למרוץ 🏆</h1>
        <p className="page-intro mt-2">
          בואו נכיר את המגרש. ארבעה צעדים, ואתם בפנים.
        </p>
      </header>
      <div>
        <div className="mb-3 flex justify-between text-xs text-[var(--text-secondary)]">
          <span>מתחילים יחד</span>
          <span>{count} מתוך 4 הושלמו</span>
        </div>
        <div
          role="progressbar"
          aria-label="התקדמות ההיכרות"
          aria-valuenow={count}
          aria-valuemin={0}
          aria-valuemax={4}
          className="h-2 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-[var(--interactive)] transition-all"
            style={{ width: `${count * 25}%` }}
          />
        </div>
      </div>
      <nav aria-label="שלבי ההיכרות" className="grid grid-cols-4 gap-2">
        {steps.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-current={step === i ? "step" : undefined}
            onClick={() => setStep(i)}
            className={`flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border px-1 py-3 text-center text-[11px] font-bold ${step === i ? "border-[var(--interactive)] bg-[var(--interactive)]/10 text-[var(--interactive)]" : "border-white/10 text-[var(--text-secondary)]"}`}
          >
            <span className="text-base">{done[i] ? "✓" : i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <Card className="space-y-5" key={step}>
        <div>
          <p className="text-xs font-semibold text-[var(--gold)]">
            צעד {step + 1}
          </p>
          <h2 className="mt-2 text-xl font-extrabold">{steps[step]}</h2>
        </div>
        {step === 0 && (
          <>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              כאן יכירו אתכם בתור{" "}
              <bdi className="font-bold text-[var(--text-primary)]">{name}</bdi>
              . זה השם שיופיע בטבלה, בניחושים ובסיכומים. אפשר לערוך אותו גם
              בהמשך, דרך הפרופיל.
            </p>
            <NicknameForm name={name} />
            <button
              disabled={!ready}
              className="action-primary w-full"
              onClick={() => {
                mark("name");
                setStep(1);
              }}
            >
              ממשיכים עם הכינוי שלי ←
            </button>
          </>
        )}
        {step === 1 && (
          <>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              מנחשים תוצאה, צוברים נקודות ומנסים לעקוף את החבר׳ה. בכל משחק
              מקבלים את הניקוד הגבוה שמתאים לניחוש — הסעיפים לא מצטברים.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["תוצאה מדויקת", rules.exact],
                ["מנצחת והפרש / תיקו נכון", rules.difference],
                ["המנצחת בלבד", rules.winner],
                ["ניחוש שגוי", rules.wrong],
              ].map(([label, points]) => (
                <div key={label} className="rounded-2xl bg-white/5 p-4">
                  <b className="block text-2xl font-black text-[var(--gold)]">
                    {points}
                    <span className="ms-1 text-xs font-medium">נק׳</span>
                  </b>
                  <span className="mt-2 block text-xs leading-5">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs leading-6 text-[var(--text-secondary)]">
              הניקוד לפי 90 דקות ותוספת זמן, ללא הארכה ופנדלים. הניחושים ננעלים{" "}
              {rules.lockMinutes === 1 ? "דקה" : `${rules.lockMinutes} דקות`}{" "}
              לפני המשחק. בתקופת קליטה, הזינו רק בחירות שכבר שלחתם לפני המשחק.
              טיוטה במכשיר לא נחשבת לניחוש שנשלח.
            </p>
            <Link
              href="/rules"
              className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--interactive)]"
            >
              גם דירוג קבוצות ובונוסים שווים נקודות · לכל החוקים ←
            </Link>
            <button
              className="action-primary w-full"
              onClick={() => {
                mark("rules");
                setStep(2);
              }}
            >
              הבנתי, עוברים לניחוש ←
            </button>
          </>
        )}
        {step === 2 && (
          <>
            {predicted ? (
              <div className="rounded-2xl border border-[var(--success)]/30 bg-[var(--success)]/5 p-5">
                <b className="text-[var(--success)]">
                  ✓ הניחוש הראשון שלכם כבר באתר
                </b>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  השלב הראשון הושלם. במסך המשחקים אפשר להשלים את שאר המחזור
                  ולבדוק מה עדיין חסר.
                </p>
              </div>
            ) : match ? (
              <>
                <p className="text-sm leading-7 text-[var(--text-secondary)]">
                  הזינו מספר שערים לכל קבוצה ולחצו על שמירה. הבחירה נחשבת רק
                  כשמופיע אישור שהיא נשמרה.
                </p>
                <QuickPrediction
                  match={match}
                  draftScope={scope}
                  now={now}
                  onDirty={() => {}}
                  onSaved={(_, prediction) => {
                    setMatch({ ...match, ownPrediction: prediction });
                    setPredicted(true);
                  }}
                />
              </>
            ) : (
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                כרגע אין משחק פתוח לניחוש. אפשר להפעיל תזכורות ולהשלים את הצעד
                הזה כשהמשחקים הבאים ייפתחו.
              </p>
            )}
            <button
              className="action-primary w-full"
              onClick={() => setStep(3)}
            >
              {predicted
                ? "מעולה, להתראות ←"
                : "להתראות — אשלים את הניחוש בהמשך ←"}
            </button>
          </>
        )}
        {step === 3 && (
          <>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              כדי שלא תפספסו: תזכורות רק כשחסר ניחוש, וסיכום של ערב המשחקים
              והטבלה. ההפעלה במכשיר הזה לבחירתכם.
            </p>
            <PushSettings onEnabledChange={setPushEnabled} />
            {pushEnabled ? (
              <p className="text-sm font-bold text-[var(--success)]">
                ✓ המכשיר הזה מוכן לקבל התראות
              </p>
            ) : (
              <button
                className="min-h-11 w-full rounded-xl border border-white/15 px-3 text-sm"
                onClick={() => mark("notifications")}
              >
                {ack.notifications
                  ? "✓ בחרתם להמשיך בלי התראות כרגע"
                  : "אמשיך בלי התראות כרגע"}
              </button>
            )}
            <Link
              href="/"
              onClick={finish}
              className="action-primary flex w-full"
            >
              {count === 4
                ? "מוכנים, נכנסים לתחרות ←"
                : "כניסה לתחרות — אפשר להשלים אחר כך ←"}
            </Link>
          </>
        )}
      </Card>
      <Link
        href="/"
        className="min-h-11 content-center text-center text-xs text-[var(--text-secondary)]"
      >
        אפשר להמשיך לאתר ולחזור להיכרות דרך הפרופיל
      </Link>
    </div>
  );
}
