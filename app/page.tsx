import { colors, typography } from "@/lib/design-tokens";
import { RiseDemo } from "./_components/rise-demo";

const colorEntries = Object.entries(colors);

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
          ScoreRush
        </h1>
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          שלב 1 — יסודות הכלים ומערכת העיצוב. זהו שלד לבדיקה בלבד; המסכים
          האמיתיים נבנים בשלב 2.
        </p>
      </header>

      <section aria-labelledby="colors-heading" className="flex flex-col gap-3">
        <h2
          id="colors-heading"
          className="text-xs font-extrabold tracking-wide text-[var(--text-secondary)]"
        >
          פלטת צבעים
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {colorEntries.map(([name, value]) => (
            <div
              key={name}
              className="rounded-tile flex flex-col gap-1 border border-[var(--border)] p-2"
              style={{ borderRadius: "var(--radius-tile)" }}
            >
              <div
                className="rounded-row h-10 w-full"
                style={{
                  background: value,
                  borderRadius: "var(--radius-row)",
                  border: "1px solid var(--border)",
                }}
              />
              <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
                {name}
              </span>
              <span className="ltr text-[10px] text-[var(--text-muted)] tabular-nums">
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="type-heading" className="flex flex-col gap-3">
        <h2
          id="type-heading"
          className="text-xs font-extrabold tracking-wide text-[var(--text-secondary)]"
        >
          סולם טיפוגרפיה
        </h2>
        <p
          className="text-[var(--gold)]"
          style={{
            fontSize: typography.scale.heroTotalPoints.mobile,
            fontWeight: typography.scale.heroTotalPoints.weight,
            lineHeight: typography.scale.heroTotalPoints.lineHeight,
          }}
        >
          <span className="ltr tabular-nums">247</span>
        </p>
        <p
          className="text-[var(--text-primary)]"
          style={{
            fontSize: typography.scale.teamName.mobile,
            fontWeight: typography.scale.teamName.weight,
            lineHeight: typography.scale.teamName.lineHeight,
          }}
        >
          אורן ניחש תוצאה מדויקת
        </p>
      </section>

      <section aria-labelledby="rtl-heading" className="flex flex-col gap-3">
        <h2
          id="rtl-heading"
          className="text-xs font-extrabold tracking-wide text-[var(--text-secondary)]"
        >
          בידוד <span className="ltr">RTL/LTR</span>
        </h2>
        <p className="text-sm text-[var(--text-primary)]">
          התוצאה הסופית:{" "}
          <span className="ltr font-black tabular-nums">2 – 1</span> · ננעל בעוד{" "}
          <span className="ltr tabular-nums">01:24:36</span>
        </p>
      </section>

      <section aria-labelledby="motion-heading" className="flex flex-col gap-3">
        <h2
          id="motion-heading"
          className="text-xs font-extrabold tracking-wide text-[var(--text-secondary)]"
        >
          מערכת תנועה
        </h2>
        <RiseDemo />
      </section>
    </main>
  );
}
