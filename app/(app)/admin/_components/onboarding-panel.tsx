import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/app/_components/ui";
import { CloseOnboardingForm } from "./close-onboarding-form";
import { allowsRetrospectiveEntry } from "@/lib/tournaments/onboarding";

const progressSchema = z.array(
  z.object({
    participant_id: z.string(),
    display_name: z.string(),
    match_picks: z.coerce.number(),
    bonus_picks: z.coerce.number(),
    ranking_picks: z.coerce.number(),
  }),
);
export async function OnboardingPanel({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const supabase = await createClient();
  const [
    { data: tournament, error: tournamentError },
    { data: progress, error },
    { data: slots, error: slotsError },
    { data: matches, error: matchesError },
    { data: teams, error: teamsError },
  ] = await Promise.all([
    supabase
      .from("tournaments")
      .select("onboarding_open, onboarding_matchday, onboarding_closes_at")
      .eq("id", tournamentId)
      .single(),
    supabase
      .rpc("onboarding_progress", { p_tournament_id: tournamentId })
      .then((result) => ({
        ...result,
        data: progressSchema.parse(result.data ?? []),
      })),
    supabase
      .from("bonus_slots")
      .select("id, bonus_categories!inner(tournament_id)")
      .eq("bonus_categories.tournament_id", tournamentId),
    supabase
      .from("matches")
      .select("id, stage, matchday, status")
      .eq("tournament_id", tournamentId),
    supabase
      .from("teams")
      .select("group")
      .eq("tournament_id", tournamentId)
      .not("group", "is", null),
  ]);
  if (
    error ||
    tournamentError ||
    slotsError ||
    matchesError ||
    teamsError ||
    !tournament
  )
    throw new Error("לא ניתן לטעון את התקדמות הקליטה");
  const expectedMatches = (matches ?? []).filter((match) =>
    allowsRetrospectiveEntry(
      {
        onboarding_open: true,
        onboarding_matchday: tournament.onboarding_matchday,
      },
      match,
    ),
  ).length;
  const expectedGroups = new Set((teams ?? []).map((team) => team.group)).size;
  const complete = (row: NonNullable<typeof progress>[number]) =>
    row.match_picks >= expectedMatches &&
    row.bonus_picks >= (slots?.length ?? 0) &&
    row.ranking_picks >= expectedGroups;
  const pendingRows = (progress ?? []).filter((row) => !complete(row));
  const doneRows = (progress ?? []).filter(complete);
  function progressRows(rows: NonNullable<typeof progress>) {
    return (
      <ul className="divide-y divide-white/10">
        {rows.map((row) => (
          <li key={row.participant_id} className="py-3">
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
              <bdi className="font-bold">{row.display_name}</bdi>
              <span
                className={
                  complete(row)
                    ? "text-xs text-[var(--success)]"
                    : "text-xs text-[var(--gold)]"
                }
              >
                {complete(row) ? "הכול הושלם ✓" : "ממתינים להשלמה"}
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ["משחקים", row.match_picks, expectedMatches],
                ["בונוסים", row.bonus_picks, slots?.length ?? 0],
                ["דירוג", row.ranking_picks, expectedGroups],
              ].map(([label, saved, total]) => (
                <div key={label} className="rounded-lg bg-white/5 p-2">
                  <dt className="text-[11px] text-[var(--text-secondary)]">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-bold tabular-nums">
                    {saved} / {total}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-extrabold">
        {tournament?.onboarding_open ? "תקופת הקליטה פתוחה" : "מצב המשתתפים"} ·{" "}
        {progress?.length ?? 0} נרשמו
      </h2>
      <p className="text-xs leading-6 text-[var(--text-secondary)]">
        {tournament.onboarding_open
          ? `השלמת ניחושים חסרים פתוחה עד מחזור ${tournament.onboarding_matchday}. ניחוש שכבר נשמר נשאר נעול, והחלון ייסגר אוטומטית במועד שנקבע.`
          : "הקליטה סגורה. כאן רואים את השלמת בחירות הפתיחה; משחקים עתידיים ננעלים לפי המועד שנקבע לכל משחק."}
      </p>
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="text-[var(--success)]">
          {doneRows.length} השלימו הכול
        </span>
        <span className="text-[var(--gold)]">
          {pendingRows.length} עדיין חסרים
        </span>
      </div>
      {pendingRows.length > 0 && (
        <details open>
          <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">
            דורשים תשומת לב ↓
          </summary>
          {progressRows(pendingRows)}
        </details>
      )}
      {doneRows.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">
            השלימו את הקליטה ({doneRows.length}) ↓
          </summary>
          {progressRows(doneRows)}
        </details>
      )}
      {tournament?.onboarding_open && (
        <CloseOnboardingForm tournamentId={tournamentId} />
      )}
    </Card>
  );
}
