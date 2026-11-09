// Isolated fixtures: real components with synthetic state and mocked API writes.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { SaveFeedbackProvider } from "../app/_components/save-feedback";
import { PredictionForm } from "../app/(app)/predictions/[matchId]/_components/prediction-form";
import { BonusPredictionForm } from "../app/(app)/bonuses/_components/bonus-prediction-form";
import { BottomNav } from "../app/_components/nav/bottom-nav";
function Fixture() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const change = () => setPath(location.pathname);
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);
  const id = path.split("/").at(-1)!;
  return (
    <SaveFeedbackProvider>
      <header className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <b>ScoreRush</b>
        <span className="text-xs">בדיקת שמירה · נתוני דוגמה</span>
      </header>
      <main className="mx-auto max-w-[480px] px-4 pt-6 pb-28">
        {path === "/bonuses" ? (
          <>
            <h1 className="page-heading mb-6">מלך הבישולים</h1>
            <div className="rounded-3xl bg-[var(--surface-card)] p-4">
              <BonusPredictionForm
                categoryId="bonus-cat"
                categoryLabel="מלך הבישולים"
                slots={[
                  {
                    id: "slot1",
                    index: 1,
                    points: 20,
                    pickLabel: "Michael Olise",
                  },
                  {
                    id: "slot2",
                    index: 2,
                    points: 10,
                    pickLabel: "Lamine Yamal",
                  },
                ]}
              />
            </div>
          </>
        ) : path === "/predictions" ? (
          <h1 className="page-heading">המשחקים והניחושים</h1>
        ) : (
          <>
            <h1 className="page-heading mb-6">
              {id.startsWith("111") ? "המשחק הראשון" : "המשחק הבא"}
            </h1>
            <PredictionForm
              key={id}
              matchId={id}
              draftScope="save-fixture:self"
              homeLabel={id.startsWith("111") ? "Manchester United" : "Arsenal"}
              awayLabel="Paris Saint-Germain"
              initialHome={0}
              initialAway={0}
              hasSubmitted={false}
              lockTime="2099-01-01T00:00:00Z"
            />
          </>
        )}
      </main>
      <BottomNav />
    </SaveFeedbackProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
