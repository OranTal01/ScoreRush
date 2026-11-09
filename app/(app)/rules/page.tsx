import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { parseRankingConfig, rankingBands } from "@/lib/scoring/ranking-config";
import { Card, EmptyState } from "@/app/_components/ui";
export const dynamic = "force-dynamic";
export default async function RulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const current = user ? await getCurrentParticipant(supabase, user.id) : null;
  if (!current)
    return <EmptyState message="הצטרפו לטורניר כדי לראות את החוקים שלו." />;
  const [
    { data: rules, error },
    { data: tournament },
    { data: categories },
    { data: slots },
  ] = await Promise.all([
    supabase
      .from("scoring_rules")
      .select("*")
      .eq("tournament_id", current.tournamentId)
      .order("version", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("tournaments")
      .select(
        "name, onboarding_open, onboarding_matchday, onboarding_closes_at, match_lock_minutes",
      )
      .eq("id", current.tournamentId)
      .single(),
    supabase
      .from("bonus_categories")
      .select("id, name, duplicate_stacking_allowed")
      .eq("tournament_id", current.tournamentId)
      .order("sort_order"),
    supabase
      .from("bonus_slots")
      .select(
        "category_id, slot_index, points, bonus_categories!inner(tournament_id)",
      )
      .eq("bonus_categories.tournament_id", current.tournamentId)
      .order("slot_index"),
  ]);
  if (error || !rules) throw new Error("לא ניתן לטעון את חוקי הטורניר");
  const config = parseRankingConfig(rules.ranking_config);
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <h1 className="text-xl font-extrabold">החוקים שלנו</h1>
      <p className="text-sm text-[var(--text-secondary)]">{tournament?.name}</p>
      <Card className="space-y-3 text-sm leading-7">
        <h2 className="font-bold">ניחושי המשחקים</h2>
        <p>
          תוצאה מדויקת: {rules.exact_score_points} נקודות. מנצחת והפרש נכון:{" "}
          {rules.winner_and_diff_points}. מנצחת בלבד: {rules.winner_only_points}
          . ניחוש שגוי: {rules.wrong_points}.
        </p>
        <p>
          תיקו נכון בתוצאה אחרת: {rules.winner_and_diff_points} נקודות. תיקו
          מדויק: {rules.exact_score_points}. הניקוד לפי 90 דקות ותוספת זמן, ללא
          הארכה ופנדלים.
        </p>
        <p>
          כל משחק ננעל{" "}
          {tournament?.match_lock_minutes === 1
            ? "דקה"
            : `${tournament?.match_lock_minutes ?? 5} דקות`}{" "}
          לפני הפתיחה. ללא ניחוש, ברירת המחדל היא 0–0.
        </p>
        {tournament?.onboarding_open && (
          <p className="text-[var(--gold)]">
            כרגע פתוחה הזדמנות אחרונה להשלים ניחושים חסרים עד מחזור{" "}
            {tournament.onboarding_matchday}. ניחוש שכבר נשמר נשאר נעול. החלון
            ייסגר אוטומטית במועד שנקבע.
          </p>
        )}
      </Card>
      <Card className="space-y-3 text-sm leading-7">
        <h2 className="font-bold">ניחושי המיקומים</h2>
        <p>
          {config.mode === "bands"
            ? `הטווחים הם ${rankingBands(config)
                .map((band) => band.label)
                .join(", ")}. אין חשיבות לסדר בתוך כל טווח.`
            : "מדרגים את הקבוצות בכל בית לפי המיקום הסופי."}
        </p>
        <p>
          כל קבוצה {config.mode === "bands" ? "בטווח" : "במיקום"} הנכון שווה{" "}
          {rules.group_ranking_points_per_position} נקודות. הניקוד ניתן בסיום
          השלב.
        </p>
      </Card>
      <Card className="space-y-3 text-sm leading-7">
        <h2 className="font-bold">הבונוסים</h2>
        {categories?.map((category) => (
          <div key={category.id} className="border-t border-white/10 pt-2">
            <h3 className="font-bold">{category.name}</h3>
            <p>
              {slots
                ?.filter((slot) => slot.category_id === category.id)
                .map(
                  (slot) => `אפשרות ${slot.slot_index}: ${slot.points} נקודות`,
                )
                .join(" · ")}
            </p>
            {category.duplicate_stacking_allowed && (
              <p className="text-xs text-[var(--text-muted)]">
                מותר לבחור אותו שם כמה פעמים; הנקודות של האפשרויות הנכונות
                מצטברות.
              </p>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
