"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Card } from "@/app/_components/ui";
import { saveSettings, deleteTournament } from "./actions";
import {
  israelDateInput,
  israelInputToIso,
  settingsSchema,
  type SettingsView,
  type TournamentSettings,
} from "@/lib/tournaments/settings-input";
const field =
  "w-full min-w-0 rounded-xl border border-white/15 bg-[var(--surface-card)] px-3 py-3 text-base text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-70";
const button =
  "rounded-xl bg-[var(--interactive)] px-5 py-3 text-sm font-bold text-[#080B14] disabled:opacity-50";
const pointLabels = {
  exactScorePoints: "תוצאה מדויקת",
  winnerAndDiffPoints: "מנצחת והפרש נכון / תיקו לא מדויק",
  winnerOnlyPoints: "מנצחת בלבד",
  wrongPoints: "ניחוש שגוי",
  groupRankingPointsPerPosition: "כל קבוצה בדירוג הנכון",
} as const;
const statLabels = {
  champion: "אלופה",
  runner_up: "סגנית",
  top_scoring_team: "הקבוצה המבקיעה",
  league_winner: "ראשונה בשלב הליגה",
  top_scorer: "מלך השערים",
  top_assists: "מלך הבישולים",
  manual: "הכרעה ידנית",
} as const;
type Category = TournamentSettings["categories"][number];
function DateField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  const initial = israelDateInput(value);
  const [date, setDate] = useState(initial.slice(0, 10));
  const [time, setTime] = useState(initial.slice(11, 16) || "00:00");
  function change(nextDate: string, nextTime: string) {
    try {
      onChange(nextDate ? israelInputToIso(`${nextDate}T${nextTime}`) : null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "תאריך לא תקין");
    }
  }
  return (
    <fieldset className="min-w-0 space-y-2 text-sm">
      <legend>{label}</legend>
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
        <input
          aria-label={`${label} — תאריך`}
          type="date"
          disabled={disabled}
          className={`${field} h-12`}
          dir="ltr"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            change(e.target.value, time);
          }}
        />
        <input
          aria-label={`${label} — שעה`}
          type="time"
          step="60"
          required={!!date}
          disabled={disabled || !date}
          className={`${field} h-12`}
          dir="ltr"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            change(date, e.target.value);
          }}
        />
      </div>
      {!date && (
        <p className="text-xs text-[var(--text-secondary)]">
          לבחירת שעה, יש לבחור קודם תאריך.
        </p>
      )}
      {date && (
        <button
          type="button"
          disabled={disabled}
          className="min-h-11 text-xs text-[var(--interactive)]"
          onClick={() => {
            setDate("");
            change("", time);
          }}
        >
          ניקוי מועד הנעילה
        </button>
      )}
      {error && (
        <span role="alert" className="text-red-300">
          {error}
        </span>
      )}
    </fieldset>
  );
}
function diff(before: TournamentSettings, after: TournamentSettings): string[] {
  const changes: string[] = [];
  if (before.name !== after.name)
    changes.push(`שם: ${before.name} ← ${after.name}`);
  for (const key of Object.keys(pointLabels) as (keyof typeof pointLabels)[])
    if (before[key] !== after[key])
      changes.push(
        `${pointLabels[key]}: מ־${before[key]} ל־${after[key]} נקודות`,
      );
  if (before.matchLockMinutes !== after.matchLockMinutes)
    changes.push(
      `נעילת משחקים: מ־${before.matchLockMinutes} ל־${after.matchLockMinutes} דקות לפני הפתיחה (משחקים שטרם ננעלו בלבד)`,
    );
  if (
    JSON.stringify(before.rankingConfig) !== JSON.stringify(after.rankingConfig)
  )
    changes.push(
      `שיטת דירוג: ${after.rankingConfig.mode === "exact" ? "מיקום מדויק" : "טווחים בגודל " + after.rankingConfig.sizes.join(", ")}`,
    );
  if (before.rankingLocksAt !== after.rankingLocksAt)
    changes.push(
      `מועד נעילת הדירוג: ${israelDateInput(after.rankingLocksAt).replace("T", " ") || "תחילת שלב הבתים / הליגה"} (שעון ישראל)`,
    );
  if (before.onboardingOpen !== after.onboardingOpen)
    changes.push(
      "פתיחת קליטה רטרואקטיבית — כולל משחקים שכבר התקיימו, בונוסים ודירוגים",
    );
  if (before.onboardingMatchday !== after.onboardingMatchday)
    changes.push(`קליטה רטרואקטיבית עד מחזור ${after.onboardingMatchday}`);
  for (const cat of after.categories) {
    const old = before.categories.find((c) => c.id && c.id === cat.id);
    if (!old) {
      changes.push(`הוספת בונוס: ${cat.name}, ${cat.slots.length} אפשרויות`);
      continue;
    }
    if (JSON.stringify(old) !== JSON.stringify(cat))
      changes.push(
        `עדכון ״${old.name}״: ${cat.name}; נקודות ${old.slots.map((s) => s.points).join(" / ")} ← ${cat.slots.map((s) => s.points).join(" / ")}; נעילה ${israelDateInput(cat.locksAt).replace("T", " ") || "ללא מועד"}; ${cat.resolvesAt === "ongoing" ? "ניקוד במהלך הטורניר" : "ניקוד בסיום הטורניר"}; ${cat.duplicateStackingAllowed ? "בחירה חוזרת מותרת" : "ללא בחירה חוזרת"}; ${statLabels[cat.statKey]}`,
      );
  }
  for (const cat of before.categories)
    if (!after.categories.some((c) => c.id === cat.id))
      changes.push(`מחיקת בונוס: ${cat.name}`);
  if (JSON.stringify(before.prizes) !== JSON.stringify(after.prizes))
    changes.push(`פרסים: ${after.prizes.join("; ") || "ללא פרסים"}`);
  return changes;
}
export function SettingsForm({ view }: { view: SettingsView }) {
  const [draft, setDraft] = useState(view.settings);
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState(false);
  const [validation, setValidation] = useState("");
  const [result, action, pending] = useActionState(saveSettings, {});
  const changes = diff(view.settings, draft);
  function update(value: Partial<TournamentSettings>) {
    setDraft((d) => ({ ...d, ...value }));
    setReview(false);
    setValidation("");
  }
  function category(index: number, value: Partial<Category>) {
    update({
      categories: draft.categories.map((c, i) =>
        i === index ? { ...c, ...value } : c,
      ),
    });
  }
  const url = `/admin/settings?tournament=${draft.tournamentId}`;
  if (result.saved)
    return (
      <Card className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--interactive)]">
          ההגדרות נשמרו והניקוד עודכן
        </h2>
        <p className="text-sm">הניחושים נשמרו. השינוי מתועד ביומן הניהול.</p>
        <a href={url} className={button}>
          חזרה להגדרות
        </a>
      </Card>
    );
  return (
    <>
      <form action={action} className="flex min-w-0 flex-col gap-4">
        <input type="hidden" name="settings" value={JSON.stringify(draft)} />
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="min-w-0 text-lg font-extrabold break-words">
              {view.settings.name}
            </h2>
            {!editing ? (
              <button
                type="button"
                className={button}
                onClick={() => setEditing(true)}
              >
                עריכת הגדרות
              </button>
            ) : (
              <a href={url} className="px-3 py-2 text-sm underline">
                ביטול העריכה
              </a>
            )}
          </div>
          <p className="text-xs leading-6 text-[var(--text-secondary)]">
            {view.counts.participants} משתתפים · {view.counts.matches} משחקים ·{" "}
            {view.counts.predictions} ניחושים שמורים
          </p>
          {!editing && (
            <p className="text-sm">
              המסך במצב צפייה. לחץ על עריכת הגדרות כדי לשנות.
            </p>
          )}
        </Card>
        <fieldset
          disabled={!editing || pending}
          className="flex min-w-0 flex-col gap-4"
        >
          <Card className="space-y-4">
            <h2 className="font-bold">פרטי הטורניר</h2>
            <label className="flex flex-col gap-2 text-sm">
              שם הטורניר
              <input
                className={field}
                maxLength={120}
                required
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-bold">ניקוד ונעילת משחקים</h2>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              {(Object.keys(pointLabels) as (keyof typeof pointLabels)[])
                .filter((k) => k !== "groupRankingPointsPerPosition")
                .map((key) => (
                  <label key={key} className="flex flex-col gap-2 text-sm">
                    {pointLabels[key]}
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={999}
                      required
                      className={field}
                      value={draft[key]}
                      onChange={(e) =>
                        update({ [key]: e.target.valueAsNumber })
                      }
                    />
                  </label>
                ))}
            </div>
            <label className="flex flex-col gap-2 text-sm">
              כמה דקות לפני המשחק נועלים ניחושים?
              <input
                className={field}
                type="number"
                inputMode="numeric"
                min={0}
                max={1440}
                required
                value={draft.matchLockMinutes}
                onChange={(e) =>
                  update({ matchLockMinutes: e.target.valueAsNumber })
                }
              />
            </label>
            <p className="text-xs leading-6 text-[var(--text-secondary)]">
              הניקוד מחושב לפי 90 דקות ותוספת זמן, ללא הארכה ופנדלים. ניחוש חסר
              הוא 0–0. שינוי מרווח הנעילה חל רק על משחקים שטרם ננעלו.
            </p>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-bold">דירוג הקבוצות</h2>
            <label className="flex flex-col gap-2 text-sm">
              שיטת הדירוג
              <select
                aria-describedby={
                  view.counts.rankings > 0
                    ? "ranking-structure-lock"
                    : undefined
                }
                className={field}
                disabled={view.counts.rankings > 0}
                value={draft.rankingConfig.mode}
                onChange={(e) =>
                  update({
                    rankingConfig:
                      e.target.value === "bands"
                        ? { mode: "bands", sizes: [8, 16, 12] }
                        : { mode: "exact" },
                  })
                }
              >
                <option value="exact">מיקום מדויק בכל בית</option>
                <option value="bands">
                  טווחים — ללא חשיבות לסדר בתוך הטווח
                </option>
              </select>
            </label>
            {draft.rankingConfig.mode === "bands" && (
              <label className="flex flex-col gap-2 text-sm">
                מספר הקבוצות בכל טווח, מופרד בפסיקים
                <input
                  className={field}
                  dir="ltr"
                  disabled={view.counts.rankings > 0}
                  defaultValue={draft.rankingConfig.sizes.join(", ")}
                  onChange={(e) =>
                    update({
                      rankingConfig: {
                        mode: "bands",
                        sizes: e.target.value.split(",").map(Number),
                      },
                    })
                  }
                />
                <span className="text-xs">
                  לליגת האלופות: 8, 16, 12 — מקומות 1–8, 9–24, 25–36.
                </span>
              </label>
            )}
            {view.counts.rankings > 0 && (
              <p
                id="ranking-structure-lock"
                className="rounded-xl bg-[var(--gold)]/10 p-3 text-xs leading-6 text-[var(--gold)]"
              >
                🔒 שיטת הדירוג וגודל הטווחים נעולים כי כבר נשמרו בחירות. שינוי
                המבנה יבטל את משמעותן. הניקוד ומועד הנעילה עדיין ניתנים לעריכה.
              </p>
            )}
            <label className="flex flex-col gap-2 text-sm">
              נקודות לכל קבוצה בדירוג הנכון
              <input
                className={field}
                type="number"
                min={0}
                max={999}
                required
                value={draft.groupRankingPointsPerPosition}
                onChange={(e) =>
                  update({
                    groupRankingPointsPerPosition: e.target.valueAsNumber,
                  })
                }
              />
            </label>
            <DateField
              label="נעילת דירוגים — שעון ישראל"
              value={draft.rankingLocksAt}
              onChange={(rankingLocksAt) => update({ rankingLocksAt })}
            />
            <p className="text-xs text-[var(--text-secondary)]">
              מועד ריק משתמש בתחילת שלב הבתים / הליגה. בזמן קליטה פתוחה ניתן
              להזין גם לאחר המועד.
            </p>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-bold">בונוסים</h2>
            <p className="text-xs leading-6 text-[var(--text-secondary)]">
              בבונוס שכבר מולא, אפשר לערוך ניקוד ומועדים. האפשרויות וסוג הבחירה
              נשמרים כדי להגן על הניחושים הקיימים.
            </p>
            {draft.categories.map((cat, index) => {
              const used = !!(cat.id && view.counts.bonusPicks[cat.id]);
              return (
                <details
                  key={cat.id ?? `new-${index}`}
                  className="rounded-xl border border-white/15 p-4"
                  open={editing || undefined}
                >
                  <summary className="cursor-pointer text-sm font-bold">
                    {cat.name} · {cat.slots.map((s) => s.points).join(" / ")}{" "}
                    נק׳
                  </summary>
                  <div className="mt-4 space-y-4">
                    {used && (
                      <p className="rounded-xl bg-[var(--gold)]/10 p-3 text-xs leading-6 text-[var(--gold)]">
                        🔒 כבר הוזנו בחירות בבונוס הזה. סוג הבחירה, שיטת ההכרעה
                        ומבנה האפשרויות נעולים; אפשר לערוך שם, ניקוד ומועד
                        נעילה.
                      </p>
                    )}
                    <label className="flex flex-col gap-2 text-sm">
                      שם הבונוס
                      <input
                        className={field}
                        required
                        maxLength={100}
                        value={cat.name}
                        onChange={(e) =>
                          category(index, { name: e.target.value })
                        }
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm">
                        מה בוחרים?
                        <select
                          disabled={used}
                          className={field}
                          value={cat.type}
                          onChange={(e) =>
                            category(index, {
                              type: e.target.value as Category["type"],
                              statKey: "manual",
                            })
                          }
                        >
                          <option value="team">קבוצה</option>
                          <option value="player">שחקן</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-2 text-sm">
                        איך הבונוס מוכרע?
                        <select
                          disabled={used}
                          className={field}
                          value={cat.statKey}
                          onChange={(e) =>
                            category(index, {
                              statKey: e.target.value as Category["statKey"],
                            })
                          }
                        >
                          {Object.entries(statLabels)
                            .filter(
                              ([key]) =>
                                key === "manual" ||
                                (cat.type === "player"
                                  ? ["top_scorer", "top_assists"].includes(key)
                                  : !["top_scorer", "top_assists"].includes(
                                      key,
                                    )),
                            )
                            .map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    {["manual", "top_assists"].includes(cat.statKey) && (
                      <p className="text-xs leading-6 text-amber-200">
                        {cat.statKey === "manual"
                          ? "דורש הזנת תוצאת בונוס ידנית; מסך ההכרעה הידנית עדיין לא זמין."
                          : "נתוני הבישולים בספק החינמי אינם מלאים. הבונוס דורש אימות והכרעה ידנית לפני הענקת נקודות."}
                      </p>
                    )}
                    <label className="flex flex-col gap-2 text-sm">
                      מתי מעניקים ניקוד?
                      <select
                        className={field}
                        value={cat.resolvesAt}
                        onChange={(e) =>
                          category(index, {
                            resolvesAt: e.target
                              .value as Category["resolvesAt"],
                          })
                        }
                      >
                        <option value="ongoing">
                          במהלך הטורניר, כשיש נתונים
                        </option>
                        <option value="tournament_end">רק בסיום הטורניר</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        disabled={used}
                        checked={cat.duplicateStackingAllowed}
                        onChange={(e) =>
                          category(index, {
                            duplicateStackingAllowed: e.target.checked,
                          })
                        }
                      />
                      מותר לבחור אותו שם בכמה אפשרויות ולצבור ניקוד
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {cat.slots.map((slot, j) => (
                        <label
                          key={slot.id ?? j}
                          className="flex flex-col gap-2 text-sm"
                        >
                          אפשרות {j + 1} — נקודות
                          <input
                            className={field}
                            type="number"
                            min={0}
                            max={999}
                            required
                            value={slot.points}
                            onChange={(e) =>
                              category(index, {
                                slots: cat.slots.map((s, k) =>
                                  k === j
                                    ? { ...s, points: e.target.valueAsNumber }
                                    : s,
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    {!used && editing && (
                      <div className="flex flex-wrap gap-4 text-sm">
                        <button
                          type="button"
                          className="py-2 underline"
                          disabled={cat.slots.length >= 20}
                          onClick={() =>
                            category(index, {
                              slots: [...cat.slots, { points: 10 }],
                            })
                          }
                        >
                          הוספת אפשרות
                        </button>
                        <button
                          type="button"
                          className="py-2 underline"
                          disabled={cat.slots.length <= 1}
                          onClick={() =>
                            category(index, { slots: cat.slots.slice(0, -1) })
                          }
                        >
                          הסרת האפשרות האחרונה
                        </button>
                      </div>
                    )}
                    <DateField
                      label="נעילת הבונוס — שעון ישראל"
                      value={cat.locksAt}
                      onChange={(locksAt) => category(index, { locksAt })}
                    />
                    <p className="text-xs text-[var(--text-secondary)]">
                      מועד ריק משאיר את הבונוס פתוח. תקופת קליטה פתוחה גוברת על
                      המועד.
                    </p>
                    {!used && editing && (
                      <button
                        type="button"
                        className="py-2 text-sm text-red-300"
                        onClick={() =>
                          update({
                            categories: draft.categories.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        הסרת הבונוס
                      </button>
                    )}
                  </div>
                </details>
              );
            })}
            {editing && (
              <button
                type="button"
                className="py-2 text-sm text-[var(--interactive)]"
                disabled={draft.categories.length >= 20}
                onClick={() =>
                  update({
                    categories: [
                      ...draft.categories,
                      {
                        name: "בונוס חדש",
                        type: "team",
                        statKey: "manual",
                        resolvesAt: "tournament_end",
                        duplicateStackingAllowed: true,
                        locksAt: draft.rankingLocksAt,
                        slots: [{ points: 20 }],
                      },
                    ],
                  })
                }
              >
                + הוספת בונוס
              </button>
            )}
          </Card>
          <Card className="space-y-4">
            <h2 className="font-bold">קליטת הניחושים המקוריים</h2>
            <label className="flex items-start gap-3 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                disabled={view.onboardingClosed || view.settings.onboardingOpen}
                checked={draft.onboardingOpen}
                onChange={(e) => update({ onboardingOpen: e.target.checked })}
              />
              אפשר הזנה רטרואקטיבית של ניחושים שנמסרו מראש
            </label>
            {view.onboardingClosed ? (
              <p className="text-xs">
                הקליטה הסתיימה. לא ניתן לפתוח אותה מחדש.
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-2 text-sm">
                  עד איזה מחזור בשלב הבתים / הליגה?
                  <input
                    className={field}
                    disabled={!draft.onboardingOpen}
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={draft.onboardingMatchday}
                    onChange={(e) =>
                      update({ onboardingMatchday: e.target.valueAsNumber })
                    }
                  />
                </label>
                <p className="text-xs leading-6 text-[var(--text-secondary)]">
                  בזמן הקליטה פתוחים גם הבונוסים והדירוגים. סגירת הקליטה נעשית
                  בנפרד, בטבלת המשתתפים בהמשך המסך, ומשלימה ניחושים חסרים ב־0–0.
                </p>
              </>
            )}
          </Card>
          <Card className="space-y-4">
            <h2 className="font-bold">פרסים</h2>
            {draft.prizes.map((prize, i) => (
              <label key={i} className="flex flex-col gap-2 text-sm">
                מקום {i + 1}
                <input
                  className={field}
                  required
                  maxLength={200}
                  value={prize}
                  onChange={(e) =>
                    update({
                      prizes: draft.prizes.map((p, j) =>
                        i === j ? e.target.value : p,
                      ),
                    })
                  }
                />
              </label>
            ))}
            {editing && (
              <div className="flex gap-5 text-sm">
                <button
                  type="button"
                  disabled={draft.prizes.length >= 50}
                  onClick={() => update({ prizes: [...draft.prizes, ""] })}
                >
                  + הוספת פרס
                </button>
                {draft.prizes.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      update({ prizes: draft.prizes.slice(0, -1) })
                    }
                  >
                    הסרת הפרס האחרון
                  </button>
                )}
              </div>
            )}
            {draft.prizes.length === 0 && !editing && (
              <p className="text-sm text-[var(--text-secondary)]">
                לא הוגדרו פרסים
              </p>
            )}
          </Card>
        </fieldset>
        {editing && (
          <Card className="space-y-4 border border-[var(--interactive)]/40">
            <h2 className="font-bold">בדיקה ושמירה</h2>
            {!review ? (
              <button
                type="button"
                className={button}
                disabled={pending || changes.length === 0}
                onClick={(e) => {
                  if (!e.currentTarget.form?.reportValidity()) return;
                  const parsed = settingsSchema.safeParse(draft);
                  if (!parsed.success) {
                    setValidation(
                      "בדוק שמילאת את כל השדות ושהמספרים בטווח המותר.",
                    );
                    return;
                  }
                  setReview(true);
                }}
              >
                בדיקת השינויים לפני שמירה
              </button>
            ) : (
              <>
                <ul className="list-disc space-y-2 ps-5 text-sm leading-6">
                  {changes.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ul>
                <p className="text-sm leading-6">
                  שינוי ניקוד יחול גם על משחקים שכבר הסתיימו ועל בונוסים
                  שהוכרעו, ויכול לשנות את הטבלה של כל {view.counts.participants}{" "}
                  המשתתפים. שינוי מועד נעילה עשוי לפתוח מחדש ניחושים שכבר נחשפו.
                </p>
                <label className="flex flex-col gap-2 text-sm">
                  סיבת השינוי (נשמרת ביומן)
                  <textarea
                    name="reason"
                    required
                    minLength={3}
                    maxLength={500}
                    className={field}
                    placeholder="למשל: תיקון הניקוד לפי הכללים שסיכמנו"
                  />
                </label>
                <label className="flex items-start gap-3 text-sm leading-6">
                  <input
                    type="checkbox"
                    className="mt-1"
                    required
                    name="confirm"
                  />
                  בדקתי את השינויים ואני מאשר לשמור ולחשב מחדש את הניקוד.
                </label>
                <button className={button} disabled={pending} type="submit">
                  {pending ? "שומר ומחשב ניקוד…" : "שמירת השינויים"}
                </button>
              </>
            )}
            {(validation || result.error) && (
              <p role="alert" className="text-sm text-red-300">
                {validation || result.error}
              </p>
            )}
          </Card>
        )}
      </form>
      <Card className="space-y-3">
        <h2 className="font-bold">הרשמה והזמנות</h2>
        <p className="text-sm leading-6">
          הצטרפות לטורניר מתבצעת באמצעות הזמנה. ניהול הקישורים וההזמנות נמצא
          במסך המשתתפים של הטורניר הנבחר באתר.
        </p>
        <Link
          href={`/admin/participants?tournament=${draft.tournamentId}`}
          className="inline-block py-2 text-sm text-[var(--interactive)]"
        >
          ניהול המשתתפים וההזמנות ←
        </Link>
      </Card>
      {view.canDelete && <DeleteForm view={view} />}
    </>
  );
}
function DeleteForm({ view }: { view: SettingsView }) {
  const [state, action, pending] = useActionState(deleteTournament, {});
  return (
    <details className="rounded-2xl border border-red-400/30 p-5">
      <summary className="cursor-pointer text-sm font-bold text-red-300">
        מחיקת הטורניר
      </summary>
      <form action={action} className="mt-4 space-y-4">
        <input
          type="hidden"
          name="tournamentId"
          value={view.settings.tournamentId}
        />
        <p className="text-sm leading-7">
          מחיקת ״{view.settings.name}״ תסיר לצמיתות את {view.counts.matches}{" "}
          המשחקים, {view.counts.predictions} הניחושים, הניקוד וההזמנות של
          הטורניר, ואת החברות של {view.counts.participants} המשתתפים בו. חשבונות
          המשתמשים והטורנירים האחרים יישארו.
        </p>
        <label className="flex flex-col gap-2 text-sm">
          לאישור, הקלד בדיוק: {view.settings.name}
          <input className={field} name="name" required autoComplete="off" />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="confirmDelete" required />
          אני מאשר מחיקה לצמיתות של הטורניר הזה.
        </label>
        <button
          className="rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          disabled={pending}
        >
          {pending ? "מוחק…" : "מחיקת הטורניר לצמיתות"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-red-300">
            {state.error}
          </p>
        )}
      </form>
    </details>
  );
}
