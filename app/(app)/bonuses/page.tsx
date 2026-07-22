import { colors } from "@/lib/design-tokens";
import { bonuses as content, common } from "@/lib/content/he";
import {
  bonusCategories,
  bonusLeaders,
  bonusPredictionForCategory,
} from "@/lib/mock";
import {
  Card,
  DataFreshnessNote,
  EmptyState,
  Pill,
  SectionHeader,
} from "../../_components/ui";

/** Screen 10 (UX-BLUEPRINT.md): bonus categories, slot picks, current bonus
 * leaders, points breakdown. Terminal categories (champion/runner-up) show a
 * pending hint instead of a point total until the tournament concludes
 * (SCORING-RULES.md §7). */
export default function BonusesPage() {
  if (bonusCategories.length === 0) {
    return <EmptyState message={common.emptyGeneric} />;
  }

  return (
    <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[560px] lg:max-w-[640px]">
      {bonusCategories.map((category) => {
        const prediction = bonusPredictionForCategory(category.id);
        const leaders = bonusLeaders[category.id];
        const isTerminal = category.resolvesAt === "tournament_end";
        const pointsEarned = prediction?.pointsEarned ?? null;

        return (
          <Card key={category.id} className="flex flex-col gap-3">
            <SectionHeader
              title={category.name}
              action={
                pointsEarned !== null ? (
                  <Pill tone="gold">
                    +{pointsEarned} {common.points}
                  </Pill>
                ) : undefined
              }
            />

            {isTerminal && (
              <DataFreshnessNote message={content.terminalPendingHint} />
            )}

            <div className="flex flex-col gap-2">
              <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                {content.slotsLabel}
              </span>
              <ul className="flex flex-col gap-1.5">
                {category.slots.map((slot) => {
                  const pick = prediction?.picks.find(
                    (p) => p.slotId === slot.id,
                  );
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
                          {slot.index}
                        </span>
                        {pick?.pickLabel ?? "—"}
                      </span>
                      <span className="ltr shrink-0 font-bold text-[var(--gold)] tabular-nums">
                        {slot.points} {common.points}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {category.duplicateStackingAllowed && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  {content.duplicateAllowedHint}
                </p>
              )}
            </div>

            {leaders && leaders.length > 0 && (
              <div
                className="flex flex-col gap-1.5 border-t pt-3"
                style={{ borderColor: colors.border }}
              >
                <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                  {content.currentLeadersLabel}
                </span>
                <ul className="flex flex-col gap-1">
                  {leaders.map((leader) => (
                    <li
                      key={leader.rank}
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
        );
      })}
    </div>
  );
}
