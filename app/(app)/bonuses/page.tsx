import { bonuses as content, common } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { isPast } from "@/lib/time";
import { MotionIn } from "../../_components/motion/motion-in";
import {
  Card,
  DataFreshnessNote,
  EmptyState,
  Pill,
  SectionHeader,
} from "../../_components/ui";
import { BonusPredictionForm } from "./_components/bonus-prediction-form";

type BonusCategoryRow = {
  id: string;
  name: string;
  type: string;
  resolves_at: "ongoing" | "tournament_end";
  duplicate_stacking_allowed: boolean;
  locks_at: string | null;
  sort_order: number;
};
type BonusSlotRow = {
  id: string;
  category_id: string;
  slot_index: number;
  points: number;
};
type BonusPredictionRow = {
  category_id: string;
  slot_id: string;
  pick_label: string;
  points_earned: number | null;
};
type BonusStatRow = {
  category_id: string;
  label: string;
  value: number;
  rank: number;
};

export const dynamic = "force-dynamic";

/** Screen 10 (UX-BLUEPRINT.md): bonus categories, slot picks, current bonus
 * leaders, points breakdown — wired to real data via RLS-scoped queries.
 * Terminal categories (champion/runner-up) show a pending hint instead of a
 * point total until the tournament concludes (SCORING-RULES.md §7).
 * `getCurrentParticipant` (lib/tournaments/current.ts) picks the caller's
 * most-recently-joined tournament — a documented MVP stand-in until the
 * real tournament switcher exists. */
export default async function BonusesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <EmptyState message={content.errorUnauthenticated} />;
  }

  const current = await getCurrentParticipant(supabase, user.id);
  if (!current) {
    return <EmptyState message={content.errorNotAMember} />;
  }
  const { participantId, tournamentId } = current;

  const { data: categories } = await supabase
    .from("bonus_categories")
    .select(
      "id, name, type, resolves_at, duplicate_stacking_allowed, locks_at, sort_order",
    )
    .eq("tournament_id", tournamentId)
    .order("sort_order", { ascending: true })
    .returns<BonusCategoryRow[]>();

  if (!categories || categories.length === 0) {
    return <EmptyState message={content.emptyState} />;
  }

  const categoryIds = categories.map((c) => c.id);

  const [{ data: slots }, { data: predictions }, { data: stats }] =
    await Promise.all([
      supabase
        .from("bonus_slots")
        .select("id, category_id, slot_index, points")
        .in("category_id", categoryIds)
        .returns<BonusSlotRow[]>(),
      supabase
        .from("bonus_predictions")
        .select("category_id, slot_id, pick_label, points_earned")
        .eq("participant_id", participantId)
        .in("category_id", categoryIds)
        .returns<BonusPredictionRow[]>(),
      supabase
        .from("bonus_stats")
        .select("category_id, label, value, rank")
        .in("category_id", categoryIds)
        .returns<BonusStatRow[]>(),
    ]);

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      {categories.map((category, index) => {
        const categorySlots = (slots ?? [])
          .filter((s) => s.category_id === category.id)
          .sort((a, b) => a.slot_index - b.slot_index);
        const predictionBySlot = new Map(
          (predictions ?? [])
            .filter((p) => p.category_id === category.id)
            .map((p) => [p.slot_id, p]),
        );
        const leaders = (stats ?? [])
          .filter((s) => s.category_id === category.id && s.rank <= 3)
          .sort((a, b) => a.rank - b.rank || b.value - a.value);

        const isTerminal = category.resolves_at === "tournament_end";
        const isLocked =
          category.locks_at !== null && isPast(category.locks_at);

        const slotPoints = categorySlots.map(
          (s) => predictionBySlot.get(s.id)?.points_earned ?? null,
        );
        const totalPoints = slotPoints.some((p) => p !== null)
          ? slotPoints.reduce<number>((sum, p) => sum + (p ?? 0), 0)
          : null;

        return (
          <MotionIn key={category.id} index={index}>
            <Card className="flex flex-col gap-3">
              <SectionHeader
                title={category.name}
                action={
                  totalPoints !== null ? (
                    <Pill tone="gold">
                      +{totalPoints} {common.points}
                    </Pill>
                  ) : undefined
                }
              />

              {isTerminal && (
                <DataFreshnessNote message={content.terminalPendingHint} />
              )}

              {isLocked ? (
                <div className="flex flex-col gap-2">
                  <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                    {content.slotsLabel}
                  </span>
                  <ul className="flex flex-col gap-1.5">
                    {categorySlots.map((slot) => {
                      const pick = predictionBySlot.get(slot.id);
                      return (
                        <li
                          key={slot.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center text-[10.5px] font-bold text-[var(--text-primary)]"
                              style={{
                                borderRadius: "50%",
                                background: colors.surfaceCard2,
                              }}
                            >
                              {slot.slot_index}
                            </span>
                            {pick?.pick_label ?? "—"}
                          </span>
                          <span className="ltr shrink-0 font-bold text-[var(--gold)] tabular-nums">
                            {slot.points} {common.points}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {category.duplicate_stacking_allowed && (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {content.duplicateAllowedHint}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {category.duplicate_stacking_allowed && (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {content.duplicateAllowedHint}
                    </p>
                  )}
                  <BonusPredictionForm
                    categoryId={category.id}
                    slots={categorySlots.map((s) => ({
                      id: s.id,
                      index: s.slot_index,
                      points: s.points,
                      pickLabel: predictionBySlot.get(s.id)?.pick_label ?? "",
                    }))}
                  />
                </>
              )}

              {leaders.length > 0 && (
                <div
                  className="flex flex-col gap-1.5 border-t pt-3"
                  style={{ borderColor: colors.border }}
                >
                  <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                    {content.currentLeadersLabel}
                  </span>
                  <ul className="flex flex-col gap-1">
                    {leaders.map((leader, i) => (
                      <li
                        key={`${leader.label}-${i}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-[var(--text-secondary)]">
                          {leader.rank}. {leader.label}
                        </span>
                        <span className="ltr font-bold text-[var(--text-primary)] tabular-nums">
                          {leader.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </MotionIn>
        );
      })}
    </div>
  );
}
